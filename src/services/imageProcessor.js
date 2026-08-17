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
  const maxMainDim = options.maxMainDim || 1200;
  const thumbDim = options.thumbDim || 120;
  const mainQuality = options.mainQuality || 0.88;
  const thumbQuality = options.thumbQuality || 0.80;

  // Read EXIF orientation so we can correct canvas rotation
  let orientation = 1;
  try {
    const exifFull = await exifr.parse(file, { pick: ['Orientation'] });
    if (exifFull && exifFull.Orientation) orientation = exifFull.Orientation;
  } catch (_) {}

  const img = await loadImageElement(file);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Whether EXIF rotation swaps width/height
  const isRotated = [5, 6, 7, 8].includes(orientation);
  const srcW = isRotated ? origH : origW;
  const srcH = isRotated ? origW : origH;

  // 1. Scale main image preserving aspect ratio
  let mainW = srcW;
  let mainH = srcH;
  if (srcW > maxMainDim || srcH > maxMainDim) {
    if (srcW >= srcH) {
      mainW = maxMainDim;
      mainH = Math.round((srcH * maxMainDim) / srcW);
    } else {
      mainH = maxMainDim;
      mainW = Math.round((srcW * maxMainDim) / srcH);
    }
  }

  // Helper: apply EXIF rotation transform to a canvas context
  function applyExifRotation(ctx, canvasW, canvasH, rot) {
    switch (rot) {
      case 2: ctx.transform(-1, 0, 0, 1, canvasW, 0); break;
      case 3: ctx.transform(-1, 0, 0, -1, canvasW, canvasH); break;
      case 4: ctx.transform(1, 0, 0, -1, 0, canvasH); break;
      case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
      case 6: ctx.transform(0, 1, -1, 0, canvasH, 0); break;
      case 7: ctx.transform(0, -1, -1, 0, canvasW, canvasH); break;
      case 8: ctx.transform(0, -1, 1, 0, 0, canvasW); break;
      default: break;
    }
  }

  // 2. Draw main image with orientation correction & white background
  const mainCanvas = document.createElement('canvas');
  mainCanvas.width = mainW;
  mainCanvas.height = mainH;
  const mainCtx = mainCanvas.getContext('2d');
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.imageSmoothingQuality = 'high';
  // White background (no black bars)
  mainCtx.fillStyle = '#FFFFFF';
  mainCtx.fillRect(0, 0, mainW, mainH);
  applyExifRotation(mainCtx, mainW, mainH, orientation);
  if (isRotated) {
    mainCtx.drawImage(img, 0, 0, origW, origH, 0, 0, mainH, mainW);
  } else {
    mainCtx.drawImage(img, 0, 0, origW, origH, 0, 0, mainW, mainH);
  }

  // 3. Square thumbnail — center-cropped, with white bg
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbDim;
  thumbCanvas.height = thumbDim;
  const thumbCtx = thumbCanvas.getContext('2d');
  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = 'medium';
  thumbCtx.fillStyle = '#FFFFFF';
  thumbCtx.fillRect(0, 0, thumbDim, thumbDim);

  const minSide = Math.min(srcW, srcH);
  const cropX = (srcW - minSide) / 2;
  const cropY = (srcH - minSide) / 2;
  applyExifRotation(thumbCtx, thumbDim, thumbDim, orientation);
  if (isRotated) {
    thumbCtx.drawImage(img, cropY, cropX, minSide, minSide, 0, 0, thumbDim, thumbDim);
  } else {
    thumbCtx.drawImage(img, cropX, cropY, minSide, minSide, 0, 0, thumbDim, thumbDim);
  }

  // 4. Export as WebP (fallback JPEG)
  const mimeType = 'image/webp';

  const mainBlob = await new Promise((resolve) => {
    mainCanvas.toBlob((b) => {
      if (b) resolve(b);
      else mainCanvas.toBlob((fb) => resolve(fb), 'image/jpeg', 0.88);
    }, mimeType, mainQuality);
  });

  const thumbBlob = await new Promise((resolve) => {
    thumbCanvas.toBlob((b) => {
      if (b) resolve(b);
      else thumbCanvas.toBlob((fb) => resolve(fb), 'image/jpeg', 0.80);
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
