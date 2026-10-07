/*
  Real photo checks, run in the browser on the actual pixels. Nothing is uploaded anywhere.
  We measure what a canvas can measure: size, shape, how plain and light the background is, and file weight.
  We do not claim to detect faces or expressions.
*/

export const TARGET_RATIO = 4.3 / 5.5;
export const PORTAL_PHOTO_MAX = 600 * 1024;
export const PORTAL_DOC_MAX = 2 * 1024 * 1024;

export interface PhotoCheck {
  id: 'ratio' | 'background' | 'resolution' | 'weight';
  label: string;
  value: string;
  ok: boolean;
}

export interface PhotoReport {
  width: number;
  height: number;
  bytes: number;
  aspect: number;
  bgLuma: number;
  bgSpread: number;
  checks: PhotoCheck[];
  needsFix: boolean;
  needsResize: boolean;
  blocking: boolean;
}

async function bitmapOf(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

const sizeOf = (b: ImageBitmap | HTMLImageElement) => ({
  w: 'naturalWidth' in b ? b.naturalWidth : b.width,
  h: 'naturalHeight' in b ? b.naturalHeight : b.height,
});

function canvasOf(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
}

export async function analysePhoto(blob: Blob): Promise<PhotoReport> {
  const bmp = await bitmapOf(blob);
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, 360 / Math.max(w, h));
  const cw = Math.max(8, Math.round(w * scale));
  const ch = Math.max(8, Math.round(h * scale));
  const c = canvasOf(cw, ch);
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch).data;

  // Sample the frame the background shows in: the top edge and both sides above the shoulders.
  const bx = Math.max(2, Math.round(cw * 0.06));
  const by = Math.max(2, Math.round(ch * 0.06));
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const border = y < by || (y < ch * 0.62 && (x < bx || x >= cw - bx));
      if (!border) continue;
      const i = (y * cw + x) * 4;
      const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      sum += l;
      sum2 += l * l;
      n += 1;
    }
  }
  const mean = n ? sum / n : 0;
  const std = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : 1;
  const aspect = w / h;

  const checks: PhotoCheck[] = [
    { id: 'ratio', label: 'Shape', value: `${aspect.toFixed(2)} (needs about ${TARGET_RATIO.toFixed(2)})`, ok: Math.abs(aspect - TARGET_RATIO) <= 0.04 },
    { id: 'background', label: 'Background', value: `${Math.round(mean * 100)}% light, ${std < 0.07 ? 'plain' : 'busy'}`, ok: mean >= 0.88 && std < 0.07 },
    { id: 'resolution', label: 'Resolution', value: `${w} × ${h} px`, ok: w >= 600 && h >= 700 },
    { id: 'weight', label: 'File size', value: `${(blob.size / 1024).toFixed(0)} KB (portal limit ${PORTAL_PHOTO_MAX / 1024} KB)`, ok: blob.size <= PORTAL_PHOTO_MAX },
  ];
  const get = (id: PhotoCheck['id']) => checks.find((c2) => c2.id === id) as PhotoCheck;
  return {
    width: w,
    height: h,
    bytes: blob.size,
    aspect,
    bgLuma: mean,
    bgSpread: std,
    checks,
    needsFix: !get('ratio').ok || !get('background').ok,
    needsResize: !get('weight').ok,
    blocking: !get('resolution').ok,
  };
}

/** Pull a plain light background out of a photo whose background is flat. Keeps everything that differs from the background. */
export async function lightenBackground(blob: Blob): Promise<Blob> {
  const bmp = await bitmapOf(blob);
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, 1500 / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const c = canvasOf(cw, ch);
  const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bmp, 0, 0, cw, ch);
  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data;

  // Estimate the background colour from the top edge.
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const rows = Math.max(2, Math.round(ch * 0.04));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
      n += 1;
    }
  }
  r /= n;
  g /= n;
  b /= n;

  const tol = 46;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);
    if (dist < tol) {
      const t = 1 - dist / tol; // 1 at the background colour, 0 at the edge of the tolerance
      const k = Math.min(1, t * 1.6);
      d[i] = d[i] + (250 - d[i]) * k;
      d[i + 1] = d[i + 1] + (250 - d[i + 1]) * k;
      d[i + 2] = d[i + 2] + (250 - d[i + 2]) * k;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toBlob(c, 0.92);
}

