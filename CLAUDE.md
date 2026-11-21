# CLAUDE.md: operating rules for AI sessions on LouNgak AI

## Read in this order before doing anything

1. `CLAUDE.md` (this file): rules.
2. `PROGRESS.md`: where things stand right now.
3. `HANDOFF.md`: the next tasks, in order, with acceptance criteria.
4. `docs/REVIEW-2026-11-17.md`: the full technical review behind those tasks.

Background only, when needed: `docs/decisions.md` (decisions, dated), `Context/agents.md` (repository map and
conventions), `Context/refined_foundation.md` (product and hackathon context), `docs/architecture.md`.

## Rules

- **Run the backend tests before and after every change:** `.venv\Scripts\python -m pytest`. Record the counts.
  If you touch `web/`, also run `npm test`, `npm run typecheck` and `npm run build` in `web/`.
- **Small commits.** One task or review step per commit, with the step number in the message. Never commit `.env`,
  `data/`, `runs/` or `uploads/`.
- **Never present simulated data as real.** SAMPLE pest reports, the SAMPLE crop pattern, DEMO records and
  PLACEHOLDER thresholds must keep their labels in data and on screen. Never relabel PLACEHOLDER as VERIFIED.
  Never estimate a missing input. See `docs/decisions.md`, decision A.
- **Wire contract.** A new or changed API model needs its TypeScript mirror in `web/src/state/types.ts` and an
  entry in `tests/test_contract.py`.
- **Work on a branch,** never directly on `main`. Push only when the user asks.
- **Secrets** live in `.env` only (gitignored). Never put real values in `.env.example`, logs or responses.
- **Keep `PROGRESS.md` current** at the end of each session: what changed, test counts with the date, what is next.
