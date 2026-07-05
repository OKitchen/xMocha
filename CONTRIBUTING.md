# Contributing to xMocha

Thanks for helping xMocha. This project is a multi-universe decision agent for branching decisions and agent worlds. The current priority is to keep the product understandable, stable enough for seed users, and safe to run without exposing private keys or user data.

Please read this before opening an issue or pull request.

## Project Priorities

Near-term priorities:

- make Decision Mode clear and useful for real decisions;
- keep World Mode as a strong beta/demo of the broader simulation engine;
- improve simulation quality, evaluation, reliability, safety, cost control, and test coverage;
- research better dynamic scoring, path metrics, and training/eval data loops;
- keep public docs honest and up to date;
- avoid large rewrites before the seed cohort proves the strongest wedge.

Good contributions are usually small, focused, and easy to review.

## Contribution Priorities

We value contributions roughly in this order:

1. Bug fixes: crashes, broken flows, incorrect persistence, data loss, or regressions.
2. Security and privacy hardening: prompt injection, data exposure, unsafe file handling, auth/access bugs, or secret leakage.
3. Reliability and robustness: fallback behavior, error handling, rate limits, latency, and graceful degradation.
4. Simulation quality: better grounding, consequence realism, social-agent reactions, world continuity, uncertainty, and safety.
5. Evaluation and scoring: public fixtures, dynamic branch scoring, path metrics, provider/model comparisons, and reproducible benchmarks.
6. Modularity: cleaner boundaries between world model, social agents, scoring, persistence, UI surfaces, and domain modules.
7. Domain modules and examples: useful career/startup/AI-transition scenarios, original WorldPacks, and public-domain samples.
8. Documentation: setup fixes, architecture notes, examples, and clearer contribution guidance.

## How To Contribute

Small fixes can usually go straight to a pull request:

- bug fixes with a clear reproduction;
- docs, typo, or setup improvements;
- small UI polish that does not change product direction;
- public/synthetic evaluation fixtures;
- tests for existing domain logic;
- small accessibility or mobile usability fixes.

Start a GitHub Issue or maintainer discussion first for:

- new modes, major features, or architecture changes;
- new modules or plugin-like extension points;
- changes to scoring, path metrics, evaluation format, or training data flow;
- database schema, persistence, analytics, privacy, or hosted-access changes;
- large UI/landing changes that affect xMocha's positioning;
- domain-specific simulation packs that should become part of the core product.

Usually not accepted without prior maintainer agreement:

- refactor-only PRs that do not fix a concrete bug, testability problem, or module boundary;
- broad rewrites of the simulation runtime;
- test/CI-only changes that simply chase known failures without validating a new fix;
- vague new features that make the Decision Mode wedge less clear;
- copyrighted fictional worlds, private user data, raw prompt logs, or generated datasets with unclear rights;
- changes that make xMocha sound like future prediction, professional advice, or an automatic decision-maker.

If a feature can live as an example, experimental module, evaluation case, or external integration, start there before proposing it for the core runtime.

## Code Of Conduct

Be direct, respectful, and practical. Assume good intent, but keep feedback grounded in the code or product behavior. Do not post private user data, credentials, or sensitive personal information in issues, PRs, screenshots, or logs.

## Branch Model

xMocha uses one public repo with production protected through branches.

```text
main        production-stable branch
develop     optional integration branch
feature/*   new features
fix/*       bug fixes
docs/*      documentation
```

Rules:

- open a PR for changes to `main`;
- keep each PR focused on one purpose;
- do not push secrets or production data;
- treat AI-agent changes like any other contributor PR.

## Local Setup

Install dependencies:

