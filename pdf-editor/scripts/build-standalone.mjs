import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
let html = await readFile(join(dist, 'editor-source.html'), 'utf8');
const cssPath = html.match(/href="\.\/assets\/(.+?\.css)"/)?.[1] ?? html.match(/href="\/assets\/(.+?\.css)"/)?.[1];
const jsPath = html.match(/src="\.\/assets\/(.+?\.js)"/)?.[1] ?? html.match(/src="\/assets\/(.+?\.js)"/)?.[1];
if (!cssPath || !jsPath) throw new Error('找不到正式版本的 CSS 或 JavaScript。');
const [css, jsSource] = await Promise.all([
  readFile(join(dist, 'assets', cssPath), 'utf8'),
  readFile(join(dist, 'assets', jsPath), 'utf8')
]);
const js = jsSource.replaceAll('</script', '<\\/script');
html = html
  .replace(/<link rel="stylesheet"[^>]+>/, () => `<style>${css}</style>`)
  .replace(/<script type="module"[^>]+><\/script>/, () => `<script type="module">${js}<\/script>`);
const licenses = {
  'Noto Sans TC': await readFile(join(root, 'src', 'assets', 'OFL-NotoSansTC.txt'), 'utf8'),
  'Noto Serif TC': await readFile(join(root, 'src', 'assets', 'OFL-NotoSerifTC.txt'), 'utf8'),
};
html = html.replace('</head>', () => `<script type="application/json" id="font-licenses">${JSON.stringify(licenses).replaceAll('</script', '<\\/script')}</script></head>`);
await writeFile(join(root, 'index.html'), html, 'utf8');
await rm(join(root, 'PDF編輯器.html'), { force: true });
console.log('Created index.html');
