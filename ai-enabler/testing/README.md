# Testing Sandboxes

Temporary Node.js scripts for checking BLS and Statistics Canada data before ingestion.

US stack lives in `bls/`:

- `npm run jolts`
- `npm run ces`
- `npm run cps`
- `npm run projections`

Canada stack lives in `statscan/`:

- `npm run statcan:lfs`
- `npm run statcan:jvws`
- `npm run statcan:seph`

Output goes to `bls/outputs/jolts/`, `bls/outputs/ces/`, `bls/outputs/cps/`, `bls/outputs/projections/`, `statscan/outputs/lfs/`, `statscan/outputs/jvws/`, and `statscan/outputs/seph/`.
Copy `.env.example` to `.env` if you want to keep local keys in one place.

CPS / LFS → “How healthy is the job market overall?”
JOLTS / JVWS → “Are companies hiring or firing?”
CES / SEPH → “Which industries are growing or shrinking?”
OEWS → “How much do different jobs pay?”
Employment Projections → “Which jobs will grow in the future?”

