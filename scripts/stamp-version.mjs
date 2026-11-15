// Stamps the build with its version (Vercel's commit, or 'dev' locally): the app carries it as VITE_COMMIT, and
// public/version.json says which version is live, so an open app can tell it's out of date (src/version.ts).
import { writeFileSync } from 'node:fs';

const v = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 12);
writeFileSync('.env.production.local', `VITE_COMMIT=${v}\n`);
writeFileSync('public/version.json', JSON.stringify({ v }) + '\n');
console.log(`version ${v}`);
