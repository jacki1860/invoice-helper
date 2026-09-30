export interface DocumentLogo {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export const LOGO_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;

export function validateLogoFile(file: { type: string; size: number }): void {
  if (!LOGO_FILE_TYPES.includes(file.type)) throw new Error('請選擇 PNG、JPG 或 WebP 圖片。');
  if (file.size <= 0) throw new Error('這個圖片檔是空的，請選擇其他圖片。');
  if (file.size > MAX_LOGO_FILE_BYTES) throw new Error('圖片超過 5 MB，請先縮小檔案。');
}

export function logoDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 12000 ||
    height > 12000 ||
    width * height > 40000000
  )
    throw new Error('圖片尺寸過大或無效，請先縮小圖片後再試。');
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function loadDocumentLogo(file: File): Promise<DocumentLogo> {
  validateLogoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('無法讀取這張圖片，請確認檔案完整或改用其他圖片。');
    }
    const dimensions = logoDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('瀏覽器無法處理圖片，請稍後重試。');
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    // A self-contained PNG preserves transparency and outlives live-preview changes.
    return { dataUrl: canvas.toDataURL('image/png'), name: file.name, ...dimensions };
  } finally {
    URL.revokeObjectURL(url);
  }
}
