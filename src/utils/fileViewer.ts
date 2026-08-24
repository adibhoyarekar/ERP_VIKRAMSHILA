import { supabase } from '../lib/supabase';

export interface StorageUrlInfo {
  bucket: string;
  path: string;
}

/**
 * Normalizes input to extract raw URL string even if JSON-encoded or object.
 */
export function extractRawUrl(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && parsed.url) {
          return parsed.url;
        }
      } catch (e) {
        // not valid json, return trimmed string
      }
    }
    return trimmed;
  }
  if (typeof input === 'object' && input.url) {
    return input.url;
  }
  return String(input);
}

/**
 * Extracts bucket and relative path from any Supabase storage URL (public or signed)
 * or from relative paths like "student_documents/folder/file.pdf" or "folder/file.pdf".
 */
export function parseSupabaseStorageUrl(rawInput: string, fallbackBucket = 'student_documents'): StorageUrlInfo | null {
  const url = extractRawUrl(rawInput);
  if (!url) return null;

  // 1. Matches Supabase standard URL: /storage/v1/object/(public|sign|authenticated)/<bucket>/<filepath>
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (match) {
    const bucket = match[1];
    const rawPath = match[2].split('?')[0]; // strip query/token if present
    return {
      bucket,
      path: decodeURIComponent(rawPath)
    };
  }

  // 2. Known bucket prefixes in relative paths
  const knownBuckets = [
    'student_documents',
    'stationary_documents',
    'scholarship_documents',
    'attendance_photos',
    'student_photos'
  ];

  for (const b of knownBuckets) {
    if (url.startsWith(`${b}/`)) {
      return {
        bucket: b,
        path: decodeURIComponent(url.substring(b.length + 1).split('?')[0])
      };
    }
  }

  // 3. If it's an external full URL (e.g. Google Drive, Cloudinary, AWS S3) or local memory blob/data URL
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return null;
  }

  // 4. It's a relative path in the fallback bucket
  return {
    bucket: fallbackBucket,
    path: decodeURIComponent(url.split('?')[0])
  };
}

/**
 * Generates a fresh temporary signed URL (valid for 2 hours) for private bucket objects,
 * or returns a valid public URL if bucket is public, or returns external URL as-is.
 */
export async function resolveViewableFileUrl(urlOrPath: string, fallbackBucket = 'student_documents', expiresInSeconds = 7200): Promise<string> {
  const rawUrl = extractRawUrl(urlOrPath);
  if (!rawUrl) return '';

  const parsed = parseSupabaseStorageUrl(rawUrl, fallbackBucket);

  // If not a Supabase storage path and already a full URL, return it
  if (!parsed) {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
      return rawUrl;
    }
    // Fallback: try fallback bucket with raw path
    const { data } = supabase.storage.from(fallbackBucket).getPublicUrl(rawUrl);
    return data.publicUrl || rawUrl;
  }

  try {
    // Generate signed URL
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    // Fallback to public URL if signed URL creation fails
    const { data: pubData } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return pubData.publicUrl || rawUrl;
  } catch (err) {
    console.warn('Error resolving signed storage URL, using public URL:', err);
    const { data: pubData } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return pubData.publicUrl || rawUrl;
  }
}

/**
 * Backward-compatible alias for getSecureFileUrl
 */
export async function getSecureFileUrl(bucket: string, pathOrUrl: string, expiresInSeconds = 7200): Promise<string> {
  return resolveViewableFileUrl(pathOrUrl, bucket, expiresInSeconds);
}

/**
 * Opens a file URL in a new tab without popup blocker issues or broken blob wrappers.
 */
export const openFileUrl = async (urlOrPath: string, bucket = 'student_documents') => {
  if (!urlOrPath) return;

  try {
    const resolvedUrl = await resolveViewableFileUrl(urlOrPath, bucket);
    if (!resolvedUrl) return;

    // Use direct browser navigation
    const win = window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Fallback via anchor click if popup blocker intercepted
      const a = document.createElement('a');
      a.href = resolvedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Error opening file URL:', err);
    // Direct fallback
    window.open(urlOrPath, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Previews a locally-selected File object (before it is uploaded/saved).
 */
export const previewLocalFile = (file: File) => {
  if (!file) return;
  const blobUrl = URL.createObjectURL(file);
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }
};

/**
 * Detect a rough file category from a URL, filename, or MIME type
 */
export const getFileType = (urlOrName: string): 'image' | 'pdf' | 'other' => {
  const lower = (urlOrName || '').toLowerCase().split('?')[0];
  if (
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif|avif|ico|tiff)$/i.test(lower) ||
    lower.includes('image/') ||
    lower.includes('.jpg') ||
    lower.includes('.jpeg') ||
    lower.includes('.png') ||
    lower.includes('.webp') ||
    lower.includes('.gif') ||
    lower.includes('.svg') ||
    lower.startsWith('data:image/')
  ) {
    return 'image';
  }
  if (lower.endsWith('.pdf') || lower.includes('.pdf') || lower.includes('application/pdf') || lower.startsWith('data:application/pdf')) {
    return 'pdf';
  }
  return 'other';
};

/**
 * Forces a download of a file from a URL using fetch and a Blob
 */
export const forceDownloadFile = async (url: string, fallbackName = 'document', bucket = 'student_documents') => {
  if (!url) return;
  try {
    const downloadUrl = await resolveViewableFileUrl(url, bucket);
    if (!downloadUrl) throw new Error('Could not resolve file download URL');

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error('Network error downloading file');

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;

    // Extract filename from URL
    const urlParts = downloadUrl.split('/');
    let filename = urlParts[urlParts.length - 1].split('?')[0];

    if (!filename || filename.length < 3) {
      filename = fallbackName;
    }

    a.download = decodeURIComponent(filename);
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Download failed, falling back to new tab:', error);
    openFileUrl(url, bucket);
  }
};
