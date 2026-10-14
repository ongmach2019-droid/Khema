/**
 * Client-side image compression and normalization for mobile & web.
 * Resizes large camera photos down to max 1600px and converts to lightweight JPEG (~250KB),
 * preventing mobile browser memory crashes and network timeouts on 3G/4G/5G.
 */
export async function compressAndPrepareImage(
  fileOrBlob: File | Blob,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<{ dataUrl: string; mimeType: string }> {
  // If PDF, cannot draw on canvas, return as-is
  if ('type' in fileOrBlob && fileOrBlob.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType: 'application/pdf' });
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve({ dataUrl: '', mimeType: 'image/jpeg' });
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ dataUrl: rawDataUrl, mimeType: fileOrBlob.type || 'image/jpeg' });
          return;
        }

        // Fill white background for transparent images
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
      };

      img.onerror = () => {
        // Fallback to raw data url if decoding fails
        resolve({ dataUrl: rawDataUrl, mimeType: fileOrBlob.type || 'image/jpeg' });
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      resolve({ dataUrl: '', mimeType: 'image/jpeg' });
    };

    reader.readAsDataURL(fileOrBlob);
  });
}
