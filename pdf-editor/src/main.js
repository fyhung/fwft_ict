import './styles.css';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';
import { fontRecord, layoutText, buildEditedPdf } from './pdf-layout.js';
import notoSansTcUrl from './assets/NotoSansTC-VF.ttf?url';
import notoSerifTcUrl from './assets/NotoSerifTC-VF.ttf?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([pdfWorkerSource], { type: 'text/javascript' })
);

const $ = (s) => document.querySelector(s);
const fontRecords = new Map();
let fallbackSans, fallbackSerif;
async function registerFont(key, bytes, family = '') {
  const record = fontRecord(bytes, family);
  fontRecords.set(key, record); return record;
}
const fontsReady = (async () => {
  const [sans, serif] = await Promise.all([fetch(notoSansTcUrl).then((r) => r.arrayBuffer()), fetch(notoSerifTcUrl).then((r) => r.arrayBuffer())]);
  fallbackSans = await registerFont('sans', sans); fallbackSerif = await registerFont('serif', serif);
})();
function resolveFont(key) {
  return fontRecords.get(key) || (/Times|Georgia|PMingLiU|MingLiU|BiauKai|DFKai/i.test(key) ? fallbackSerif : fallbackSans);
}
function updateFontLabels() {
  for (const option of $('#prop-font-family').options) {
    option.dataset.label ||= option.textContent;
    const exact = fontRecords.has(option.value) || option.value.startsWith("'Noto Sans TC'");
    option.textContent = exact ? option.dataset.label : `${option.dataset.label}（內建${resolveFont(option.value) === fallbackSerif ? '明體' : '黑體'}替代）`;
  }
}
fontsReady.then(() => { updateFontLabels(); renderObjects(); }).catch((error) => { console.error(error); notify('內建字型無法載入，請重新整理'); });
const els = {
  input: $('#pdf-input'), open: $('#open-pdf-btn'), choose: $('#choose-pdf-btn'), download: $('#download-btn'), thumbnails: $('#thumbnails'), pageCount: $('#page-count'),
  zoomOut: $('#zoom-out-btn'), zoomIn: $('#zoom-in-btn'), zoomReset: $('#zoom-reset-btn'), zoomValue: $('#zoom-value'),
  empty: $('#empty-state'), stage: $('#page-stage'), canvas: $('#pdf-canvas'), layer: $('#objects-layer'), preview: $('#draw-preview'),
  status: $('#status-text'), toolbar: $('#toolbar'), quickColor: $('#quick-color'), delete: $('#delete-btn'),
  props: $('#properties'), noSelection: $('#no-selection'), propsPanel: $('.properties-panel'), objectType: $('#object-type'),
  textField: $('#text-content-field'), text: $('#prop-text'), fontField: $('#font-family-field'), font: $('#prop-font-family'),
  textNumbers: $('#text-number-fields'), fontSize: $('#prop-font-size'), letterSpacing: $('#prop-letter-spacing'), lineHeight: $('#prop-line-height'),
  color: $('#prop-color'), colorValue: $('#color-value'), fillField: $('#fill-enabled-field'), fill: $('#prop-fill-enabled'), strokeField: $('#stroke-width-field'), stroke: $('#prop-stroke-width'), strokeValue: $('#stroke-value'),
  duplicate: $('#duplicate-btn'), toast: $('#toast')
};

els.open.addEventListener('click', () => els.input.click());
els.choose.addEventListener('click', () => els.input.click());

