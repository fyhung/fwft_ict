import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "pdf-page-splitter.html"), "utf8");

assert.match(html, /PDFLib/, "pdf-lib was not embedded");
assert.match(html, /JSZip/, "JSZip was not embedded");
assert.match(html, /id="pdf-file"/, "file input is missing");
assert.match(html, /id="split-button"/, "split action is missing");
assert.doesNotMatch(html, /<script\s+[^>]*src=/i, "external script found");
assert.doesNotMatch(html, /<link\s+[^>]*href=/i, "external stylesheet found");
assert.doesNotMatch(html, /<(?:img|audio|video|source|iframe)\s+[^>]*src=["']https?:/i, "external media found");
assert.doesNotMatch(html, /\/\*__(?:STYLES|PDF_LIB|JSZIP|APP)__\*\//, "build token remains");

console.log("Single-file build checks passed.");
