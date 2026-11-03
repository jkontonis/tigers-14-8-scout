# Tigers 14.8 Scout

Live tournament scouting for Melbourne Tigers 14.8, built on PlayHQ's public pages.

- `index.html` is the app (static, Melbourne Tigers branding, passcode in `config.json`).
- `scraper/` reads the division's fixture, ladder and game pages with a real browser (Playwright) and writes `data/latest.json`.
- `.github/workflows/scrape.yml` runs the reader every five minutes during tournament hours and commits the data file. The app reads that file straight from GitHub.
- `vercel.json` stops data-only commits from triggering Vercel builds.

## Changing the competition

Edit `config.json`: `gradeUrl` (the PlayHQ division fixture page), `ourTeam` (exact PlayHQ team name), `gradeName`, `tournament`. Adjust the cron lines in the workflow for the new dates.

## Running the reader by hand

GitHub → Actions → "Read PlayHQ" → Run workflow. Locally: `cd scraper && npm install && npx playwright install chromium && node scrape.mjs`.

© John Kontonis