```bash
npm ci
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Use your own API keys and database. Do not use xMocha production credentials.

For a local web run without model/API cost, use mock mode:

```bash
npm run web:mock
```

For provider-backed development, fill `.env.local` and run the matching command, for example:

```bash
npm run web:dev
```

## Required Checks

Before opening or updating a PR, run:

```bash
npm test
npm run web:build
```

`npm test` currently runs the TypeScript check. If your PR adds a separate test runner later, keep this command useful for contributors.

If your change touches the database schema, generate and apply migrations carefully:

```bash
npm run db:generate
npm run db:migrate
```

Do not run migrations against production unless you are intentionally deploying a reviewed schema change.

## Pull Request Checklist

Before requesting review:

- explain what changed and why;
- list the files or areas touched;
- mention the commands you ran;
- include screenshots or preview links for UI changes;
- note any known limitations or follow-up work;
- confirm no secrets, private user data, or production database URLs are included.

For product changes, also check:

- first-time user can understand the path;
- Decision Mode remains the primary wedge;
- World Mode changes do not confuse the landing page or investor story;
- safety/disclaimer language is preserved where relevant;
- generated content still has timeout/fallback behavior.

For simulation, evaluation, scoring, or training-related changes, also check:

- the change defines what quality dimension it improves;
- baseline and proposed behavior can be compared with fixtures, traces, or human review;
- branch scores remain normalized and explainable within the current turn;
- canonical path state and shadow paths remain separate;
- private user data, raw uploads, prompts, and hidden reasoning are not exported into public datasets;
- any training proposal starts as an evaluation dataset or provider/prompt comparison before fine-tuning is considered.

## Good First Issues

Good first contributions:

- docs fixes;
- typo/copy improvements;
- small UI polish;
- tests for pure domain logic;
- evaluation fixtures for public/synthetic scenarios;
- notes that clarify simulation scoring or path metrics;
- clearer setup instructions;
- issue reproduction steps;
- cost-control and observability improvements;
- seed-user workflow improvements that do not add complexity.

Please avoid opening a large architectural rewrite as a first contribution.

## Security And Secrets

Never commit:

- `.env.local`;
- API keys;
- `DATABASE_URL`;
- production database exports;
- real seed-user names, emails, or quotes;
- screenshots containing dashboards, keys, private application pages, or private user data.

If you find a possible secret leak or vulnerability, do not open a public issue with exploit details. Contact the maintainer privately or use GitHub private vulnerability reporting if it is enabled.

## Data And Privacy

xMocha may process personal dilemmas, uploaded/pasted world text, and seed-user feedback. Contributions should preserve these principles:

- do not expose prompts, chain-of-thought, raw private uploads, owner tokens, or hidden model reasoning;
- do not persist sensitive data unless the product clearly needs it;
- keep deletion/export paths simple and understandable;
- use anonymous or synthetic examples in tests and docs.

## Research, Evaluation, And Training Contributions

xMocha is actively researching better simulation quality, dynamic scoring, path evaluation, and possible future training methods. These contributions are welcome, but they need to be measurable and privacy-safe.

Good research contributions include:

- new public or synthetic evaluation scenarios;
- clearer rubrics for simulation coherence, grounding, consequence realism, social-agent reactions, uncertainty, and safety;
- tests for branch scoring, path state, shadow timelines, and world-pressure changes;
- provider/model/prompt comparison reports with reproducible commands;
- lightweight tools that export approved eval cases without raw private uploads;
- proposals for training data schemas, only after evaluation criteria are clear.

When changing branch scores, treat `score` as a relative signal for one turn, not as "the correct answer." A good scoring change should explain which signals it uses, such as goal alignment, milestone progress, risk, reversibility, option value, social friction, relationship/attitude deltas, active events, world pressure, and uncertainty. Scores should stay normalized across the candidate branches shown to the user.

When evaluating a full path, look beyond the final branch. Useful path metrics may include agency, coherence, value alignment, risk exposure, reversibility, accumulated social support/resistance, information gained, unresolved uncertainty, opportunity cost, and how much the world state actually changed after each collapse.

Training or fine-tuning proposals must be staged carefully:

- start with an eval dataset and baseline results;
- use synthetic, public-domain, or explicitly approved data;
- remove personal identifiers and raw private uploads;
- compare prompts/providers/models before training;
- define success, failure, rollback, and cost metrics;
- do not add automatic fine-tuning or self-modifying prompts without a separate design review.

## AI-Agent Contributions

AI-assisted work is welcome, but it must be reviewable.

For Devin, Codex, Cursor, Claude Code, or similar agent work:

- one task per PR;
- include a short summary of what the agent changed;
- include commands run and test results;
- review generated code and docs before merging;
- separate test-infrastructure PRs from product-behavior PRs when possible;
- check package and lockfile changes carefully.

The maintainer remains responsible for product direction and final merge decisions.

## Style Guidelines

General:

- follow existing code patterns before adding new abstractions;
- prefer small, explicit modules over clever generalization;
- keep structured state compact and replayable;
- keep model calls bounded and schema-validated;
- prefer deterministic fallback paths when providers timeout;
- add comments only where they clarify non-obvious behavior.

Frontend:

- keep Decision Mode clear as the first product path;
- avoid adding landing-page claims that are not true yet;
- keep CTAs honest about invite-only seed access;
- make text readable on mobile and desktop;
- avoid UI that encourages users to treat xMocha as medical, legal, financial, or therapy advice.

## Licensing

The project is licensed under Apache License 2.0. By contributing, you agree that your contribution will be licensed under Apache-2.0 unless a separate written agreement says otherwise.