const state = { pdf: null, bytes: null, name: '', page: 1, tool: 'select', selected: null, objects: new Map(), rendering: false, draw: null, drag: null, resize: null, pan: null, renderScale: 1, viewScale: 1, zoom: 1, baseWidth: 0, baseHeight: 0, viewport: null };
const pageObjects = () => state.objects.get(state.page) || [];
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function notify(message) {
  els.toast.textContent = message; els.toast.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function setTool(tool) {
  state.tool = tool;
  els.toolbar.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  els.layer.dataset.tool = tool;
}

function fitViewport(page) {
  const raw = page.getViewport({ scale: 1 });
  const shell = $('#canvas-shell');
  const maxW = Math.max(280, shell.clientWidth - 76);
  const maxH = Math.max(300, shell.clientHeight - 76);
  return page.getViewport({ scale: Math.min(maxW / raw.width, maxH / raw.height, 1.45) });
}

async function renderPage(pageNumber) {
  if (!state.pdf || state.rendering) return;
  state.rendering = true; state.page = pageNumber; selectObject(null);
  try {
    const page = await state.pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 }); state.viewport = baseViewport;
    state.baseWidth = baseViewport.width; state.baseHeight = baseViewport.height;
    state.viewScale = fitViewport(page).scale * state.zoom;
    const viewport = page.getViewport({ scale: state.viewScale }); state.renderScale = viewport.scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.floor(viewport.width * dpr); els.canvas.height = Math.floor(viewport.height * dpr);
    els.canvas.style.width = `${viewport.width}px`; els.canvas.style.height = `${viewport.height}px`;
    els.stage.style.width = `${viewport.width}px`; els.stage.style.height = `${viewport.height}px`;
    await page.render({ canvasContext: els.canvas.getContext('2d'), viewport: page.getViewport({ scale: viewport.scale * dpr }) }).promise;
    renderObjects();
    document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('active', Number(t.dataset.page) === pageNumber));
    els.status.textContent = `${state.name} · 第 ${pageNumber} / ${state.pdf.numPages} 頁`;
  } finally { state.rendering = false; }
}

async function makeThumbnail(pageNumber) {
  const button = document.createElement('button'); button.className = 'thumb'; button.dataset.page = pageNumber;
  const canvas = document.createElement('canvas'); const label = document.createElement('span'); label.textContent = `第 ${pageNumber} 頁`;
  button.append(canvas, label); button.addEventListener('click', () => renderPage(pageNumber)); els.thumbnails.append(button);
  const page = await state.pdf.getPage(pageNumber); const raw = page.getViewport({ scale: 1 }); const viewport = page.getViewport({ scale: Math.min(118 / raw.width, 140 / raw.height) });
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
}

els.input.addEventListener('change', async () => {
  const file = els.input.files?.[0]; if (!file) return;
  try {
    els.status.textContent = '正在開啟文件…';
    await fontsReady;
    state.bytes = new Uint8Array(await file.arrayBuffer()); state.name = file.name;
    state.pdf = await pdfjsLib.getDocument({ data: state.bytes.slice() }).promise;
    state.objects.clear(); state.zoom = 1; updateZoomControls(); els.thumbnails.replaceChildren();
    els.empty.hidden = true; els.stage.hidden = false; els.download.disabled = false; els.zoomOut.disabled = false; els.zoomIn.disabled = false; els.zoomReset.disabled = false;
    els.pageCount.textContent = `${state.pdf.numPages} 頁`;
    await renderPage(1);
    for (let i = 1; i <= state.pdf.numPages; i++) await makeThumbnail(i);
    notify('PDF 已在本機開啟');
  } catch (error) {
    console.error(error); els.status.textContent = '無法開啟這份 PDF'; notify('PDF 無法讀取，請嘗試其他檔案');
  } finally { els.input.value = ''; }
});

function stagePoint(event) {
  const r = els.stage.getBoundingClientRect();
  return { x: Math.max(0, Math.min(state.baseWidth, (event.clientX - r.left) / state.viewScale)), y: Math.max(0, Math.min(state.baseHeight, (event.clientY - r.top) / state.viewScale)) };
}

