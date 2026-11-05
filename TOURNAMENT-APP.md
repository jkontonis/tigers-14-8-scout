# Unified Tigers 14.8 tournament app

Production continues at https://tigers148-tournament.vercel.app. One document contains Home, Games, Playbook, Team and Scout. There are no iframes and no second app navigation. Existing /playbook, /scout and /app bookmarks redirect into the corresponding section.

## Source of truth

- `content/team-source.html` preserves the complete owner-authored tournament hub at commit 62ffe8d. ROSTER, COACHES, MIND and saved fixture arrays are extracted at build time. The latest draft has Dion as number 96; that has not been replaced with the earlier handover's number 14.
- `playbook/index.html` retains the six existing sets, animation coordinates, role-specific instructions, terminology, quiz logic and coach drawings. No tactical content was invented or replaced for this integration.
- `scout/index.html`, the existing safety patch and mobile adapter retain the reporting engine. Read-only integrated components receive the same `/api/data` snapshot as the game centre.
- `assets/tournament.html`, `.css` and `.js` provide the common shell and routes. `scripts/unify-app.mjs` generates the two isolated visual components and team content into `assets/generated/` during build.

## Navigation

Home shows the next Tigers game, team-guide arrival time, preparation shortcuts and play previews. Games has our games, all division games and finals. A confirmed Tigers game links directly to its opposition profile. Playbook offers the six sets with the original interactive learning controls. Team includes the current roster, coaches, Game Head and kit. Scout contains opposition, Tigers stats and division sub-sections.

A single light/dark preference applies everywhere. Playback pauses when leaving a play. Refreshing the scouting snapshot does not scroll the user away from other sections. Reading the playbook does not consume Browserless credits.

## Data and access

The collector, its tournament schedule, Browserless secret and publishing authentication are unchanged. The browser refreshes the existing data endpoint, not PlayHQ. It caches the last valid competition snapshot locally and labels a failed refresh. A static team-guide fixture is a clearly labelled fallback. This is not a complete offline-install implementation: initial code and image downloads still require a connection.

Viewing remains password-free as requested. Anyone with the URL can read the playbook and reports. Publishing remains restricted to the authorised workflow; there is no new public editing endpoint.

## Verification and rollback

The existing 24 tests plus five integration tests run with `node scripts/patch-ui.mjs && node --test tests/*.test.mjs`. Production build additionally caches verified club logos and runs the unified builder.

Browser checks cover 375, 393, 430 and 1024 pixel widths; the six original plays, role selection, playback, quizzes, full-screen exit, game filters, opponent links, theme persistence and API-failure behaviour. These are browser-emulated checks, not physical iPhone certification.

Reverting the integration commits restores the preceding hub with separate pages. No competition snapshots, secrets, workflow schedule or publishing credentials are changed by this UI migration.
