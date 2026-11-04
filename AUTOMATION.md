# Automatic scouting reports

The GitHub Actions workflow `Update scouting reports` reads public PlayHQ pages through Browserless, validates the dataset, generates evidence-based reports, and publishes to the existing private Vercel Blob store. The existing interface is retained and updated by `scripts/patch-ui.mjs` during the Vercel build.

## One-time secret setup

In this repository, open Settings > Secrets and variables > Actions > New repository secret. Name the secret `BROWSERLESS_TOKEN` and enter your Browserless token. Never commit a token or paste it into source files. No Vercel secret or additional publishing password is needed: publication uses a short-lived, verified GitHub Actions identity restricted to this repository, the main branch, and this workflow.

After the production deployment is ready and the secret is saved, open Actions > Update scouting reports > Run workflow on main. Inspect the result. A successful fixture import does not by itself verify completed-game box-score availability.

## Schedule and free allowance

Scheduled checks target five-minute intervals during the 6 to 8 November 2026 tournament window. GitHub may delay scheduled runs. Fixture reads are normally spaced approximately ten minutes apart, with closer reads when live scores are present. Games are collected incrementally, and the reader checks the Browserless allowance, stopping if fewer than 40 units remain or usage cannot be verified. No paid plan or automatic top-up is enabled by this code. The free allowance is not guaranteed to cover the weekend.

The schedule and the explicit date guard in `scraper/cloud.mjs` must be changed for the 2027 VJBL season. Competition configuration remains in `config.json`.

## Data quality and access

Completed games alone enter scouting trends. Missing statistics are not silently converted to zero. Scoring-share conclusions require reconciled player/team totals. Reports display evidence, a sample size and a separate coaching consideration. Failed collection retains the last valid dataset. The publisher keeps `previous.json` as a backup.

The old phone ingest/finalize endpoints are retired in the deployed build. The existing viewing passcode remains unchanged and is publicly present in the existing repository; it should not be treated as strong confidentiality protection. It cannot authorise the new publisher.

## Verification

Run `npm ci --ignore-scripts`, `node scripts/patch-ui.mjs`, then `node --test tests/*.test.mjs`. The tests cover reporting, parsing, validation, identity verification and interface integration. Mock/unit tests do not establish that all live PlayHQ pages publish all requested statistics.
