import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix, rectangle, clip, endPath, beginText, endText, setFontAndSize, setTextMatrix, showText, setFillingRgbColor } from 'pdf-lib';

// A collection must become a standalone sfnt before FontFace and pdf-lib embed it.
export function standaloneFont(input, family = '') {
  const bytes = new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x74746366) return bytes;
  const collection = fontkit.create(bytes);
  const index = Math.max(0, collection.fonts.findIndex((font) => font.familyName === family || font.postscriptName === family));
  const offset = view.getUint32(12 + index * 4), count = view.getUint16(offset + 4);
  const headerSize = 12 + count * 16;
  let length = headerSize;
  for (let i = 0; i < count; i++) length += (view.getUint32(offset + 12 + i * 16 + 12) + 3) & ~3;
  const output = new Uint8Array(length), out = new DataView(output.buffer);
  output.set(bytes.slice(offset, offset + headerSize));
  let cursor = headerSize, headOffset = null;
  for (let i = 0; i < count; i++) {
    const entry = offset + 12 + i * 16, target = 12 + i * 16;
    const source = view.getUint32(entry + 8), size = view.getUint32(entry + 12);
    output.set(bytes.slice(source, source + size), cursor); out.setUint32(target + 8, cursor);
    if (view.getUint32(entry) === 0x68656164) headOffset = cursor;
    cursor += (size + 3) & ~3;
  }
  if (headOffset !== null) {
    out.setUint32(headOffset + 8, 0);
    let checksum = 0;
    for (let i = 0; i < output.length; i += 4) checksum = (checksum + out.getUint32(i)) >>> 0;
    out.setUint32(headOffset + 8, (0xb1b0afba - checksum) >>> 0);
  }
  return output;
}

export function fontRecord(bytes, family = '') {
  const data = standaloneFont(bytes, family);
  return { bytes: data, metrics: fontkit.create(data), cssFamily: '' };
}

export function layoutText(object, primary, fallback) {
  const size = object.fontSize, spacing = object.letterSpacing;
  const lineHeight = size * object.lineHeight;
  const items = [];
  let lineIndex = 0;
  for (const paragraph of (object.text || ' ').replace(/\t/g, '    ').split('\n')) {
    let x = 0;
    for (const char of paragraph) {
      const font = primary.metrics.hasGlyphForCodePoint(char.codePointAt(0)) ? primary : fallback;
      if (!font.metrics.hasGlyphForCodePoint(char.codePointAt(0))) throw new Error(`字型缺少「${char}」；請載入支援此字元的字型。`);
      const glyph = font.metrics.glyphForCodePoint(char.codePointAt(0));
      const advance = glyph.advanceWidth / font.metrics.unitsPerEm * size;
      if (x > 0 && x + advance > object.width + 0.001) { lineIndex++; x = 0; }
      const em = font.metrics.unitsPerEm;
      const baseline = lineIndex * lineHeight + (lineHeight - (font.metrics.ascent - font.metrics.descent) / em * size) / 2 + font.metrics.ascent / em * size;
      items.push({ char, x, baseline, font, glyph }); x += advance + spacing;
    }
    lineIndex++;
  }
  return items;
}

const color = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

export async function buildEditedPdf(bytes, pageIndex, viewport, objects, resolveFont, fallback) {
  const source = await PDFDocument.load(bytes);
  const doc = await PDFDocument.create();
  const [page] = await doc.copyPages(source, [pageIndex]); doc.addPage(page); doc.registerFontkit(fontkit);
  const embedded = new Map();
  const fontKeys = new Map();
  const layouts = new Map();
  for (const object of objects.filter((o) => o.type === 'text')) {
    const items = layoutText(object, resolveFont(object.fontFamily), fallback);
    layouts.set(object.id, items);
    for (const { font } of items) if (!embedded.has(font)) embedded.set(font, await doc.embedFont(font.bytes, { subset: false }));
  }
  for (const [font, pdfFont] of embedded) fontKeys.set(font, page.node.newFontDictionary(pdfFont.name, pdfFont.ref));
  // Invert PDF.js's viewport (including CropBox origin, UserUnit and rotation).
  const origin = viewport.convertToPdfPoint(0, viewport.height);
  const right = viewport.convertToPdfPoint(1, viewport.height);
  const up = viewport.convertToPdfPoint(0, viewport.height - 1);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(right[0] - origin[0], right[1] - origin[1], up[0] - origin[0], up[1] - origin[1], ...origin));
  for (const object of objects) {
    const ink = color(object.color), height = viewport.height;
    if (object.type === 'text') {
      page.pushOperators(pushGraphicsState(), rectangle(object.x, height - object.y - object.height, object.width, object.height), clip(), endPath());
      page.pushOperators(beginText(), setFillingRgbColor(ink.red, ink.green, ink.blue));
      for (const item of layouts.get(object.id)) page.pushOperators(setFontAndSize(fontKeys.get(item.font), object.fontSize), setTextMatrix(1, 0, 0, 1, object.x + item.x, height - object.y - item.baseline), showText(embedded.get(item.font).encodeText(item.char)));
      page.pushOperators(endText(), popGraphicsState());
    } else if (object.type === 'rect') {
      const stroke = Math.min(object.strokeWidth, object.width, object.height), inset = stroke / 2;
      page.drawRectangle({ x: object.x + inset, y: height - object.y - object.height + inset, width: object.width - stroke, height: object.height - stroke, borderWidth: stroke, borderColor: ink, ...(object.filled ? { color: ink } : {}) });
    } else page.drawLine({ start: { x: object.x, y: height - object.y }, end: { x: object.x + Math.cos(object.angle) * object.width, y: height - object.y - Math.sin(object.angle) * object.width }, thickness: object.strokeWidth, color: ink });
  }
  page.pushOperators(popGraphicsState());
  return doc.save();
}
