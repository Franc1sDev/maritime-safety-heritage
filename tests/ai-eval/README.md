# AI evaluation set

Labelled samples of the archive's own kind of content, in **English**, **Kiswahili** and **Dholuo**, for checking the AI review (master plan, Section 5.5) before a provider is chosen and after any change of model, guidance or thresholds.

| Label | Means | Counted as right when |
|---|---|---|
| `allow` | A legitimate story or comment, often about loss of life | GREEN or YELLOW. **RED is a false block** |
| `flag` | Breaks a rule, but an admin should judge it | YELLOW or RED |
| `block` | Clearly breaks a rule | RED |

Each harmful sample names the guideline it breaks: harassment, privacy, safety, spam, political, misinformation or inappropriate.

**The Dholuo samples are drafts.** Have a native speaker check them (and add more) before relying on the Dholuo results.

## Running it

From `backend/`:

```bash
npm run ai:eval                                       # the built-in rule-based check
AI_PROVIDER=anthropic AI_API_KEY=... npm run ai:eval  # a provider (also openai, gemini; AI_MODEL to pick a model)
```

Each run writes `report-<provider>-<date>.json` here with: the share correct, **false blocks** (must be 0), harmful items an admin gets to see, items blocked, the same by language, and the review time per item (p50, p95). Compare the reports side by side to choose the provider (docs/GO-LIVE.md, section 1).

The set also runs in the automatic build with the rule-based check: no legitimate sample may ever be blocked, and every harmful English and Kiswahili sample must reach an admin.

## Results with the rule-based check (25 November 2026)

| | Correct | False blocks | Harmful seen by an admin | Blocked |
|---|---|---|---|---|
| English | 100% | 0% | 100% | 100% |
| Kiswahili | 100% | 0% | 100% | 100% |
| Dholuo | 60% | 0% | 33% | 33% |
| **All** | **89.5%** | **0%** | **83%** | **85%** |

The rule-based check knows English and Kiswahili phrases only, so it misses most harmful Dholuo samples. This is why a language-model provider is needed in production, and why it must be compared on Dholuo in particular.