/** Resize to a width the portal accepts and step the quality down until the file is light enough. */
export async function shrinkForPortal(blob: Blob, targetWidth = 600, maxBytes = PORTAL_PHOTO_MAX - 40 * 1024): Promise<Blob> {
  const bmp = await bitmapOf(blob);
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, targetWidth / w);
  const c = canvasOf(Math.round(w * scale), Math.round(h * scale));
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.92;
  let out = await toBlob(c, q);
  while (out.size > maxBytes && q > 0.4) {
    q -= 0.08;
    out = await toBlob(c, q);
  }
  return out;
}

/**
 * Shrinks a document photo (passport page, ticket, booking) before upload. A 2,000-pixel long edge is still
 * sharper than a 300 dpi scan of a passport page, at a fraction of a phone photo's 4 to 12 MB: uploads finish
 * sooner, storage costs less, and the passport reader gets a lighter file. PDFs and small images pass through.
 */
export async function shrinkDocument(blob: Blob, maxEdge = 2000, quality = 0.88): Promise<Blob> {
  if (blob.type !== 'image/jpeg' && blob.type !== 'image/png') return blob;
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = typeof createImageBitmap === 'function' ? await createImageBitmap(blob, { imageOrientation: 'from-image' }) : await bitmapOf(blob);
  } catch {
    return blob; // the server will report a broken file properly
  }
  const { w, h } = sizeOf(bmp);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  if (scale === 1 && blob.size <= 1.5 * 1024 * 1024) return blob;
  const c = canvasOf(Math.round(w * scale), Math.round(h * scale));
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff'; // transparent PNG areas become white, not black, in a JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const out = await toBlob(c, quality);
  return out.size < blob.size ? out : blob;
}

export interface SamplePhotoOpts {
  background: 'grey' | 'white';
  skin: string;
  hair: string;
  shirt: string;
  long?: boolean;
}

/** Draws a sample portrait on a canvas and encodes it like a phone photo: large, slightly noisy JPEG. */
export async function makeSamplePhoto(o: SamplePhotoOpts): Promise<Blob> {
  const W = 1500;
  const H = Math.round(W / TARGET_RATIO);
  const c = canvasOf(W, H);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = o.background === 'grey' ? '#bcc2c6' : '#f7f8f8';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  // shoulders
  ctx.fillStyle = o.shirt;
  ctx.beginPath();
  ctx.moveTo(cx - 640, H);
  ctx.bezierCurveTo(cx - 640, H - 420, cx - 380, H - 520, cx, H - 520);
  ctx.bezierCurveTo(cx + 380, H - 520, cx + 640, H - 420, cx + 640, H);
  ctx.closePath();
  ctx.fill();
  // neck
  ctx.fillStyle = o.skin;
  ctx.fillRect(cx - 120, H * 0.56, 240, H * 0.2);
  // hair back (long)
  if (o.long) {
    ctx.fillStyle = o.hair;
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.42, 330, 430, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // head
  ctx.fillStyle = o.skin;
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.4, 255, 330, 0, 0, Math.PI * 2);
  ctx.fill();
  // hair top
  ctx.fillStyle = o.hair;
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.4 - 190, 262, 170, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // face
  ctx.fillStyle = '#2a2220';
  for (const dx of [-95, 95]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx, H * 0.4 - 20, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + dx - 42, H * 0.4 - 78, 84, 11);
  }
  ctx.strokeStyle = 'rgba(40,28,24,.55)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx, H * 0.4 - 6);
  ctx.lineTo(cx - 22, H * 0.4 + 82);
  ctx.lineTo(cx + 12, H * 0.4 + 88);
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(cx - 62, H * 0.4 + 168);
  ctx.quadraticCurveTo(cx, H * 0.4 + 196, cx + 62, H * 0.4 + 168);
  ctx.stroke();

  // sensor noise, so the file weighs what a phone photo weighs
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const nz = (Math.random() - 0.5) * 9;
    d[i] += nz;
    d[i + 1] += nz;
    d[i + 2] += nz;
  }
  ctx.putImageData(img, 0, 0);
  return toBlob(c, 0.94);
}
