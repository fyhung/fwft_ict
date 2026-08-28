(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    fileInput: $("pdf-file"),
    dropZone: $("drop-zone"),
    fileSummary: $("file-summary"),
    fileName: $("file-name"),
    fileMeta: $("file-meta"),
    removeFile: $("remove-file"),
    fileWarning: $("file-warning"),
    namingCard: $("naming-card"),
    nameInstruction: $("name-instruction"),
    prefix: $("prefix"),
    names: $("names"),
    autoName: $("auto-name"),
    clearNames: $("clear-names"),
    nameStatus: $("name-status"),
    previewCount: $("preview-count"),
    namePreview: $("name-preview"),
    splitButton: $("split-button"),
    actionHelp: $("action-help"),
    progressWrap: $("progress-wrap"),
    progressBar: $("progress-bar"),
    progressText: $("progress-text"),
    message: $("message"),
  };

  const state = {
    file: null,
    bytes: null,
    sourcePdf: null,
    pageCount: 0,
    busy: false,
  };

  const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

  function sourceStem() {
    return (state.file?.name || "document").replace(/\.pdf$/i, "") || "document";
  }

  function cleanBaseName(value, fallback) {
    let name = String(value || "")
      .normalize("NFC")
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim();

    if (!name) name = fallback;
    if (RESERVED_WINDOWS_NAMES.test(name)) name = `_${name}`;
    return Array.from(name).slice(0, 170).join("");
  }

  function pastedLines() {
    const raw = ui.names.value.replace(/\r/g, "");
    if (!raw) return [];
    const lines = raw.split("\n");
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    return lines;
  }

  function buildNames() {
    const lines = pastedLines();
    const prefix = ui.prefix.value;
    const width = Math.max(3, String(state.pageCount).length);
    const used = new Set();
    const names = [];

    for (let i = 0; i < state.pageCount; i += 1) {
      const automatic = `${sourceStem()} - Page ${String(i + 1).padStart(width, "0")}`;
      const base = cleanBaseName(`${prefix}${lines[i]?.trim() || automatic}`, automatic);
      let uniqueBase = base;
      let suffix = 2;
      while (used.has(uniqueBase.toLocaleLowerCase())) {
        uniqueBase = `${base} (${suffix})`;
        suffix += 1;
      }
      used.add(uniqueBase.toLocaleLowerCase());
      names.push(`${uniqueBase}.pdf`);
    }
    return names;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = units[0];
    for (let i = 1; value >= 1024 && i < units.length; i += 1) {
      value /= 1024;
      unit = units[i];
    }
    return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
  }

  function setMessage(text = "", kind = "") {
    ui.message.hidden = !text;
    ui.message.textContent = text;
    ui.message.className = `notice${kind ? ` ${kind}` : ""}`;
  }

  function setBusy(busy) {
    state.busy = busy;
    ui.fileInput.disabled = busy;
    ui.removeFile.disabled = busy;
    ui.prefix.disabled = busy || !state.file;
    ui.names.disabled = busy || !state.file;
    ui.autoName.disabled = busy || !state.file;
    ui.clearNames.disabled = busy || !state.file || !ui.names.value;
    ui.splitButton.disabled = busy || !state.file;
  }

  function updatePreview() {
    if (!state.file) {
      ui.namePreview.replaceChildren();
      ui.previewCount.textContent = "";
      return;
    }

    const names = buildNames();
    const fragment = document.createDocumentFragment();
    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      fragment.append(item);
    });
    ui.namePreview.replaceChildren(fragment);
    ui.previewCount.textContent = `(${names.length})`;

    const entered = pastedLines().length;
    const extras = Math.max(0, entered - state.pageCount);
    ui.nameStatus.classList.toggle("has-warning", extras > 0);
    ui.nameStatus.textContent = extras
      ? `${entered} lines entered - ${extras} extra ${extras === 1 ? "line" : "lines"} will be ignored`
      : `${entered} of ${state.pageCount} names entered - blank lines use automatic names`;
    ui.clearNames.disabled = state.busy || !ui.names.value;
  }

  async function acceptFile(file) {
    if (!file) return;
    setMessage();

    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setMessage("Please choose a PDF file.", "error");
      return;
    }

    setBusy(true);
    ui.actionHelp.textContent = "Reading the PDF...";

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sourcePdf = await PDFLib.PDFDocument.load(bytes);
      const pageCount = sourcePdf.getPageCount();
      if (!pageCount) throw new Error("This PDF has no pages.");

      state.file = file;
      state.bytes = bytes;
      state.sourcePdf = sourcePdf;
      state.pageCount = pageCount;

      ui.dropZone.hidden = true;
      ui.fileSummary.hidden = false;
      ui.fileName.textContent = file.name;
      ui.fileMeta.textContent = `${pageCount} ${pageCount === 1 ? "page" : "pages"} · ${formatBytes(file.size)}`;
      ui.namingCard.classList.remove("is-disabled");
      ui.namingCard.setAttribute("aria-disabled", "false");
      ui.nameInstruction.textContent = `Paste up to ${pageCount} ${pageCount === 1 ? "name" : "names"}. Blank lines receive automatic names.`;
      ui.actionHelp.textContent = `${pageCount} one-page ${pageCount === 1 ? "PDF" : "PDFs"} will be placed in one ZIP.`;
      ui.fileWarning.hidden = file.size < 100 * 1024 * 1024;
      ui.fileWarning.textContent = ui.fileWarning.hidden
        ? ""
        : "Large PDFs may use substantial browser memory while the ZIP is created.";
      setBusy(false);
      updatePreview();
    } catch (error) {
      clearFile();
      const encrypted = /encrypt/i.test(String(error?.message));
      setMessage(encrypted ? "Password-protected PDFs are not supported in this first version." : `Could not read this PDF. ${error?.message || "The file may be damaged."}`, "error");
    }
  }

  function clearFile() {
    state.file = null;
    state.bytes = null;
    state.sourcePdf = null;
    state.pageCount = 0;
    state.busy = false;
    ui.fileInput.value = "";
    ui.dropZone.hidden = false;
    ui.fileSummary.hidden = true;
    ui.fileWarning.hidden = true;
    ui.namingCard.classList.add("is-disabled");
    ui.namingCard.setAttribute("aria-disabled", "true");
    ui.nameInstruction.textContent = "Choose a PDF first.";
    ui.prefix.value = "";
    ui.names.value = "";
    ui.nameStatus.textContent = "0 names entered";
    ui.nameStatus.classList.remove("has-warning");
    ui.namePreview.replaceChildren();
    ui.previewCount.textContent = "";
    ui.progressWrap.hidden = true;
    ui.progressBar.style.width = "0%";
    ui.actionHelp.textContent = "Select a PDF to begin.";
    setBusy(false);
  }

  function fillAutomaticNames() {
    const width = Math.max(3, String(state.pageCount).length);
    ui.names.value = Array.from({ length: state.pageCount }, (_, index) =>
      `${sourceStem()} - Page ${String(index + 1).padStart(width, "0")}`
    ).join("\n");
    updatePreview();
    ui.names.focus();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function yieldToBrowser() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function splitPdf() {
    if (!state.sourcePdf || state.busy) return;
    setMessage();
    setBusy(true);
    ui.progressWrap.hidden = false;
    ui.progressBar.style.width = "0%";

    try {
      const names = buildNames();
      const zip = new JSZip();

      for (let index = 0; index < state.pageCount; index += 1) {
        ui.progressText.textContent = `Creating page ${index + 1} of ${state.pageCount}...`;
        ui.progressBar.style.width = `${Math.round((index / state.pageCount) * 82)}%`;
        const outputPdf = await PDFLib.PDFDocument.create();
        const [page] = await outputPdf.copyPages(state.sourcePdf, [index]);
        outputPdf.addPage(page);
        const pdfBytes = await outputPdf.save();
        zip.file(names[index], pdfBytes, { binary: true });
        if (index % 2 === 0) await yieldToBrowser();
      }

      ui.progressText.textContent = "Packing the ZIP...";
      const blob = await zip.generateAsync(
        { type: "blob", compression: "STORE", platform: "DOS" },
        ({ percent }) => {
          ui.progressBar.style.width = `${82 + Math.round(percent * 0.18)}%`;
        }
      );

      const zipBase = cleanBaseName(`${sourceStem()} - split`, "split-pages");
      downloadBlob(blob, `${zipBase}.zip`);
      ui.progressBar.style.width = "100%";
      ui.progressText.textContent = "Download ready.";
      setMessage(`Done - created ${state.pageCount} ${state.pageCount === 1 ? "PDF" : "PDFs"} in ${zipBase}.zip.`);
    } catch (error) {
      ui.progressWrap.hidden = true;
      setMessage(`Could not split this PDF. ${error?.message || "Please try another file."}`, "error");
    } finally {
      setBusy(false);
    }
  }

  ui.fileInput.addEventListener("change", () => acceptFile(ui.fileInput.files[0]));
  ui.removeFile.addEventListener("click", () => { clearFile(); setMessage(); });
  ui.prefix.addEventListener("input", updatePreview);
  ui.names.addEventListener("input", updatePreview);
  ui.autoName.addEventListener("click", fillAutomaticNames);
  ui.clearNames.addEventListener("click", () => { ui.names.value = ""; updatePreview(); ui.names.focus(); });
  ui.splitButton.addEventListener("click", splitPdf);

  ["dragenter", "dragover"].forEach((eventName) => {
    ui.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    ui.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      ui.dropZone.classList.remove("is-dragging");
    });
  });
  ui.dropZone.addEventListener("drop", (event) => acceptFile(event.dataTransfer.files[0]));
})();
