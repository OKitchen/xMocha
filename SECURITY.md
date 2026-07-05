# Security Policy

Thank you for helping keep xMocha safe.

xMocha handles user-entered dilemmas, generated simulations, contact details, analytics events, and optional uploaded text. Please treat security and privacy issues with care.

## Supported Versions

xMocha is currently an early MVP. Security fixes are handled on the active `main` branch.

| Version | Supported |
|---|---|
| `main` | Yes |
| older branches / forks | No |

## Reporting A Vulnerability

Please do **not** open a public GitHub issue for security or privacy vulnerabilities.

Use the subject:

```text
[Security] xMocha vulnerability report
```

Please include:

- a short description of the issue
- affected route, file, feature, or deployment surface
- reproduction steps
- expected impact
- whether any secret, token, user input, or session data may be exposed
- screenshots or logs only if they do not contain sensitive data

We will try to acknowledge reports within 72 hours and follow up with triage status when possible.

## Please Do Not Include

Do not send or post:

- real API keys
- database URLs
- `.env.local` contents
- private user dilemmas
- raw uploaded world/source text from another user
- session tokens or private World access tokens
- full production logs containing personal data
- exploit code that causes unnecessary service disruption

If sensitive data is required to explain the issue, redact it first.

## Public Issue Guidance

Use public GitHub issues for:

- documentation bugs
- local setup problems
- non-sensitive UI bugs
- reproducible mock-mode errors
- feature requests
- contribution discussions

Do not use public issues for:

- authentication or access-control bypasses
- data leakage
- prompt/log leakage containing private content
- API key or environment variable exposure
- rate-limit bypasses
- production abuse paths

## Data And Privacy Surfaces

Security reviews should pay special attention to:

- `/api/session/*`
- `/api/world/*`
- contact, feedback, and analytics endpoints
- Neon Postgres persistence
- private WorldPack owner tokens
- raw upload handling in World Mode
- generated report, replay, and share-link behavior
- logs, traces, and developer-only endpoints

xMocha should not expose raw private uploads, API keys, database URLs, prompt secrets, or hidden model reasoning in user-facing responses.

## Secrets

Never commit:

- `.env.local`
- `.env`
- `DATABASE_URL`
- `GOOGLE_API_KEY`
- `HF_TOKEN`
- provider API keys
- local `.xmocha-data` records
- generated `.next` cache

If a secret is accidentally exposed, rotate it immediately and treat previous deployments or logs as compromised.

## Local Development

For safe local testing, prefer mock mode:

```bash
npm run web:mock
```

Mock mode does not require external model keys or production database credentials.

## Responsible Disclosure

Please give maintainers reasonable time to investigate and patch before public disclosure. We appreciate responsible reports and will credit researchers when appropriate and requested.
