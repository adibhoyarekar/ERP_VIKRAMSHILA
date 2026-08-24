/**
 * fileValidator.ts
 *
 * Provides robust client-side validation for file uploads by checking
 * file size, MIME type, and magic bytes (file signatures) to ensure
 * uploaded content matches its extension and isn't malicious.
 */

// 5MB max size
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  '.pdf'  // Required for Windows file picker to show PDF files in the dialog
];

export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png'
];

/**
 * Checks the magic bytes of a file to ensure it's actually the type it claims to be.
 * Supports JPEG, PNG, and PDF.
 */
async function checkMagicBytes(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!e.target || !e.target.result) {
        resolve(false);
        return;
      }
      const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 4);
      let header = '';
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16).padStart(2, '0');
      }

      // Check magic numbers
      switch (header) {
        case '89504e47': // PNG
          resolve(file.type === 'image/png');
          break;
        case '25504446': // PDF (%PDF)
          // On Windows, some browsers report file.type as '' for PDFs,
          // so accept both 'application/pdf' and empty string
          resolve(file.type === 'application/pdf' || file.type === '');
          break;
        case 'ffd8ffe0':
        case 'ffd8ffe1':
        case 'ffd8ffe2':
        case 'ffd8ffe3':
        case 'ffd8ffe8': // JPEG/EXIF/etc
          resolve(file.type === 'image/jpeg');
          break;
        default:
          resolve(false);
          break;
      }
    };
    reader.onerror = () => resolve(false);
    // Read only the first 4 bytes for the signature
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

/**
 * Validates a file's size, basic MIME type, and magic bytes.
 * @param file The file to validate
 * @param allowedTypes Array of allowed MIME types (defaults to JPEG, PNG, PDF)
 * @returns An error message string if invalid, or null if valid
 */
export async function validateFile(
  file: File, 
  allowedTypes: string[] = ALLOWED_FILE_TYPES
): Promise<string | null> {
  if (!file) return 'No file provided.';

  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds 5MB limit. (Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }

  // On Windows, some browsers report file.type as '' for PDFs.
  // In that case, skip the MIME check and let magic bytes decide.
  if (file.type !== '' && !allowedTypes.includes(file.type)) {
    return 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.';
  }

  const isValidContent = await checkMagicBytes(file);
  if (!isValidContent) {
    return 'File content does not match its extension or is corrupted.';
  }

  return null;
}