function createObject(type, props = {}) {
  const base = { id: uid(), type, x: 60, y: 60, color: els.quickColor.value, strokeWidth: 3, filled: false };
  const object = type === 'text'
    ? { ...base, text: '在此輸入文字', width: 220, height: 100, fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif", fontSize: 24, letterSpacing: 0, lineHeight: 1.35, ...props }
    : { ...base, width: 120, height: type === 'rect' ? 70 : 0, angle: type === 'line' ? 0 : undefined, ...props };
  if (!state.objects.has(state.page)) state.objects.set(state.page, []);
  state.objects.get(state.page).push(object); renderObjects(); selectObject(object.id); return object;
}

function objectElement(object) {
  const el = document.createElement('div'); el.className = `object ${object.type}-object${state.selected === object.id ? ' selected' : ''}`; el.dataset.id = object.id;
  const z = state.viewScale; el.style.left = `${object.x * z}px`; el.style.top = `${object.y * z}px`;
  if (object.type === 'rect') {
    el.style.width = `${object.width * z}px`; el.style.height = `${object.height * z}px`; el.style.borderColor = object.color; el.style.borderWidth = `${object.strokeWidth * z}px`; el.style.background = object.filled ? object.color : 'transparent';
  } else if (object.type === 'line') {
    el.style.width = `${object.width * z}px`; el.style.height = '12px'; el.style.top = `${object.y * z - 6}px`; el.style.transformOrigin = '0 6px'; el.style.transform = `rotate(${object.angle}rad)`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.style.overflow = 'visible'; svg.setAttribute('width', object.width * z); svg.setAttribute('height', 12);
    const line = document.createElementNS(svg.namespaceURI, 'line'); line.setAttribute('x1', 0); line.setAttribute('y1', 6); line.setAttribute('x2', object.width * z); line.setAttribute('y2', 6); line.setAttribute('stroke', object.color); line.setAttribute('stroke-width', object.strokeWidth * z); svg.append(line); el.append(svg);
  } else {
    el.style.width = `${object.width * z}px`; el.style.height = `${object.height * z}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('viewBox', `0 0 ${object.width} ${object.height}`); svg.style.overflow = 'hidden';
    if (fallbackSans) for (const item of layoutText(object, resolveFont(object.fontFamily), fallbackSans)) {
      // Draw the same glyph outlines that the embedded PDF font uses. This also
      // works for older local TTC fonts rejected by the browser's font loader.
      const path = document.createElementNS(svg.namespaceURI, 'path');
      const scale = object.fontSize / item.font.metrics.unitsPerEm;
      path.setAttribute('d', item.glyph.path.toSVG()); path.setAttribute('transform', `translate(${item.x} ${item.baseline}) scale(${scale} ${-scale})`); path.setAttribute('fill', object.color); svg.append(path);
    }
    el.append(svg);
  }
  if (state.selected === object.id && object.type !== 'line') {
    for (const corner of ['nw', 'ne', 'sw', 'se']) {
      const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'resize-handle'; handle.dataset.corner = corner;
      handle.setAttribute('aria-label', `調整${object.type === 'text' ? '文字方塊' : '矩形'}${corner}角`); handle.addEventListener('pointerdown', (event) => startResize(event, object, corner)); el.append(handle);
    }
  }
  el.addEventListener('pointerdown', (event) => startDrag(event, object));
  el.addEventListener('dblclick', () => { if (object.type === 'text') { selectObject(object.id); els.text.focus(); els.text.select(); } });
  return el;
}

function renderObjects() { els.layer.replaceChildren(...pageObjects().map(objectElement)); }

function selectObject(id) {
  state.selected = id; renderObjects();
  const object = pageObjects().find((o) => o.id === id);
  els.delete.disabled = !object; els.props.hidden = !object; els.noSelection.hidden = Boolean(object); els.propsPanel.classList.toggle('has-selection', Boolean(object));
  if (!object) return;
  const isText = object.type === 'text'; els.objectType.textContent = isText ? '文字方塊' : object.type === 'rect' ? '矩形' : '直線';
  els.textField.hidden = !isText; els.fontField.hidden = !isText; els.textNumbers.hidden = !isText; els.strokeField.hidden = isText; els.fillField.hidden = object.type !== 'rect';
  $('#local-font-controls').hidden = !isText;
  els.text.value = object.text || ''; els.font.value = object.fontFamily || els.font.value; els.fontSize.value = object.fontSize || 24;
  els.fontSize.step = object.fontSize < 10 ? '0.5' : '1';
  els.letterSpacing.value = object.letterSpacing ?? 0; els.lineHeight.value = object.lineHeight || 1.35;
  els.color.value = object.color; els.colorValue.value = object.color; els.fill.checked = Boolean(object.filled); els.stroke.value = object.strokeWidth || 3; els.strokeValue.textContent = `${object.strokeWidth || 3} px`;
}

function selectedObject() { return pageObjects().find((o) => o.id === state.selected); }
function updateSelected(patch) { const o = selectedObject(); if (!o) return; Object.assign(o, patch); renderObjects(); }

function startDrag(event, object) {
  if (state.tool !== 'select') return;
  event.preventDefault(); event.stopPropagation(); els.layer.setPointerCapture(event.pointerId); selectObject(object.id);
  const p = stagePoint(event); state.drag = { id: object.id, dx: p.x - object.x, dy: p.y - object.y };
}
function startResize(event, object, corner) {
  event.preventDefault(); event.stopPropagation(); els.layer.setPointerCapture(event.pointerId); selectObject(object.id);
  const start = stagePoint(event);
  state.resize = { id: object.id, corner, start, original: { x: object.x, y: object.y, width: object.width, height: object.height } };
}
function resizeSelected(event) {
  if (!state.resize) return;
  const object = selectedObject(); if (!object) return;
  const point = stagePoint(event); const dx = point.x - state.resize.start.x; const dy = point.y - state.resize.start.y;
  const original = state.resize.original; const corner = state.resize.corner; const min = 12;
  if (corner.includes('e')) object.width = Math.max(min, original.width + dx);
  if (corner.includes('s')) object.height = Math.max(min, original.height + dy);
  if (corner.includes('w')) { const width = Math.max(min, original.width - dx); object.x = original.x + original.width - width; object.width = width; }
  if (corner.includes('n')) { const height = Math.max(min, original.height - dy); object.y = original.y + original.height - height; object.height = height; }
  if (object.x < 0) { object.width += object.x; object.x = 0; }
  if (object.y < 0) { object.height += object.y; object.y = 0; }
  object.width = Math.min(object.width, state.baseWidth - object.x); object.height = Math.min(object.height, state.baseHeight - object.y);
  renderObjects();
}
window.addEventListener('pointermove', resizeSelected);
window.addEventListener('pointerup', () => { state.resize = null; });
window.addEventListener('pointercancel', () => { state.resize = null; });
els.layer.addEventListener('pointermove', (event) => {
  if (state.pan) {
    const shell = $('#canvas-shell');
    shell.scrollLeft = state.pan.scrollLeft - (event.clientX - state.pan.x);
    shell.scrollTop = state.pan.scrollTop - (event.clientY - state.pan.y);
    return;
  }
  if (!state.drag) return; const o = selectedObject(); const p = stagePoint(event);
  o.x = Math.max(0, Math.min(state.baseWidth - 12, p.x - state.drag.dx)); o.y = Math.max(0, Math.min(state.baseHeight - 12, p.y - state.drag.dy)); renderObjects();
});
function stopPointerAction() {
  state.drag = null; state.pan = null; els.layer.classList.remove('panning');
}
els.layer.addEventListener('pointerup', stopPointerAction);
els.layer.addEventListener('pointercancel', stopPointerAction);

els.layer.addEventListener('pointerdown', (event) => {
  if (event.target !== els.layer && (state.tool === 'select' || !event.target.closest('.object'))) return;
  const p = stagePoint(event);
  if (state.tool === 'select') {
    const shell = $('#canvas-shell');
    selectObject(null); state.pan = { x: event.clientX, y: event.clientY, scrollLeft: shell.scrollLeft, scrollTop: shell.scrollTop };
    els.layer.classList.add('panning'); els.layer.setPointerCapture(event.pointerId); event.preventDefault(); return;
  }
  if (state.tool === 'text') { createObject('text', { x: p.x, y: p.y }); setTool('select'); setTimeout(() => els.text.focus(), 0); return; }
  state.draw = { type: state.tool, start: p, current: p }; els.layer.setPointerCapture(event.pointerId); drawPreview();
});
els.layer.addEventListener('pointermove', (event) => { if (state.draw) { state.draw.current = stagePoint(event); drawPreview(); } });
els.layer.addEventListener('pointerup', (event) => {
  if (!state.draw) return; const { type, start, current } = state.draw; state.draw = null; els.preview.hidden = true; els.preview.replaceChildren();
  const dx = current.x - start.x, dy = current.y - start.y;
  if (Math.hypot(dx, dy) < 6) return;
  if (type === 'rect') createObject(type, { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(dx), height: Math.abs(dy) });
  else createObject(type, { x: start.x, y: start.y, width: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) });
  setTool('select');
});

function drawPreview() {
  const { type, start, current } = state.draw; const dx = current.x - start.x, dy = current.y - start.y;
  const z = state.viewScale; const shape = document.createElement('div'); shape.className = 'preview-shape'; shape.style.left = `${(type === 'rect' ? Math.min(start.x, current.x) : start.x) * z}px`; shape.style.top = `${(type === 'rect' ? Math.min(start.y, current.y) : start.y) * z}px`;
  shape.style.borderColor = els.quickColor.value;
  if (type === 'rect') { shape.style.width = `${Math.abs(dx) * z}px`; shape.style.height = `${Math.abs(dy) * z}px`; shape.style.borderStyle = 'solid'; shape.style.borderWidth = `${3 * z}px`; }
  else { shape.style.width = `${Math.hypot(dx, dy) * z}px`; shape.style.borderTop = `${3 * z}px solid ${els.quickColor.value}`; shape.style.transformOrigin = '0 50%'; shape.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`; }
  els.preview.replaceChildren(shape); els.preview.hidden = false;
}

els.toolbar.addEventListener('click', (event) => { const button = event.target.closest('[data-tool]'); if (button) setTool(button.dataset.tool); });
els.delete.addEventListener('click', deleteSelected);
function deleteSelected() { if (!state.selected) return; state.objects.set(state.page, pageObjects().filter((o) => o.id !== state.selected)); selectObject(null); }
els.duplicate.addEventListener('click', () => { const o = selectedObject(); if (o) createObject(o.type, { ...structuredClone(o), id: uid(), x: o.x + 14, y: o.y + 14 }); });

const bindings = [
  [els.text, 'input', () => ({ text: els.text.value })], [els.font, 'change', () => ({ fontFamily: els.font.value })],
  [els.fontSize, 'input', () => { const size = Number(els.fontSize.value); els.fontSize.step = size < 10 ? '0.5' : '1'; return Number.isFinite(size) && size >= 3 && size <= 144 ? { fontSize: size } : {}; }], [els.letterSpacing, 'input', () => ({ letterSpacing: Number(els.letterSpacing.value) })],
  [els.lineHeight, 'input', () => ({ lineHeight: Number(els.lineHeight.value) })],
  [els.color, 'input', () => { els.colorValue.value = els.color.value; els.quickColor.value = els.color.value; return { color: els.color.value }; }],
  [els.fill, 'change', () => ({ filled: els.fill.checked })],
  [els.stroke, 'input', () => { els.strokeValue.textContent = `${els.stroke.value} px`; return { strokeWidth: Number(els.stroke.value) }; }]
];
bindings.forEach(([el, name, value]) => el.addEventListener(name, () => updateSelected(value())));

function stepFontSize(direction) {
  const current = Number(els.fontSize.value);
  const step = current < 10 || current === 10 && direction < 0 ? 0.5 : 1;
  els.fontSize.value = Math.max(3, Math.min(144, current + direction * step));
  els.fontSize.dispatchEvent(new Event('input'));
}
document.querySelectorAll('[data-font-step]').forEach((button) => button.addEventListener('click', () => stepFontSize(Number(button.dataset.fontStep))));
els.fontSize.addEventListener('keydown', (event) => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault(); stepFontSize(event.key === 'ArrowUp' ? 1 : -1);
});
els.fontSize.addEventListener('change', () => {
  const value = Number(els.fontSize.value);
  els.fontSize.value = Math.max(3, Math.min(144, Number.isFinite(value) ? value : 3));
  els.fontSize.dispatchEvent(new Event('input'));
});

