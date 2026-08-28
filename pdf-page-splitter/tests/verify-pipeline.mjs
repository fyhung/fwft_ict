import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(root, "..");
const outputDir = resolve(workspace, "tmp/pdfs/pdf-splitter-qa/output");
const zipPath = resolve(outputDir, "splitter-pipeline-test.zip");
const expectedNames = ["Class 4A - Cover.pdf", "Class 4A - Lesson - 1.pdf", "Class 4A - Lesson - 1 (2).pdf"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const fixture = await PDFDocument.create();
const font = await fixture.embedFont(StandardFonts.HelveticaBold);
for (let index = 0; index < 3; index += 1) {
  const page = fixture.addPage(index === 1 ? [841.89, 595.28] : [595.28, 841.89]);
  page.drawText(`PDF Splitter Test - Page ${index + 1}`, {
    x: 48,
    y: page.getHeight() - 70,
    size: 24,
    font,
    color: rgb(0.09, 0.46, 0.33),
  });
}

const source = await PDFDocument.load(await fixture.save());
assert.equal(source.getPageCount(), 3);

const zip = new JSZip();
for (let index = 0; index < source.getPageCount(); index += 1) {
  const output = await PDFDocument.create();
  const [page] = await output.copyPages(source, [index]);
  output.addPage(page);
  const bytes = await output.save();
  const reopened = await PDFDocument.load(bytes);
  assert.equal(reopened.getPageCount(), 1);
  zip.file(expectedNames[index], bytes);
}

const zipBytes = await zip.generateAsync({ type: "nodebuffer", compression: "STORE", platform: "DOS" });
await writeFile(zipPath, zipBytes);

const reopenedZip = await JSZip.loadAsync(await readFile(zipPath));
assert.deepEqual(Object.keys(reopenedZip.files), expectedNames);

for (const name of expectedNames) {
  const bytes = await reopenedZip.file(name).async("nodebuffer");
  await writeFile(resolve(outputDir, name), bytes);
}

console.log(`Pipeline verified: ${expectedNames.length} one-page PDFs in ${zipPath}`);
await rm(resolve(workspace, "tmp/pdfs/pdf-splitter-qa"), { recursive: true, force: true });
