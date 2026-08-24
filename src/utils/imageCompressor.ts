/**
 * High-performance client-side image compressor using HTML5 Canvas.
 * Downscales large camera snapshots and images before upload to Supabase Storage,
 * saving 90%+ network bandwidth and storage space.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
  fileName?: string;
}

export async function compressImage(
  imageInput: File | Blob,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxDimension = 800,
    quality = 0.7,
    mimeType = 'image/jpeg',
    fileName = (imageInput as File).name || `compressed_${Date.now()}.jpg`
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Downscale while preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original file if canvas context fails
          resolve(imageInput instanceof File ? imageInput : new File([imageInput], fileName, { type: mimeType }));
          return;
        }

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(imageInput instanceof File ? imageInput : new File([imageInput], fileName, { type: mimeType }));
              return;
            }
            const compressedFile = new File([blob], fileName, {
              type: mimeType,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        // Fallback on error
        resolve(imageInput instanceof File ? imageInput : new File([imageInput], fileName, { type: mimeType }));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(imageInput);
  });
}
