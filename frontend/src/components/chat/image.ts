// Downscales a picked photo in the browser before upload: max 1024px on the long side, JPEG 0.7, base64.
// Kept tiny and separate so tests can mock it (jsdom has no canvas).

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image_decode_failed'));
    img.src = url;
  });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/** Returns plain base64 JPEG data (no `data:` prefix). */
export async function fileToJpegBase64(file: Blob, maxSide = 1024, quality = 0.7): Promise<string> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img.source, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  } finally {
    img.done();
  }
}