$('#load-local-fonts').addEventListener('click', async () => {
  if (!window.queryLocalFonts) { notify('此瀏覽器未支援本機字型；請匯入 TTF、OTF 或 TTC 字型檔'); return; }
  try {
    const available = await window.queryLocalFonts(); await fontsReady;
    let count = 0;
    for (const option of els.font.options) {
      const family = option.value.split(',')[0].replaceAll("'", '').trim();
      const candidates = available.filter((font) => font.family === family || font.postscriptName === family);
      const local = candidates.find((font) => /Regular|Normal|Roman/i.test(font.style)) || candidates[0];
      if (local) { try { await registerFont(option.value, await (await local.blob()).arrayBuffer(), family); count++; } catch (error) { console.warn('字型無法嵌入', family, error); } }
    }
    updateFontLabels(); renderObjects(); notify(count ? `已載入 ${count} 種本機字型，預覽及 PDF 已同步` : '找不到所列字型，請匯入字型檔');
  } catch (error) { console.error(error); notify('未取得字型存取權限；可改用匯入字型檔'); }
});
$('#import-font-btn').addEventListener('click', () => $('#font-input').click());
$('#font-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    await fontsReady;
    const key = els.font.value, family = key.split(',')[0].replaceAll("'", '').trim();
    await registerFont(key, await file.arrayBuffer(), family);
    updateFontLabels(); renderObjects(); notify(`已套用 ${file.name}，預覽及 PDF 已同步`);
  } catch (error) { console.error(error); notify('無法載入字型，請選擇有效的 TTF、OTF 或 TTC 檔案'); }
  finally { event.target.value = ''; }
});

