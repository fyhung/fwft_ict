(() => {
  "use strict";

  const slots = [...document.querySelectorAll(".frame-slot")];
  const frames = new Array(4).fill(null);
  const fpsSlider = document.querySelector("#fpsSlider");
  const fpsValue = document.querySelector("#fpsValue");
  const widthInput = document.querySelector("#widthInput");
  const heightInput = document.querySelector("#heightInput");
  const imageCount = document.querySelector("#imageCount");
  const createButton = document.querySelector("#createButton");
  const resetButton = document.querySelector("#resetButton");
  const statusText = document.querySelector("#statusText");
  const gifPreview = document.querySelector("#gifPreview");
  const emptyPreview = document.querySelector("#emptyPreview");
  const downloadButton = document.querySelector("#downloadButton");
  const resultMeta = document.querySelector("#resultMeta");
  let resultUrl = "";
  let sizeInitialized = false;

  slots.forEach((slot, index) => {
    const input = slot.querySelector("input");
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) loadFrame(file, index);
    });
  });

  fpsSlider.addEventListener("input", () => {
    fpsValue.textContent = fpsSlider.value;
    invalidateResult("速度已更改，請重新製作 GIF");
  });
  [widthInput, heightInput].forEach((input) => {
    input.addEventListener("input", () => invalidateResult("尺寸已更改，請重新製作 GIF"));
  });

  resetButton.addEventListener("click", resetAll);
  createButton.addEventListener("click", createGif);

  async function loadFrame(file, index) {
    if (!file.type.startsWith("image/")) {
      showStatus("請選擇 PNG、JPG、WebP 或 GIF 圖片。", true);
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();

      if (frames[index]) URL.revokeObjectURL(frames[index].url);
      frames[index] = { image, url, name: file.name };
      if (!sizeInitialized) {
        const suggested = fitWithin(image.naturalWidth, image.naturalHeight, 900);
        widthInput.value = suggested.width;
        heightInput.value = suggested.height;
        sizeInitialized = true;
      }
      const slot = slots[index];
      slot.querySelector("img").src = url;
      slot.classList.add("has-image");
      updateReadyState();
      invalidateResult(frames.every(Boolean) ? "已選好 4 張圖片，可以開始製作" : "繼續加入圖片");
    } catch (error) {
      showStatus("這張圖片無法讀取，請試用另一個檔案。", true);
    }
  }

  function updateReadyState() {
    const count = frames.filter(Boolean).length;
    imageCount.textContent = `${count} / 4`;
    createButton.disabled = count !== 4;
    resetButton.disabled = count === 0;
    if (count < 4) showStatus(`還需要 ${4 - count} 張圖片`);
  }

  function invalidateResult(message) {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = "";
    }
    gifPreview.removeAttribute("src");
    gifPreview.classList.remove("is-visible");
    emptyPreview.hidden = false;
    downloadButton.removeAttribute("href");
    downloadButton.setAttribute("aria-disabled", "true");
    resultMeta.textContent = "";
    if (message) showStatus(message);
  }

  async function createGif() {
    if (!frames.every(Boolean)) return;
    setWorking(true);
    showStatus("正在製作，請稍候…");

    try {
      await nextPaint();
      const fps = Number(fpsSlider.value);
      const size = {
        width: Math.round(Number(widthInput.value)),
        height: Math.round(Number(heightInput.value))
      };
      if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 1 || size.height < 1 || size.width > 1200 || size.height > 1200) {
        throw new RangeError("Invalid output size");
      }
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const indexedFrames = [];

      for (const frame of frames) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        const placement = contain(frame.image.naturalWidth, frame.image.naturalHeight, size.width, size.height);
        context.drawImage(frame.image, placement.x, placement.y, placement.width, placement.height);
        const pixels = context.getImageData(0, 0, size.width, size.height).data;
        indexedFrames.push(quantizeAdaptive(pixels, size.width, size.height));
        await nextPaint();
      }

      const bytes = encodeGif(size.width, size.height, indexedFrames, fps);
      const blob = new Blob([bytes], { type: "image/gif" });
      invalidateResult();
      resultUrl = URL.createObjectURL(blob);
      gifPreview.src = resultUrl;
      gifPreview.classList.add("is-visible");
      emptyPreview.hidden = true;
      downloadButton.href = resultUrl;
      downloadButton.setAttribute("aria-disabled", "false");
      resultMeta.textContent = `${size.width} × ${size.height} · ${formatBytes(blob.size)}`;
      showStatus("完成！可先預覽，再下載 GIF。");
    } catch (error) {
      console.error(error);
      showStatus("製作失敗。可嘗試使用尺寸較小的圖片。", true);
    } finally {
      setWorking(false);
    }
  }

  function setWorking(working) {
    createButton.disabled = working;
    createButton.classList.toggle("is-working", working);
    createButton.querySelector("span").textContent = working ? "製作中…" : "製作 GIF";
    slots.forEach((slot) => { slot.style.pointerEvents = working ? "none" : ""; });
    fpsSlider.disabled = working;
    widthInput.disabled = working;
    heightInput.disabled = working;
    resetButton.disabled = working || frames.every((frame) => !frame);
  }

  function resetAll() {
    frames.forEach((frame, index) => {
      if (frame) URL.revokeObjectURL(frame.url);
      frames[index] = null;
      slots[index].classList.remove("has-image");
      slots[index].querySelector("input").value = "";
      slots[index].querySelector("img").removeAttribute("src");
    });
    invalidateResult();
    sizeInitialized = false;
    updateReadyState();
  }

  function showStatus(message, isError = false) {
    statusText.textContent = message || "";
    statusText.classList.toggle("error", isError);
  }

  function fitWithin(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  }

  function contain(sourceWidth, sourceHeight, targetWidth, targetHeight) {
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    return { width, height, x: Math.floor((targetWidth - width) / 2), y: Math.floor((targetHeight - height) / 2) };
  }

  function quantizeAdaptive(rgba, width, height) {
    const histogram = new Uint32Array(32768);
    for (let offset = 0; offset < rgba.length; offset += 4) {
      const key = ((rgba[offset] >> 3) << 10) | ((rgba[offset + 1] >> 3) << 5) | (rgba[offset + 2] >> 3);
      histogram[key] += 1;
    }

    const colors = [];
    for (let key = 0; key < histogram.length; key += 1) {
      if (histogram[key]) colors.push(key);
    }

    let boxes = [makeColorBox(colors, histogram)];
    while (boxes.length < 256) {
      let splitIndex = -1;
      let bestScore = -1;
      for (let index = 0; index < boxes.length; index += 1) {
        const box = boxes[index];
        if (box.colors.length < 2) continue;
        const range = Math.max(box.rMax - box.rMin, box.gMax - box.gMin, box.bMax - box.bMin);
        const score = range * Math.sqrt(box.total);
        if (score > bestScore) {
          bestScore = score;
          splitIndex = index;
        }
      }
      if (splitIndex < 0) break;
      const box = boxes[splitIndex];
      const rRange = box.rMax - box.rMin;
      const gRange = box.gMax - box.gMin;
      const bRange = box.bMax - box.bMin;
      const shift = gRange >= rRange && gRange >= bRange ? 5 : (rRange >= bRange ? 10 : 0);
      box.colors.sort((a, b) => ((a >> shift) & 31) - ((b >> shift) & 31));
      let running = 0;
      let cut = 1;
      for (; cut < box.colors.length; cut += 1) {
        running += histogram[box.colors[cut - 1]];
        if (running >= box.total / 2) break;
      }
      cut = Math.min(cut, box.colors.length - 1);
      const left = box.colors.slice(0, cut);
      const right = box.colors.slice(cut);
      boxes.splice(splitIndex, 1, makeColorBox(left, histogram), makeColorBox(right, histogram));
    }

    const palette = new Uint8Array(256 * 3);
    boxes.forEach((box, index) => {
      let red = 0;
      let green = 0;
      let blue = 0;
      let weight = 0;
      box.colors.forEach((key) => {
        const count = histogram[key];
        red += ((key >> 10) & 31) * count;
        green += ((key >> 5) & 31) * count;
        blue += (key & 31) * count;
        weight += count;
      });
      palette[index * 3] = Math.round((red / weight) * 255 / 31);
      palette[index * 3 + 1] = Math.round((green / weight) * 255 / 31);
      palette[index * 3 + 2] = Math.round((blue / weight) * 255 / 31);
    });

    const lookup = new Int16Array(32768);
    lookup.fill(-1);
    const indexed = new Uint8Array(width * height);
    let currentErrors = new Float32Array((width + 2) * 3);
    let nextErrors = new Float32Array((width + 2) * 3);
    const clamp = (value) => Math.max(0, Math.min(255, value));

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const source = (y * width + x) * 4;
        const errorIndex = (x + 1) * 3;
        const red = clamp(rgba[source] + currentErrors[errorIndex]);
        const green = clamp(rgba[source + 1] + currentErrors[errorIndex + 1]);
        const blue = clamp(rgba[source + 2] + currentErrors[errorIndex + 2]);
        const key = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
        let paletteIndex = lookup[key];
        if (paletteIndex < 0) {
          let bestDistance = Infinity;
          paletteIndex = 0;
          for (let candidate = 0; candidate < boxes.length; candidate += 1) {
            const paletteOffset = candidate * 3;
            const dr = red - palette[paletteOffset];
            const dg = green - palette[paletteOffset + 1];
            const db = blue - palette[paletteOffset + 2];
            const distance = dr * dr * 2 + dg * dg * 4 + db * db;
            if (distance < bestDistance) {
              bestDistance = distance;
              paletteIndex = candidate;
            }
          }
          lookup[key] = paletteIndex;
        }
        indexed[y * width + x] = paletteIndex;

        const paletteOffset = paletteIndex * 3;
        const redError = red - palette[paletteOffset];
        const greenError = green - palette[paletteOffset + 1];
        const blueError = blue - palette[paletteOffset + 2];
        for (let channel = 0; channel < 3; channel += 1) {
          const error = channel === 0 ? redError : (channel === 1 ? greenError : blueError);
          currentErrors[errorIndex + 3 + channel] += error * 7 / 16;
          nextErrors[errorIndex - 3 + channel] += error * 3 / 16;
          nextErrors[errorIndex + channel] += error * 5 / 16;
          nextErrors[errorIndex + 3 + channel] += error / 16;
        }
      }
      currentErrors = nextErrors;
      nextErrors = new Float32Array((width + 2) * 3);
    }
    return { pixels: indexed, palette };
  }

  function makeColorBox(colors, histogram) {
    let rMin = 31, gMin = 31, bMin = 31;
    let rMax = 0, gMax = 0, bMax = 0;
    let total = 0;
    colors.forEach((key) => {
      const red = (key >> 10) & 31;
      const green = (key >> 5) & 31;
      const blue = key & 31;
      rMin = Math.min(rMin, red); rMax = Math.max(rMax, red);
      gMin = Math.min(gMin, green); gMax = Math.max(gMax, green);
      bMin = Math.min(bMin, blue); bMax = Math.max(bMax, blue);
      total += histogram[key];
    });
    return { colors, total, rMin, rMax, gMin, gMax, bMin, bMax };
  }

  function encodeGif(width, height, indexedFrames, fps) {
    const output = [];
    const writeByte = (value) => output.push(value & 255);
    const writeShort = (value) => { writeByte(value); writeByte(value >> 8); };
    const writeString = (value) => { for (let i = 0; i < value.length; i += 1) writeByte(value.charCodeAt(i)); };

    writeString("GIF89a");
    writeShort(width);
    writeShort(height);
    writeByte(0x70);
    writeByte(0);
    writeByte(0);

    writeByte(0x21); writeByte(0xff); writeByte(11); writeString("NETSCAPE2.0");
    writeByte(3); writeByte(1); writeShort(0); writeByte(0);

    const delay = Math.max(2, Math.round(100 / fps));
    indexedFrames.forEach((frame) => {
      writeByte(0x21); writeByte(0xf9); writeByte(4); writeByte(0x04); writeShort(delay); writeByte(0); writeByte(0);
      writeByte(0x2c); writeShort(0); writeShort(0); writeShort(width); writeShort(height); writeByte(0x87);
      for (const value of frame.palette) writeByte(value);
      writeByte(8);
      const compressed = lzwCompress(frame.pixels);
      for (let offset = 0; offset < compressed.length; offset += 255) {
        const block = compressed.subarray(offset, offset + 255);
        writeByte(block.length);
        for (const value of block) writeByte(value);
      }
      writeByte(0);
    });

    writeByte(0x3b);
    return new Uint8Array(output);
  }

  function lzwCompress(pixels) {
    const clearCode = 256;
    const endCode = 257;
    const bytes = [];
    let bitBuffer = 0;
    let bitCount = 0;
    let codeSize = 9;
    let nextCode = 258;
    let dictionary = new Map();

    const writeCode = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        bytes.push(bitBuffer & 255);
        bitBuffer >>>= 8;
        bitCount -= 8;
      }
    };

    const reset = () => {
      dictionary = new Map();
      codeSize = 9;
      nextCode = 258;
    };

    writeCode(clearCode);
    let prefix = pixels[0];

    for (let index = 1; index < pixels.length; index += 1) {
      const suffix = pixels[index];
      const key = prefix * 256 + suffix;
      const existing = dictionary.get(key);
      if (existing !== undefined) {
        prefix = existing;
      } else {
        writeCode(prefix);
        if (nextCode < 4096) {
          dictionary.set(key, nextCode);
          nextCode += 1;
          // GIF decoders add dictionary entries one emitted code behind the encoder.
          // Delay the bit-width increase by one code so both sides stay aligned.
          if (nextCode === (1 << codeSize) + 1 && codeSize < 12) codeSize += 1;
        } else {
          writeCode(clearCode);
          reset();
        }
        prefix = suffix;
      }
    }

    writeCode(prefix);
    writeCode(endCode);
    if (bitCount > 0) bytes.push(bitBuffer & 255);
    return new Uint8Array(bytes);
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }
})();
