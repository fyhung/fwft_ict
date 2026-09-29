import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { PDFDocument, degrees, PDFName, PDFNumber } from 'pdf-lib';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/teacher/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd(), out = `${root}/tmp/pdfs/layout-qa`;
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4180', '--strictPort'], { cwd: root, windowsHide: true, stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', (data) => { if (String(data).includes('4180')) resolve(); }); server.on('error', reject); server.on('exit', (code) => reject(new Error(`preview exited ${code}`))); });
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => { errors.push(String(error)); console.log('PAGE ERROR:', String(error)); });
  page.on('console', (message) => { if (message.type() === 'error') console.log('BROWSER:', message.text()); });
  await page.goto(process.argv.includes('--standalone') ? pathToFileURL(`${root}/index.html`).href : 'http://127.0.0.1:4180/editor-source.html');
  await page.waitForFunction(() => document.querySelector('#prop-font-family').options[0].textContent.includes('替代'));
  for (const rotation of (process.argv.includes('--standalone') ? [0] : [0, 90, 180, 270])) {
    const source = await PDFDocument.create(); const sourcePage = source.addPage([700, 800]);
    sourcePage.setCropBox(35, 55, 530, 650); sourcePage.setRotation(degrees(rotation));
    if (rotation === 270) sourcePage.node.set(PDFName.of('UserUnit'), PDFNumber.of(1.25));
    const inputPath = `${out}/source-${rotation}.pdf`; await writeFile(inputPath, await source.save());
    await page.locator('#pdf-input').setInputFiles(inputPath);
    await page.waitForFunction(() => document.querySelector('#status-text').textContent.includes('第 1 / 1 頁'));
    const stage = await page.locator('#page-stage').boundingBox();
    await page.locator('[data-tool="rect"]').click();
    await page.mouse.move(stage.x + 55, stage.y + 60); await page.mouse.down(); await page.mouse.move(stage.x + 300, stage.y + 330); await page.mouse.up();
    await page.locator('#prop-color').fill('#00aa00');
    await page.locator('[data-tool="text"]').click(); await page.mouse.click(stage.x + 90, stage.y + 115);
    await page.locator('#prop-text').fill('繁體中文 English 123\n換行與字距測試\n中英文ABC測試自動換行測試123456789\n超出高度的文字應裁切');
    await page.locator('#prop-color').fill('#2244ee');
    await page.locator('#prop-letter-spacing').fill('1.5');
    await page.locator('#prop-line-height').fill('1.5');
    await page.locator('#prop-font-family').selectOption("'PMingLiU', 'MingLiU', serif");
    await page.locator('#font-input').setInputFiles('C:/Windows/Fonts/mingliu.ttc');
    await page.waitForTimeout(1500); console.log('FONT:', await page.locator('#prop-font-family').inputValue(), await page.locator('#toast').textContent());
    await page.waitForFunction(() => document.querySelector('#prop-font-family').selectedOptions[0].textContent === '新細明體');
    const text = page.locator('.text-object');
    console.log('LAYER:', (await page.locator('#objects-layer').innerHTML()).slice(0, 300));
    const before = await text.boundingBox();
    const handle = await text.locator('[data-corner="se"]').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + handle.height / 2 + 50); await page.mouse.up();
    const after = await text.boundingBox(); assert(after.width > before.width + 70 && after.height > before.height + 40, 'textbox resizes both axes');
    await page.locator('#prop-font-size').fill('10'); await page.getByRole('button', { name: '縮小字級', exact: true }).click(); assert.equal(await page.locator('#prop-font-size').inputValue(), '9.5');
    await page.getByRole('button', { name: '放大字級', exact: true }).click(); assert.equal(await page.locator('#prop-font-size').inputValue(), '10');
    await page.getByRole('button', { name: '放大字級', exact: true }).click(); assert.equal(await page.locator('#prop-font-size').inputValue(), '11');
    await page.locator('#prop-font-size').fill('3'); await page.locator('#prop-font-size').press('ArrowDown'); assert.equal(await page.locator('#prop-font-size').inputValue(), '3');
    await page.locator('#prop-font-size').press('ArrowUp'); assert.equal(await page.locator('#prop-font-size').inputValue(), '3.5');
    await page.locator('#prop-font-size').fill('24');
    if (rotation === 0) {
      await page.locator('#quick-color').fill('#e5484d'); await page.locator('[data-tool="line"]').click();
      await page.mouse.move(stage.x + 50, stage.y + 450); await page.mouse.down(); await page.mouse.move(stage.x + 350, stage.y + 480); await page.mouse.up();
      await page.locator('[data-tool="text"]').click(); await page.mouse.click(stage.x + 60, stage.y + 520);
      await page.locator('#prop-text').fill('內建明體 Serif 3.5'); await page.locator('#prop-font-family').selectOption("'Times New Roman', serif");
      await page.locator('#prop-font-size').fill('3.5'); await page.locator('#prop-color').fill('#2244ee');
    }
    await page.mouse.click(stage.x + stage.width - 15, stage.y + 10);
    const normalized = await page.locator('.text-object').first().evaluate((el) => { const stage = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect(); return [(r.left - stage.left) / stage.width, (r.top - stage.top) / stage.height]; });
    await page.locator('#zoom-in-btn').click(); await page.waitForTimeout(350);
    await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(800);
    const changed = await page.locator('.text-object').first().evaluate((el) => { const stage = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect(); return [(r.left - stage.left) / stage.width, (r.top - stage.top) / stage.height]; });
    assert(Math.abs(normalized[0] - changed[0]) < 0.0001 && Math.abs(normalized[1] - changed[1]) < 0.0001, 'position stable after zoom and resize');
    await page.setViewportSize({ width: 1300, height: 1000 }); await page.waitForTimeout(800);
    await page.locator('#zoom-reset-btn').click(); await page.waitForTimeout(350);
    await page.locator('#page-stage').screenshot({ path: `${out}/browser-${rotation}.png` });
    const downloadPromise = page.waitForEvent('download'); await page.locator('#download-btn').click(); const download = await downloadPromise;
    const outputPath = `${out}/export-${rotation}.pdf`; await download.saveAs(outputPath);
    await page.locator('#pdf-input').setInputFiles(outputPath); await page.waitForFunction(() => document.querySelector('#status-text').textContent.includes('export-'));
    await page.waitForTimeout(400); await page.locator('#page-stage').screenshot({ path: `${out}/pdf-${rotation}.png` });
    console.log(`PASS rotation ${rotation}: TTC MingLiU font, text resize, small size steps, stable zoom/resize and PDF download`);
  }
  assert.deepEqual(errors, []); console.log('PASS no browser errors');
} finally { await browser?.close(); server.kill(); }
