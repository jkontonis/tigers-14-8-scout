// One short deployment entrypoint; preserve the existing ordered build steps.
import { execFileSync } from 'node:child_process';
const steps = ['repair-collection', 'patch-ui', 'mobile-ui', 'cache-logos', 'unify-app', 'game-day-ui', 'scout-ui', 'live-health-ui', 'home-screen'];
for (const step of steps) execFileSync(process.execPath, ['scripts/' + step + '.mjs'], { stdio: 'inherit' });
