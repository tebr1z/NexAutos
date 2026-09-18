const MAX_CHARS = 55_000;

export async function fitDataUrl(raw: string): Promise<string> {
  if (!raw.startsWith("data:image/")) return raw;
  if (raw.length <= MAX_CHARS) return raw;
  const img = await loadImage(raw);
  let max = Math.min(900, Math.max(img.width, img.height));
  let quality = 0.62;
  let best = raw;
  for (let i = 0; i < 10; i++) {
    const next = drawJpeg(img, max, quality);
    best = next.length < best.length ? next : best;
    if (next.length <= MAX_CHARS) return next;
    quality = Math.max(0.38, quality - 0.08);
    max = Math.max(480, Math.round(max * 0.82));
  }
  return best.length <= raw.length ? best : raw;
}

export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      void fitFromImage(img).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      const reader = new FileReader();
      reader.onload = () => {
        void fitDataUrl(String(reader.result ?? "")).then(resolve, reject);
      };
      reader.onerror = () => reject(new Error("Şəkil oxunmadı"));
      reader.readAsDataURL(file);
    };
    img.src = blobUrl;
  });
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Şəkil oxunmadı"));
    img.src = url;
  });
}

async function fitFromImage(img: HTMLImageElement) {
  let max = Math.min(900, Math.max(img.width, img.height));
  let quality = 0.62;
  let best = drawJpeg(img, max, quality);
  for (let i = 0; i < 10 && best.length > MAX_CHARS; i++) {
    quality = Math.max(0.38, quality - 0.08);
    max = Math.max(480, Math.round(max * 0.82));
    const next = drawJpeg(img, max, quality);
    if (next.length < best.length) best = next;
  }
  return best;
}

function drawJpeg(img: HTMLImageElement, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function dataUrlToBlob(url: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(url);
  if (!match) throw new Error("Şəkil formatı səhvdir");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}
