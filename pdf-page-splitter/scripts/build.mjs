import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

const [template, styles, app, pdfLib, jsZip] = await Promise.all([
  read("src/template.html"),
  read("src/styles.css"),
  read("src/app.js"),
  read("node_modules/pdf-lib/dist/pdf-lib.min.js"),
  read("node_modules/jszip/dist/jszip.min.js"),
]);

const safeScript = (source) => source.replaceAll("</script", "<\\/script");
const output = template
  .replace("/*__STYLES__*/", () => styles)
  .replace("/*__PDF_LIB__*/", () => safeScript(pdfLib))
  .replace("/*__JSZIP__*/", () => safeScript(jsZip))
  .replace("/*__APP__*/", () => safeScript(app));

if (/\/\*__(?:STYLES|PDF_LIB|JSZIP|APP)__\*\//.test(output)) {
  throw new Error("The HTML template still contains an unreplaced build token.");
}

await writeFile(resolve(root, "pdf-page-splitter.html"), output, "utf8");
console.log(`Built pdf-page-splitter.html (${(Buffer.byteLength(output) / 1024).toFixed(1)} KiB)`);
