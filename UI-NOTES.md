# iPhone courtside interface

This layer retains the existing data collector and evidence-based reports. The build runs the original safety patch, applies the mobile templates, then caches verified official club artwork. No new runtime packages are required.

The four existing destinations remain Now, Tigers, Opposition and Division. Navigation is fixed at the bottom with iOS safe-area padding. Dark and light modes are available through the header button. The stored preference is local to the device.

Club identity is separate from squad identity. Camberwell 9, 10 and 12 share the Dragons logo but retain their squad number; Darebin 3 and 4 use the Phoenix representative identity. Southern Peninsula retains the Future Sharks Blue label. Finals without confirmed teams show a neutral question mark, never a guessed logo.

Official logo URLs and SHA-256 digests are in scripts/cache-logos.mjs. The Camberwell source is a combined Dragons/VJBL graphic; CSS frames the Dragons portion only. Artwork is not recoloured. If an upstream file changes, the build stops for re-verification instead of silently accepting a different logo. Existing production remains intact on a failed build.

Checked at browser viewport widths 375, 393, 430 and 1024 pixels, including all four tabs, report navigation, light/dark switching and logo loading. These are browser-emulated checks, not physical-device certification.

The app's confirmed production alias is now https://tigers148-tournament.vercel.app. The reader destination and its matching GitHub identity audience use that same address. The retired alias is no longer used by the reader.

Rollback: revert the iPhone UI commit. If rolling back after the hostname change, retain the new AUDIENCE value in lib/runner-auth.js so collection continues to reach the current address.