function updateZoomControls() {
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  els.zoomOut.disabled = !state.pdf || state.zoom <= 0.5;
  els.zoomIn.disabled = !state.pdf || state.zoom >= 5;
  els.zoomReset.disabled = !state.pdf;
}
async function setZoom(next) {
  if (!state.pdf || state.rendering) return;
  state.zoom = Math.max(0.5, Math.min(5, Math.round(next * 4) / 4));
  updateZoomControls(); await renderPage(state.page);
}
els.zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.25));
els.zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.25));
els.zoomReset.addEventListener('click', () => setZoom(1));

document.addEventListener('keydown', (event) => {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
  if (event.key.toLowerCase() === 'v') setTool('select'); if (event.key.toLowerCase() === 'r') setTool('rect');
  if (event.key.toLowerCase() === 'l') setTool('line'); if (event.key.toLowerCase() === 't') setTool('text');
});

async function exportPage() {
  if (!state.pdf) return;
  els.download.disabled = true; els.download.textContent = '正在製作…';
  try {
    await fontsReady;
    const result = await buildEditedPdf(state.bytes.slice(), state.page - 1, state.viewport, pageObjects(), resolveFont, fallbackSans);
    const blob = new Blob([result], { type: 'application/pdf' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${state.name.replace(/\.pdf$/i, '')}-第${state.page}頁.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已下載單頁 PDF');
  } catch (error) { console.error(error); notify(error.message || '製作 PDF 時發生問題'); }
  finally { els.download.disabled = false; els.download.textContent = '下載這一頁'; }
}
els.download.addEventListener('click', exportPage);
window.addEventListener('resize', () => { if (state.pdf) { clearTimeout(window.__resizeTimer); window.__resizeTimer = setTimeout(() => renderPage(state.page), 160); } });
