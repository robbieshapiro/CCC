// Bundles the built app into one self-contained HTML page (no external files), e.g. for sharing as a single file.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dist = 'dist';
const html = readFileSync(`${dist}/index.html`, 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+)"/g)].map((m) => readFileSync(`${dist}/${m[1]}`, 'utf8'));
const js = [...html.matchAll(/<script type="module"[^>]*src="\/?([^"]+)"/g)].map((m) =>
  readFileSync(`${dist}/${m[1]}`, 'utf8').replace(/<\/script/gi, '<\\/script'),
);

const fonts = [...html.matchAll(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)"/g)].map((m) => `<link rel="stylesheet" href="${m[1]}">`);

const page = `<title>Claude Country Club</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts.join('\n')}
<style>${css.join('\n')}</style>
<div id="app"></div>
<script type="module">${js.join('\n')}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/ccc.html', page);
console.log(`dist-single/ccc.html ${(page.length / 1024).toFixed(1)} KB`);
