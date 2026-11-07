# Public PlayHQ collection

The active workflow now runs `scraper/public.mjs`. It does not read `BROWSERLESS_TOKEN`, start a browser, consume Browserless units or change billing. The earlier HTML reader and its quota guard remain as inactive historical code.

The public website uses two read-only GraphQL services: `api.playhq.com/graphql` for Discover metadata and `spectator.playhq.com/graphql` for scorecards. The verified basketball headers are `Tenant: basketball-victoria` and `x-phq-tenant: bv`. Using the full tenant name as the short `x-phq-tenant` header caused earlier empty responses.

One grade query obtains every published round, each game identity, team allocation, date, venue, published scores, public lineup and the official ladder's ordering. Scorecard queries supply explicit player statistics and available period scores. The original game URL remains attached to every record. The collector respects `hideScores`, `publishLineup` and anonymous public participant names. It does not query contact details, registration records or private API endpoints.

For each completed game, both player totals must reconcile to the public final scores before the detailed box is included. Missing values stay null. Period-quality checks remain in the reporting layer. Official ordering is retained, while ladder played/won/lost/points-for/points-against columns are explicitly calculated from the current pool results. `gradeStats` is labelled as an aggregation of reconciled box scores, not a separate official grade-statistics scrape.

Publication retains the existing GitHub OIDC signature verification and repository/workflow scope. No new public write route exists. Failed source requests retain the last verified snapshot and its source timestamp, with an error state. The collection schedule and bounded self-dispatch target approximately five minutes during playing hours and stop at 22:00 AEDT on 8 November 2026. Overnight checks before 07:00 do not request PlayHQ data. This is polling, not a guaranteed real-time feed; it depends on PlayHQ publication and GitHub availability.

Deploy and validate using the existing build and test commands. Test `node scraper/public.mjs --read-only` against real data; it writes `/tmp/scout-public-snapshot.json` without changing the production data. Do not expose any workflow identity tokens in logs or artifacts.
