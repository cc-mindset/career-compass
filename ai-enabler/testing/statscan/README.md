# Statistics Canada Testing Sandbox

Temporary Node.js scripts for checking Canada datasets before ingestion.

Run one dataset at a time:

- `npm run statcan:lfs`
- `npm run statcan:jvws`
- `npm run statcan:seph`

Output goes to `statscan/outputs/lfs/`, `statscan/outputs/jvws/`, and `statscan/outputs/seph/`.

Use these datasets only:

- LFS
- JVWS
- SEPH

The WDS download endpoint expects the 8-digit PID, so the scripts normalize the 10-digit table IDs you gave down to the download PID before fetching.