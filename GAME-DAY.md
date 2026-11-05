# Game-day duties and visual polish

Source: John supplied PHOTO-2026-11-04-17-50-21.jpg on 5 November 2026. The named family pairs are transcribed from that attachment, not inferred from PlayHQ or participant records.

| Team game | Families covering scorer and spotter | Arrival | Tip-off |
| --- | --- | --- | --- |
| Round 1, Friday 6 November | Jack and Kyrie | 7:05pm | 7:35pm |
| Round 2, Saturday 7 November | Hamish and Tom | 12:15pm | 12:45pm |
| Round 3, Saturday 7 November | Charlie and Otto | 7:25pm | 7:55pm |
| Finals Round 1, Sunday 8 November | Oliver and Mako | 10:40am, inferred; confirm | 11:10am |
| Gold Medal Game, Sunday 8 November, if Tigers qualify | TBC | 4:10pm | 4:40pm |

The attachment does not allocate the individual scorer or spotter role to a particular family. The app therefore preserves each pair under a combined Scorer & spotter label.

## Source discrepancies and finals

The sheet says 10:40pm beside the Sunday 11:10am fixture. The interface explicitly identifies the use of 10:40am as an inference and asks families to confirm with the team manager. The gold-game arrival contains 4:10pmpm; the display normalises it to 4:10pm and records the original text in the visible notes.

The sheet illustrates Semi Final 1, Pool A first against Pool B second, on Court 1. It does not establish the Tigers' pool finishing position. Until the actual Tigers final is identified in PlayHQ, the duties board says fixture, opponent and court TBC. It treats Oliver and Mako as the team-sheet pair for the Tigers' Finals Round 1 game; it never applies their names to all division finals. Gold-game attendance stays conditional.

## UI and data separation

Home and each confirmed Tigers game display the pair without requiring expansion. Games has a Family duties view, linked directly from Home. Imported snapshots remain unchanged; team duties are overlaid locally from assets/game-day.js. If a confirmed fixture moves, arrival is recalculated to 30 minutes before the new tip-off and labelled accordingly.

The visual layer adds a restrained gold-edged match card, improved spacing, subtle transitions, a local tip-off countdown, and clearer active navigation. It retains the five existing sections, original logos, playbook and name-and-number-only roster. Reduced-motion preference disables added animation. Countdown uses scheduled time, not inferred live scoring.

The build adapter scripts/game-day-ui.mjs runs after the existing unified build and validates its anchors. No new production dependencies, credentials, scraper changes or subscriptions are added. Reverting this commit restores the prior interface without affecting competition snapshots.
