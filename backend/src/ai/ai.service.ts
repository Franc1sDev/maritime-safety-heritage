import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Db } from '../common/db';
import { LANGUAGE_NAMES, RULES } from '../common/messages';
import { config } from '../config/config';

export type Flag = 'GREEN' | 'YELLOW' | 'RED';
export const GUIDELINES = ['safety', 'privacy', 'harassment', 'misinformation', 'political', 'spam', 'inappropriate'] as const;
export type Guideline = (typeof GUIDELINES)[number];
export interface Review {
  flag: Flag; score: number; summary: string;
  guidelines: Array<{ key: Guideline; score: number; explanation: string }>;
  model: string; guidanceVersion: string;
}
export interface ReviewInput { kind: 'story' | 'comment' | 'message'; text: string; language?: string; images?: Array<{ mime: string; base64: string }>; context?: string }
export class AiUnavailable extends Error {}

const GUIDELINE_TEXT: Record<Guideline, string> = {
  safety: 'Safety: content that puts someone at risk, or dangerous or false safety advice.',
  privacy: 'Privacy: personal data of other people shared without consent (phone numbers, addresses, ID numbers).',
  harassment: 'Harassment and hate speech: threats, personal attacks, bullying, hate against a group.',
  misinformation: 'Misinformation and conspiracy theories.',
  political: 'Political bias or campaigning.',
  spam: 'Spam, scams, advertising and impersonation.',
  inappropriate: 'Inappropriate content: graphic images of injured or dead people, sexual content.',
};

/**
 * The single gateway to AI providers (Section 5.5). Everything AI-related goes through here, so the provider can be
 * changed without touching the rest of the platform. Results are structured and validated before use, and every
 * decision records the model and guidance version.
 */
@Injectable()
export class Ai {
  private readonly log = new Logger('AI');
  constructor(private readonly db: Db) {}

