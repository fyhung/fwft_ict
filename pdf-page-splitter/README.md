# PDF Page Splitter

A private, browser-only tool that splits one PDF into one PDF per page and downloads the results as a ZIP.

## Use it

Open `pdf-page-splitter.html` in a modern browser. No server or internet connection is required.

## Rebuild the single HTML

```powershell
npm install
npm run build
npm run check
```

The distributable HTML embeds the interface, application code, pdf-lib, and JSZip. Source PDF data never leaves the browser.

## First-version limitations

- Password-protected PDFs are not supported.
- Large documents can require substantial browser memory.
- Each output file contains exactly one source page; interactive document-level features may not carry over.
