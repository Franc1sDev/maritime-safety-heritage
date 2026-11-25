import { Ai, Flag } from './ai.service';

/**
 * Checks the AI review against a labelled set of samples (tests/ai-eval/cases.json), so providers and guidance
 * can be compared on the archive's own kind of content, in English, Kiswahili and Dholuo (Section 5.5).
 */
export interface EvalCase { id: string; language: string; kind: 'story' | 'comment' | 'message'; expect: 'allow' | 'flag' | 'block'; guideline: string; text: string }
export interface EvalResult { id: string; language: string; expect: EvalCase['expect']; flag: Flag | 'ERROR'; score: number; ms: number; right: boolean; falseBlock: boolean; error?: string }

const RANK: Record<Flag, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
/** allow: GREEN or YELLOW (RED is a false block); flag: YELLOW or RED; block: RED. */
export const isRight = (expect: EvalCase['expect'], flag: Flag) => (expect === 'allow' ? flag !== 'RED' : expect === 'flag' ? RANK[flag] >= 1 : flag === 'RED');

const share = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);
const p = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? Math.round(s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]) : 0; };

export async function evaluate(ai: Pick<Ai, 'review'>, cases: EvalCase[], model = '') {
  const results: EvalResult[] = [];
  for (const c of cases) {
    const t = performance.now();
    try {
      const r = await ai.review({ kind: c.kind, text: c.text, language: c.language });
      const ms = performance.now() - t;
      results.push({ id: c.id, language: c.language, expect: c.expect, flag: r.flag, score: r.score, ms: Math.round(ms), right: isRight(c.expect, r.flag), falseBlock: c.expect === 'allow' && r.flag === 'RED' });
      model ||= r.model;
    } catch (e) {
      results.push({ id: c.id, language: c.language, expect: c.expect, flag: 'ERROR', score: 0, ms: Math.round(performance.now() - t), right: false, falseBlock: false, error: (e as Error).message });
    }
  }
  const summarise = (rs: EvalResult[]) => {
    const allow = rs.filter((r) => r.expect === 'allow'), harmful = rs.filter((r) => r.expect !== 'allow'), block = rs.filter((r) => r.expect === 'block');
    return {
      samples: rs.length,
      correct: share(rs.filter((r) => r.right).length, rs.length),
      /** Legitimate stories (often about loss of life) wrongly given RED: should be 0. */
      falseBlocks: share(allow.filter((r) => r.falseBlock).length, allow.length),
      /** Harmful items an admin gets to see (YELLOW or RED). */
      harmfulSeen: share(harmful.filter((r) => r.flag === 'YELLOW' || r.flag === 'RED').length, harmful.length),
      /** Items that should be blocked and were (RED). */
      blockedCaught: share(block.filter((r) => r.flag === 'RED').length, block.length),
      errors: rs.filter((r) => r.flag === 'ERROR').length,
    };
  };
  const languages = [...new Set(cases.map((c) => c.language))];
  const ms = results.filter((r) => r.flag !== 'ERROR').map((r) => r.ms);
  return {
    model, at: new Date().toISOString(),
    overall: summarise(results),
    byLanguage: Object.fromEntries(languages.map((l) => [l, summarise(results.filter((r) => r.language === l))])),
    reviewMs: { p50: p(ms, 0.5), p95: p(ms, 0.95), max: ms.length ? Math.max(...ms) : 0 },
    wrong: results.filter((r) => !r.right),
  };
}