  get provider() { return config.ai.provider; }
  get available() { return this.provider !== 'none' && (this.provider === 'rules' || !!config.ai.apiKey); }
  private model(small = false) {
    const defaults = { anthropic: ['claude-sonnet-5-5', 'claude-haiku-5-5'], openai: ['gpt-4o', 'gpt-4o-mini'], gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], rules: ['rules-v1', 'rules-v1'], none: ['', ''] }[this.provider];
    return small ? (config.ai.smallModel || defaults[1]) : (config.ai.model || defaults[0]);
  }

  async thresholds(): Promise<{ yellowAbove: number; redFrom: number }> {
    const row = await this.db.one(`SELECT value FROM app_settings WHERE key = 'ai.thresholds'`);
    return { yellowAbove: 20, redFrom: 70, ...(row?.value ?? {}) };
  }
  /** GREEN: up to 20%; YELLOW: above 20% and below 70%; RED: 70% or above. */
  flagFor(score: number, t: { yellowAbove: number; redFrom: number }): Flag { return score >= t.redFrom ? 'RED' : score > t.yellowAbove ? 'YELLOW' : 'GREEN'; }

  private async spend(task: string) {
    const row = await this.db.one(`INSERT INTO ai_usage (day, task, calls) VALUES (current_date, $1, 1) ON CONFLICT (day, task) DO UPDATE SET calls = ai_usage.calls + 1 RETURNING (SELECT coalesce(sum(calls),0)::int FROM ai_usage WHERE day = current_date) AS total`, [task]);
    if (this.provider !== 'rules' && (row?.total ?? 0) > config.ai.dailyLimit) throw new AiUnavailable('The daily AI limit has been reached.');
  }

  /** Approved admin decisions become examples given to the AI with future reviews, so it follows the platform's own standards. */
  private async examples(): Promise<string> {
    const rows = await this.db.q(
      `SELECT d.admin_action, d.reason, d.ai_flag, left(coalesce(s.body, c.body, ''), 400) AS excerpt
         FROM moderation_decisions d LEFT JOIN stories s ON d.target_type = 'story' AND s.id = d.target_id LEFT JOIN comments c ON d.target_type = 'comment' AND c.id = d.target_id
        WHERE d.approved AND d.admin_action IN ('override','remove') AND d.reason <> '' ORDER BY d.created_at DESC LIMIT 8`);
    if (!rows.length) return '';
    return '\n\nDecisions by this platform\'s admins on earlier items (follow the same standard):\n' + rows.map((r) =>
      `- AI flag ${r.aiFlag}; admins ${r.adminAction === 'override' ? 'PUBLISHED it' : 'REMOVED it'} because: ${r.reason}. Excerpt: "${String(r.excerpt).replace(/\s+/g, ' ')}"`).join('\n');
  }

  /** AI content review: scores the item against each guideline and returns an overall violation score with an explanation per guideline. */
  async review(input: ReviewInput): Promise<Review> {
    if (!this.available) throw new AiUnavailable('No AI provider is configured.');
    await this.spend('review');
    const t = await this.thresholds();
    if (this.provider === 'rules') return this.rulesReview(input, t);
    const system = `You review content for "Remembering the Waters", Kenya's maritime and inland-water safety heritage archive: a public platform where people living near Kenya's ocean coast, lakes and rivers share safety experiences and heritage.

Context that matters: honest accounts of drownings, ferry and boat accidents, rescues, losses and disasters are exactly what this archive is for. They are NOT harmful content, however sad. Stories may be in English, Kiswahili, Dholuo, Giriama, Digo or other local languages and dialects; judge them by meaning, and never score a text higher because of its language.

The platform's rules:
${RULES.map((r, i) => `${i + 1}. ${r.en}`).join('\n')}
Take extra care with stories about missing people or very recent incidents: flag anything that could interfere with an official search or investigation under "safety".
Not allowed: harassment, hate speech, threats or personal attacks; graphic images of injured or dead people; other people's personal data without consent; misinformation, conspiracy theories or political campaigning; spam, scams, advertising or impersonation; dangerous or false safety advice.

Score the item from 0 (no violation) to 100 (certain, serious violation) against each guideline:
${GUIDELINES.map((g) => `- ${g}: ${GUIDELINE_TEXT[g]}`).join('\n')}

Answer with JSON only, in this exact shape:
{"guidelines":[{"key":"safety","score":0,"explanation":"..."}, ... one entry per guideline ...],"summary":"one or two plain sentences for the contributor, in ${LANGUAGE_NAMES[input.language ?? 'en'] ?? 'English'}, saying what (if anything) to avoid"}
Explanations must be short, specific and respectful.${await this.examples()}`;
    const user = `Item type: ${input.kind}${input.context ? `\nContext: ${input.context}` : ''}\n\nContent:\n"""\n${input.text.slice(0, 24_000) || '(no text; media only)'}\n"""`;
    const raw = await this.complete(system, user, { images: input.images, json: true, timeoutMs: config.ai.reviewTimeoutMs });
    return this.validate(raw, t, this.model());
  }

  /** Structured results are validated before they are used. */
  private validate(raw: string, t: { yellowAbove: number; redFrom: number }, model: string): Review {
    let parsed: any;
    try { parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { throw new AiUnavailable('The AI answer was not valid JSON.'); }
    if (!Array.isArray(parsed?.guidelines)) throw new AiUnavailable('The AI answer was missing the guideline scores.');
    const guidelines = GUIDELINES.map((key) => {
      const g = parsed.guidelines.find((x: any) => x?.key === key) ?? {};
      const score = Math.max(0, Math.min(100, Number(g.score)));
      if (!Number.isFinite(score)) throw new AiUnavailable(`The AI answer had no score for ${key}.`);
      return { key, score: Math.round(score), explanation: String(g.explanation ?? '').slice(0, 600) };
    });
    const score = Math.max(...guidelines.map((g) => g.score));
    return { flag: this.flagFor(score, t), score, summary: String(parsed.summary ?? '').slice(0, 800), guidelines, model, guidanceVersion: config.ai.guidanceVersion };
  }

  /**
   * Built-in rule-based reviewer: a stand-in for development and test hosting, so the whole flow can be exercised
   * without a paid provider. It only catches obvious cases; production uses a language model (AI_PROVIDER).
   */
  private rulesReview(input: ReviewInput, t: { yellowAbove: number; redFrom: number }): Review {
    const text = ` ${input.text.toLowerCase()} `;
    const hit = (words: string[]) => words.filter((w) => text.includes(w));
    const g: Record<Guideline, { score: number; explanation: string }> = Object.fromEntries(GUIDELINES.map((k) => [k, { score: 2, explanation: 'Nothing found.' }])) as never;
    const set = (k: Guideline, score: number, explanation: string) => { if (score > g[k].score) g[k] = { score, explanation }; };
    const threats = hit(['i will kill you', 'kill yourself', 'nitakuua', 'you deserve to die', 'i will find you and', 'tutawachoma']);
    if (threats.length) set('harassment', 92, `Contains a threat or call for harm ("${threats[0]}").`);
    const insults = hit([' idiot', ' stupid ', ' mjinga', ' pumbavu', ' fool ', ' useless people', ' shenzi']);
    if (insults.length) set('harassment', insults.length > 1 ? 55 : 38, 'Contains insulting language aimed at a person or group.');
    const hate = hit(['those people are animals', 'should be wiped out', 'go back to where they came from', 'watu hao ni wanyama']);
    if (hate.length) set('harassment', 88, 'Contains hate speech against a group.');
    const phones = input.text.match(/(?:\+?254|\b0)[17]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g) ?? [];
    const ids = input.text.match(/\b(?:id|kitambulisho|passport)\s*(?:no\.?|number|nambari)?\s*[:#]?\s*\d{6,9}\b/gi) ?? [];
    if (phones.length || ids.length) set('privacy', ids.length ? 74 : 42, `Appears to share personal data (${ids.length ? 'an ID or passport number' : 'a phone number'}). Share it only with the person's consent.`);
    const spam = hit(['click here', 'win money', 'earn $', 'bitcoin', 'whatsapp me for', 'cheap loans', 'bet now', 'promo code', 'http://bit.ly', 'forex signals']);
    const links = (input.text.match(/https?:\/\//g) ?? []).length;
    if (spam.length || links > 3) set('spam', spam.length > 1 || links > 5 ? 82 : 46, 'Looks like advertising, a scam or spam.');
    const political = hit(['vote for', 'pigia kura', 'our candidate', 'mgombea wetu', 'elect me']);
    if (political.length) set('political', 48, 'Reads as political campaigning, which the rules do not allow.');
    const conspiracy = hit(['the government sank', 'was staged by', 'crisis actors', 'they are hiding the truth that', 'life jackets are useless', 'you do not need a life jacket', 'huhitaji jaketi']);
    if (conspiracy.length) {
      if (/life jacket|jaketi/.test(conspiracy[0])) set('safety', 76, 'Contains safety advice that could put people at risk.');
      else set('misinformation', 58, 'Makes a claim that looks like a conspiracy theory; give a source.');
    }
    const graphic = hit(['graphic photo of the body', 'picha ya maiti', 'explicit sexual', 'nude ']);
    if (graphic.length) set('inappropriate', 78, 'Describes graphic or explicit material that the archive does not show.');
    const guidelines = GUIDELINES.map((key) => ({ key, ...g[key] }));
    const score = Math.max(...guidelines.map((x) => x.score));
    const worst = guidelines.find((x) => x.score === score)!;
    return { flag: this.flagFor(score, t), score, summary: score > t.yellowAbove ? worst.explanation : '', guidelines, model: 'rules-v1', guidanceVersion: config.ai.guidanceVersion };
  }

  /** One call to the configured language model. */
  async complete(system: string, user: string, opts: { images?: Array<{ mime: string; base64: string }>; json?: boolean; small?: boolean; timeoutMs?: number; maxTokens?: number } = {}): Promise<string> {
    const model = this.model(opts.small);
    const signal = AbortSignal.timeout(opts.timeoutMs ?? 60_000);
    const images = (opts.images ?? []).slice(0, 8);
    try {
      if (this.provider === 'anthropic') {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal, headers: { 'x-api-key': config.ai.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 1500, system, messages: [{ role: 'user', content: [...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mime, data: i.base64 } })), { type: 'text', text: user }] }] }),
        });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
        return j.content?.map((c: any) => c.text ?? '').join('') ?? '';
      }
      if (this.provider === 'openai') {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', signal, headers: { Authorization: `Bearer ${config.ai.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 1500, ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
            messages: [{ role: 'system', content: system }, { role: 'user', content: [...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } })), { type: 'text', text: user }] }] }),
        });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
        return j.choices?.[0]?.message?.content ?? '';
      }
      if (this.provider === 'gemini') {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', signal, headers: { 'x-goog-api-key': config.ai.apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, generationConfig: { maxOutputTokens: opts.maxTokens ?? 1500, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
            contents: [{ role: 'user', parts: [...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.base64 } })), { text: user }] }] }),
        });
        const j: any = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
        return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
      }
    } catch (e) {
      this.log.warn(`AI call failed (${this.provider}): ${(e as Error).message}`);
      throw new AiUnavailable((e as Error).message);
    }
    throw new AiUnavailable('No language model is configured.');
  }

  /** Content translation on demand, cached so each item is translated only once per language. */
  async translate(targetType: string, targetId: string, body: string, to: string): Promise<{ body: string; cached: boolean }> {
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 32);
    const hit = await this.db.one(`SELECT body, source_hash FROM content_translations WHERE target_type = $1 AND target_id = $2 AND language = $3`, [targetType, targetId, to]);
    if (hit && hit.sourceHash === hash) return { body: hit.body, cached: true };
    if (!this.available || this.provider === 'rules') throw new AiUnavailable('Translation needs an AI provider.');
    await this.spend('translate');
    const out = await this.complete(`You translate stories for a Kenyan maritime heritage archive. Translate the text into ${LANGUAGE_NAMES[to] ?? to}. Keep names, places and the storyteller's voice. Answer with the translation only.`, body.slice(0, 24_000), { small: true, maxTokens: 4000 });
    await this.db.q(`INSERT INTO content_translations (target_type, target_id, language, source_hash, body) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (target_type, target_id, language) DO UPDATE SET source_hash = $4, body = $5, created_at = now()`, [targetType, targetId, to, hash, out]);
    return { body: out, cached: false };
  }

  /** Suggested category, tags and place for a story; the contributor always confirms. */
  async suggest(text: string, categories: string[]): Promise<{ category: string; tags: string[]; place: string; language: string }> {
    const empty = { category: '', tags: [], place: '', language: '' };
    if (!text.trim() || !this.available) return empty;
    if (this.provider === 'rules') {
      const lower = text.toLowerCase();
      const category = categories.find((c) => c.toLowerCase().split(/[ ,&]+/).some((w) => w.length > 3 && lower.includes(w))) ?? '';
      const tags = ['ferry', 'rescue', 'storm', 'fishing', 'life jacket', 'dhow', 'canoe', 'flood', 'capsize', 'lighthouse'].filter((w) => lower.includes(w));
      const language = /\b(na|ya|wa|kwa|sisi|maji|bahari|ziwa)\b/.test(lower) ? 'sw' : 'en';
      return { category, tags, place: '', language };
    }
    try {
      await this.spend('suggest');
      const raw = await this.complete(`Suggest details for a story in a Kenyan maritime safety heritage archive. Answer with JSON only: {"category":"one of: ${categories.join(' | ')}","tags":["up to 5 short lowercase tags"],"place":"the main place named, or empty","language":"ISO 639 code of the text"}`, text.slice(0, 6000), { json: true, small: true, maxTokens: 300 });
      const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      return { category: categories.includes(j.category) ? j.category : '', tags: (Array.isArray(j.tags) ? j.tags : []).slice(0, 5).map((x: unknown) => String(x).toLowerCase().slice(0, 30)), place: String(j.place ?? '').slice(0, 80), language: String(j.language ?? '').slice(0, 5) };
    } catch { return empty; }
  }

  /** Suggested alt text for an image; the contributor can edit it. */
  async altText(image: { mime: string; base64: string }, lang = 'en'): Promise<string> {
    if (!this.available || this.provider === 'rules') return '';
    try {
      await this.spend('alt_text');
      return (await this.complete(`Describe this image in one plain sentence (under 25 words) for someone who cannot see it. Write in ${LANGUAGE_NAMES[lang] ?? 'English'}. Do not guess people's names.`, 'Describe the image.', { images: [image], small: true, maxTokens: 120 })).trim().slice(0, 300);
    } catch { return ''; }
  }

  /** The trend explanation for PDF reports, written from the actual figures only. */
  async narrative(figures: Record<string, unknown>, period: string): Promise<string> {
    if (!this.available || this.provider === 'rules') return '';
    try {
      await this.spend('narrative');
      return (await this.complete('You write a short, plain-English explanation of trends for a monthly report of a Kenyan maritime heritage archive. Use ONLY the figures given; every number you mention must appear in the data exactly. Three short paragraphs at most. No headings.', `Period: ${period}\nFigures (JSON):\n${JSON.stringify(figures)}`, { maxTokens: 700 })).trim();
    } catch { return ''; }
  }

  /** Speech to text for audio and video, with timestamps for captions. Needs a transcription key (AI_TRANSCRIBE_KEY, OpenAI-compatible). */
  get canTranscribe() { return !!config.ai.transcribeKey; }
  async transcribe(path: string, name: string): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }>; language: string } | null> {
    if (!this.canTranscribe) return null;
    await this.spend('transcribe');
    const { openAsBlob } = await import('fs');
    const form = new FormData();
    form.append('file', await openAsBlob(path), name);
    form.append('model', 'whisper-1'); form.append('response_format', 'verbose_json');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${config.ai.transcribeKey}` }, body: form, signal: AbortSignal.timeout(600_000) });
    const j: any = await r.json();
    if (!r.ok) throw new AiUnavailable(j?.error?.message ?? `HTTP ${r.status}`);
    return { text: String(j.text ?? ''), language: String(j.language ?? ''), segments: (j.segments ?? []).map((s: any) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text).trim() })) };
  }

  async usageToday() { return this.db.q(`SELECT task, calls FROM ai_usage WHERE day = current_date ORDER BY task`); }
}
