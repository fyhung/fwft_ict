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
        indexedFrames.push(quantize332(pixels));
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

  function quantize332(rgba) {
    const result = new Uint8Array(rgba.length / 4);
    for (let source = 0, target = 0; source < rgba.length; source += 4, target += 1) {
      const alpha = rgba[source + 3] / 255;
      const red = Math.round(rgba[source] * alpha + 255 * (1 - alpha));
      const green = Math.round(rgba[source + 1] * alpha + 255 * (1 - alpha));
      const blue = Math.round(rgba[source + 2] * alpha + 255 * (1 - alpha));
      result[target] = (red & 0xe0) | ((green & 0xe0) >> 3) | (blue >> 6);
    }
    return result;
  }

  function encodeGif(width, height, indexedFrames, fps) {
    const output = [];
    const writeByte = (value) => output.push(value & 255);
    const writeShort = (value) => { writeByte(value); writeByte(value >> 8); };
    const writeString = (value) => { for (let i = 0; i < value.length; i += 1) writeByte(value.charCodeAt(i)); };

    writeString("GIF89a");
    writeShort(width);
    writeShort(height);
    writeByte(0xf7);
    writeByte(255);
    writeByte(0);

    for (let index = 0; index < 256; index += 1) {
      writeByte(Math.round(((index >> 5) & 7) * 255 / 7));
      writeByte(Math.round(((index >> 2) & 7) * 255 / 7));
      writeByte((index & 3) * 85);
    }

    writeByte(0x21); writeByte(0xff); writeByte(11); writeString("NETSCAPE2.0");
    writeByte(3); writeByte(1); writeShort(0); writeByte(0);

    const delay = Math.max(2, Math.round(100 / fps));
    indexedFrames.forEach((pixels) => {
      writeByte(0x21); writeByte(0xf9); writeByte(4); writeByte(0x04); writeShort(delay); writeByte(0); writeByte(0);
      writeByte(0x2c); writeShort(0); writeShort(0); writeShort(width); writeShort(height); writeByte(0);
      writeByte(8);
      const compressed = lzwCompress(pixels);
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
