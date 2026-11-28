/**
 * Tarayıcı tarafında büyük görselleri yükleme öncesi boyutlandırır ve WebP/JPEG olarak sıkıştırır.
 * Hata durumunda orijinal dosyayı güvenli şekilde geri döndürür.
 */
export async function compressImageFile(
  file,
  { maxDimension = 1600, quality = 0.82, minSizeBytes = 120 * 1024 } = {}
) {
  try {
    if (
      !file ||
      typeof window === 'undefined' ||
      !file.type?.startsWith('image/') ||
      file.type === 'image/gif' ||
      file.size <= minSizeBytes
    ) {
      return file;
    }

    let width = 0;
    let height = 0;
    let source = null;
    let objectUrl = '';

    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        source = bitmap;
      } else {
        objectUrl = URL.createObjectURL(file);
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = objectUrl;
        });
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        source = img;
      }

      if (!width || !height) return file;

      const scale = Math.min(1, maxDimension / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

      let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob || blob.size === 0) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      }

      if (!blob || blob.size === 0 || blob.size >= file.size) {
        return file;
      }

      const baseName = String(file.name || 'image').replace(/\.[^/.]+$/, '');
      const nextExt = blob.type === 'image/webp' ? '.webp' : '.jpg';
      return new File([blob], `${baseName}${nextExt}`, {
        type: blob.type,
        lastModified: Date.now()
      });
    } finally {
      if (source && typeof source.close === 'function') {
        source.close();
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch {
    return file;
  }
}
