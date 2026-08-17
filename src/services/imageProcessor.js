/**
 * 100% Client-Side Image Processor
 * - EXIF GPS Parsing (exifr)
 * - Canvas API Compression (WebP)
 * - Automatic EXIF Stripping
 * - Micro-Thumbnail Generation (100px)
 */
import exifr from 'exifr';

/**
 * Extract GPS coordinates & timestamp from image file using exifr
 * @param {File} file 
 * @returns {Promise<{lat: number, lng: number, date: Date|null}|null>}
 */
export async function extractExifGps(file) {
  try {
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate']
    });

    if (exif && typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
      return {
        lat: Number(exif.latitude.toFixed(6)),
        lng: Number(exif.longitude.toFixed(6)),
        date: exif.DateTimeOriginal || exif.CreateDate || null
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not extract EXIF data:', err);
    return null;
  }
}

/**
 * Loads an image file into an Image element
 * @param {File|Blob} file 
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Помилка завантаження зображення'));
    };
    img.src = url;
  });
}

/**
 * Compress image and generate micro-thumbnail completely on client-side
 * @param {File} file 
 * @param {Object} options 
 * @returns {Promise<{mainBlob: Blob, thumbBlob: Blob, mainUrl: string, thumbUrl: string, originalSize: number, compressedSize: number, thumbSize: number}>}
 */
export async function processImageClientSide(file, options = {}) {
  const maxMainDim = options.maxMainDim || 800;
  const thumbDim = options.thumbDim || 100;
  const mainQuality = options.mainQuality || 0.82;
  const thumbQuality = options.thumbQuality || 0.75;

  const img = await loadImageElement(file);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // 1. Calculate Main Image dimensions (fit inside maxMainDim x maxMainDim)
  let mainW = origW;
  let mainH = origH;
  if (origW > maxMainDim || origH > maxMainDim) {
    if (origW > origH) {
      mainW = maxMainDim;
      mainH = Math.round((origH * maxMainDim) / origW);
    } else {
      mainH = maxMainDim;
      mainW = Math.round((origW * maxMainDim) / origH);
    }
  }

  // Draw main image on Canvas (Strips all original EXIF automatically)
  const mainCanvas = document.createElement('canvas');
  mainCanvas.width = mainW;
  mainCanvas.height = mainH;
  const mainCtx = mainCanvas.getContext('2d', { alpha: false });
  // High quality image smoothing
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.imageSmoothingQuality = 'high';
  mainCtx.drawImage(img, 0, 0, mainW, mainH);

  // 2. Generate Square Thumbnail (100x100 center crop)
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbDim;
  thumbCanvas.height = thumbDim;
  const thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = 'medium';

  const minSide = Math.min(origW, origH);
  const srcX = (origW - minSide) / 2;
  const srcY = (origH - minSide) / 2;
  thumbCtx.drawImage(img, srcX, srcY, minSide, minSide, 0, 0, thumbDim, thumbDim);

  // 3. Export Blobs as WebP (with fallback to JPEG if browser does not support WebP canvas export)
  const mimeType = 'image/webp';

  const mainBlob = await new Promise((resolve) => {
    mainCanvas.toBlob((b) => {
      if (b) resolve(b);
      else {
        // Fallback to JPEG
        mainCanvas.toBlob((fallbackBlob) => resolve(fallbackBlob), 'image/jpeg', 0.85);
      }
    }, mimeType, mainQuality);
  });

  const thumbBlob = await new Promise((resolve) => {
    thumbCanvas.toBlob((b) => {
      if (b) resolve(b);
      else {
        thumbCanvas.toBlob((fallbackBlob) => resolve(fallbackBlob), 'image/jpeg', 0.75);
      }
    }, mimeType, thumbQuality);
  });

  return {
    mainBlob,
    thumbBlob,
    mainPreviewUrl: URL.createObjectURL(mainBlob),
    thumbPreviewUrl: URL.createObjectURL(thumbBlob),
    originalSize: file.size,
    compressedSize: mainBlob.size,
    thumbSize: thumbBlob.size,
    width: mainW,
    height: mainH
  };
}

/**
 * Convert Blob to base64 Data URL
 * @param {Blob} blob 
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Format bytes into human readable string (KB / MB)
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
