import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Ai } from '../src/ai/ai.service';
import { EvalCase, evaluate, isRight } from '../src/ai/evaluate';

/**
 * The AI evaluation set (Section 5.5). With the built-in rule-based check this is a regression test: it must never
 * block a legitimate story, and must keep catching the obvious cases in English and Kiswahili. With a real provider
 * (AI_PROVIDER and AI_API_KEY) run `npm run ai:eval` to compare providers; it writes a report.
 */
const cases: EvalCase[] = JSON.parse(readFileSync(join(__dirname, '../../tests/ai-eval/cases.json'), 'utf8')).cases;
const fakeDb = { one: async () => null, q: async () => [] } as any;

describe('AI evaluation set (Section 5.5)', () => {
  it('has labelled samples in English, Kiswahili and Dholuo, with every guideline the rules name', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const l of ['en', 'sw', 'luo']) expect(cases.filter((c) => c.language === l && c.expect === 'allow').length).toBeGreaterThanOrEqual(4);
    expect(new Set(cases.filter((c) => c.expect !== 'allow').map((c) => c.guideline))).toEqual(new Set(['harassment', 'privacy', 'safety', 'spam', 'political', 'misinformation', 'inappropriate']));
  });
  it('scores answers the right way', () => {
    expect(isRight('allow', 'YELLOW')).toBe(true);
    expect(isRight('allow', 'RED')).toBe(false);
    expect(isRight('flag', 'GREEN')).toBe(false);
    expect(isRight('block', 'YELLOW')).toBe(false);
  });
  it('runs the set against the configured reviewer', async () => {
    const report = await evaluate(new Ai(fakeDb), cases);
    if (process.env.AI_EVAL_REPORT) writeFileSync(process.env.AI_EVAL_REPORT, JSON.stringify(report, null, 1));
    // eslint-disable-next-line no-console
    console.log(`AI evaluation (${report.model}): ${JSON.stringify(report.overall)}; by language ${JSON.stringify(report.byLanguage)}; review time ${JSON.stringify(report.reviewMs)}`);
    expect(report.overall.errors).toBe(0);
    // Honest accounts of drownings and accidents are what the archive is for: none may be blocked, in any language.
    expect(report.overall.falseBlocks).toBe(0);
    if (report.model === 'rules-v1') {
      expect(report.byLanguage.en.harmfulSeen).toBe(100);
      expect(report.byLanguage.sw.harmfulSeen).toBe(100);
    } else {
      expect(report.overall.harmfulSeen).toBeGreaterThanOrEqual(90);
    }
  });
});
