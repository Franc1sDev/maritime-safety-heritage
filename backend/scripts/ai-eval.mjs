// Runs the AI evaluation set (tests/ai-eval/cases.json) against the AI provider set in the environment
// (AI_PROVIDER, AI_API_KEY, AI_MODEL) and writes a report next to the set. Used to compare providers before
// choosing one (docs/GO-LIVE.md, section 1), and after any change of model or guidance.
//   AI_PROVIDER=anthropic AI_API_KEY=... npm run ai:eval
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const provider = process.env.AI_PROVIDER ?? (process.env.AI_API_KEY ? 'anthropic' : 'rules');
const report = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'ai-eval', `report-${provider}-${new Date().toISOString().slice(0, 10)}.json`);
const jest = spawn(process.execPath, ['node_modules/jest/bin/jest.js', 'test/ai-eval.spec.ts', '--runInBand'], {
  stdio: 'inherit', env: { ...process.env, AI_PROVIDER: provider, AI_EVAL_REPORT: report, NODE_ENV: 'development' },
});
jest.on('exit', (code) => { console.log(`\nReport written to ${report}`); process.exit(code ?? 1); });
