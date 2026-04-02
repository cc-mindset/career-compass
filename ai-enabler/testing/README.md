# BLS Testing Sandbox

Temporary Node.js scripts for checking BLS data before ingestion.

Run one family at a time:

- `npm run jolts`
- `npm run ces`
- `npm run cps`
- `npm run projections`

Output goes to `bls/outputs/jolts/`, `bls/outputs/ces/`, `bls/outputs/cps/`, and `bls/outputs/projections/`.
Copy `.env.example` to `.env` if you want to keep local keys in one place.

CPS / LFS → “How healthy is the job market overall?”
JOLTS / JVWS → “Are companies hiring or firing?”
CES / SEPH → “Which industries are growing or shrinking?”
OEWS → “How much do different jobs pay?”
Employment Projections → “Which jobs will grow in the future?”

