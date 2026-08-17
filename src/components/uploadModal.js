/**
 * Upload Photo Modal Component
 * 100% Client-side flow:
 * 1. File pick -> EXIF extraction (exifr)
 * 2. Canvas compression & thumbnail generation + EXIF stripping
 * 3. Emoji selection & Description
 * 4. Geohash encoding & Firebase upload
 */
import { extractExifGps, processImageClientSide, formatBytes } from '../services/imageProcessor.js';
import { uploadPhotoBlobs, savePhotoDocument } from '../services/firebase.js';
import { getCurrentUserId, getCurrentDisplayName } from '../services/authService.js';
import { geoService } from '../services/geoService.js';
import { startManualLocationPicker, renderMapMarkers, flyToCoords } from './map.js';
import { showToast } from '../utils/toast.js';

const EMOJI_LIST = ['📸', '🌅', '🏖️', '🌲', '🏰', '☕', '🍕', '🏕️', '🎨', '🐾', '🌸', '🚴', '⛵', '🏙️', '🍦', '🧗', '🚗', '🚀', '🌌', '💡', '❤️'];

let currentFile = null;
let currentCoords = null; // { lat, lng }
let processedData = null; // { mainBlob, thumbBlob, mainPreviewUrl, ... }
let selectedEmoji = '📸';

/**
 * Open Upload Modal
 */
export function openUploadModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="upload-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>➕</span> Додати нове фото</h3>
          <button class="modal-close-btn" id="btn-close-upload" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Step 1: Dropzone -->
          <div id="dropzone-area" class="upload-dropzone">
            <input type="file" id="file-input" class="file-input-hidden" accept="image/jpeg,image/png,image/webp,image/heic" />
            <div class="dropzone-icon">📷</div>
            <div class="dropzone-title">Оберіть фото або перетягніть сюди</div>
            <div class="dropzone-subtitle">JPG, PNG, WebP • GPS витягується автоматично</div>
          </div>

          <!-- Step 2: Preview Card (Hidden initially) -->
          <div id="preview-area" class="preview-card" style="display: none;">
            <img id="preview-image" class="preview-img" src="" alt="Прев'ю" />
            <div class="preview-badge-group">
              <span class="badge-info" id="badge-size-save">Стиснення: -%</span>
              <span class="badge-info" id="badge-dimensions">800px</span>
            </div>
            <button id="btn-remove-selected-photo" class="btn-remove-photo" title="Видалити фото">&times;</button>
          </div>

          <!-- GPS Status & Location Picker -->
          <div id="gps-status-box" style="display: none;">
            <!-- Rendered dynamically -->
          </div>

          <!-- Emoji Picker -->
          <div id="emoji-picker-group" style="display: none;">
            <label class="form-label">
              <span>Виберіть іконку-емодзі:</span>
              <span id="selected-emoji-display" style="font-size: 16px;">${selectedEmoji}</span>
            </label>
            <div class="emoji-grid" id="emoji-grid-container">
              ${EMOJI_LIST.map((emoji) => `
                <button type="button" class="emoji-option-btn ${emoji === selectedEmoji ? 'selected' : ''}" data-emoji="${emoji}">
                  ${emoji}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Description Textarea -->
          <div id="description-group" style="display: none;">
            <label class="form-label" for="photo-desc-input">Короткий опис:</label>
            <textarea
              id="photo-desc-input"
              class="form-input-text"
              rows="2"
              maxlength="250"
              placeholder="Що зображено на фото? (необов'язково)"
            ></textarea>
          </div>

          <!-- Upload Progress Area -->
          <div id="upload-progress-box" style="display: none;">
            <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span id="upload-status-text">Клієнтська оптимізація...</span>
              <span id="upload-percent-text">0%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="progress-bar-fill"></div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-cancel-upload">Скасувати</button>
          <button class="btn-primary" id="btn-submit-upload" disabled>
            <span>Опублікувати</span>
          </button>
        </div>
      </div>
    </div>
  `;

  attachUploadModalEvents();
}

/**
 * Attach Event Listeners to Upload Modal
 */
function attachUploadModalEvents() {
  const backdrop = document.getElementById('upload-modal-backdrop');
  const btnClose = document.getElementById('btn-close-upload');
  const btnCancel = document.getElementById('btn-cancel-upload');
  const dropzone = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('file-input');
  const btnRemove = document.getElementById('btn-remove-selected-photo');
  const emojiGrid = document.getElementById('emoji-grid-container');
  const btnSubmit = document.getElementById('btn-submit-upload');

  // Close handlers
  const close = () => {
    resetUploadState();
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCancel.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  // Drag & Drop
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  btnRemove.onclick = () => {
    resetUploadState();
    document.getElementById('dropzone-area').style.display = 'flex';
    document.getElementById('preview-area').style.display = 'none';
    document.getElementById('gps-status-box').style.display = 'none';
    document.getElementById('emoji-picker-group').style.display = 'none';
    document.getElementById('description-group').style.display = 'none';
    btnSubmit.disabled = true;
  };

  // Emoji buttons
  emojiGrid.querySelectorAll('.emoji-option-btn').forEach((btn) => {
    btn.onclick = () => {
      emojiGrid.querySelectorAll('.emoji-option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = btn.dataset.emoji;
      const display = document.getElementById('selected-emoji-display');
      if (display) display.textContent = selectedEmoji;
    };
  });

  // Submit Upload
  btnSubmit.onclick = handleUploadSubmit;
}

/**
 * Handle chosen image file: EXIF parsing & Canvas Compression
 */
async function handleFileSelected(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Будь ласка, оберіть файл зображення', 'error');
    return;
  }

  currentFile = file;
  showToast('Обробка фото та пошук GPS...', 'info', 1500);

  // 1. Extract EXIF GPS
  const gps = await extractExifGps(file);
  currentCoords = gps;

  // 2. Client-side Canvas Resize & Compression (WebP)
  try {
    processedData = await processImageClientSide(file, {
      maxMainDim: 800,
      thumbDim: 100
    });
  } catch (err) {
    showToast('Помилка обробки зображення', 'error');
    console.error(err);
    return;
  }

  // Update UI
  const dropzone = document.getElementById('dropzone-area');
  const previewArea = document.getElementById('preview-area');
  const previewImg = document.getElementById('preview-image');
  const badgeSave = document.getElementById('badge-size-save');
  const badgeDim = document.getElementById('badge-dimensions');
  const gpsBox = document.getElementById('gps-status-box');
  const emojiGroup = document.getElementById('emoji-picker-group');
  const descGroup = document.getElementById('description-group');
  const btnSubmit = document.getElementById('btn-submit-upload');

  dropzone.style.display = 'none';
  previewArea.style.display = 'flex';
  previewImg.src = processedData.mainPreviewUrl;

  const savedPercent = Math.round((1 - processedData.compressedSize / file.size) * 100);
  badgeSave.textContent = `Стиснуто: ${formatBytes(file.size)} ➔ ${formatBytes(processedData.compressedSize)} (-${Math.max(0, savedPercent)}%)`;
  badgeDim.textContent = `${processedData.width}×${processedData.height}px`;

  renderGpsStatusBox(gpsBox);
  emojiGroup.style.display = 'block';
  descGroup.style.display = 'block';

  // Enable button only if coordinates are valid
  btnSubmit.disabled = !currentCoords;
}

/**
 * Render GPS Status Info & Actions
 */
function renderGpsStatusBox(container) {
  container.style.display = 'block';

  if (currentCoords) {
    container.innerHTML = `
      <div class="gps-status-card gps-found">
        <div>
          <strong>✓ GPS знайдено:</strong> ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}
        </div>
        <button id="btn-change-pin" class="btn-icon-pill" style="font-size: 11px;">Змінити</button>
      </div>
    `;
    document.getElementById('btn-change-pin').onclick = startManualPinMode;
  } else {
    container.innerHTML = `
      <div class="gps-status-card gps-missing">
        <div><strong>⚠️ GPS відсутній у метаданих фото</strong></div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button id="btn-pick-map" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">📍 Вказати на карті</button>
          <button id="btn-use-geo" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">🧭 Моя геолокація</button>
        </div>
      </div>
    `;

    document.getElementById('btn-pick-map').onclick = startManualPinMode;
    document.getElementById('btn-use-geo').onclick = useCurrentDeviceLocation;
  }
}

/**
 * Switch to interactive map location picker
 */
function startManualPinMode() {
  const backdrop = document.getElementById('upload-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none'; // Temporarily hide modal

  startManualLocationPicker((coords) => {
    currentCoords = coords;
    if (backdrop) backdrop.style.display = 'flex';
    const gpsBox = document.getElementById('gps-status-box');
    if (gpsBox) renderGpsStatusBox(gpsBox);
    const btnSubmit = document.getElementById('btn-submit-upload');
    if (btnSubmit) btnSubmit.disabled = false;
    showToast('Координати встановлено!', 'success');
  });
}

/**
 * Use device geolocation as coordinates
 */
function useCurrentDeviceLocation() {
  if (!navigator.geolocation) {
    showToast('Геолокація недоступна', 'error');
    return;
  }

  showToast('Отримання GPS...', 'info', 1500);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentCoords = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6))
      };
      const gpsBox = document.getElementById('gps-status-box');
      if (gpsBox) renderGpsStatusBox(gpsBox);
      const btnSubmit = document.getElementById('btn-submit-upload');
      if (btnSubmit) btnSubmit.disabled = false;
      showToast('Поточну геолокацію застосовано!', 'success');
    },
    (err) => {
      showToast('Не вдалося отримати GPS. Будь ласка, вкажіть точку на карті.', 'error');
    },
    { enableHighAccuracy: true }
  );
}

/**
 * Handle Final Upload to Firebase (Blobs -> Storage, Doc -> Firestore)
 */
async function handleUploadSubmit() {
  if (!processedData || !currentCoords) {
    showToast('Оберіть фото та вкажіть координати', 'error');
    return;
  }

  const descInput = document.getElementById('photo-desc-input');
  const description = descInput ? descInput.value.trim() : '';
  const btnSubmit = document.getElementById('btn-submit-upload');
  const progressBox = document.getElementById('upload-progress-box');
  const progressFill = document.getElementById('progress-bar-fill');
  const statusText = document.getElementById('upload-status-text');
  const percentText = document.getElementById('upload-percent-text');

  btnSubmit.disabled = true;
  progressBox.style.display = 'block';
  progressFill.style.width = '25%';
  percentText.textContent = '25%';
  statusText.textContent = 'Завантаження фото у сховище...';

  try {
    const userId = getCurrentUserId();

    // 1. Upload compressed blobs to Storage
    const storageUrls = await uploadPhotoBlobs(
      processedData.mainBlob,
      processedData.thumbBlob,
      userId
    );

    progressFill.style.width = '75%';
    percentText.textContent = '75%';
    statusText.textContent = 'Збереження гео-мітки...';

    // 2. Calculate Geohash
    const geohashVal = geoService.encode(currentCoords.lat, currentCoords.lng, 9);

    // 3. Save Document in Firestore
    const photoDoc = {
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      geohash: geohashVal,
      description: description,
      emoji: selectedEmoji,
      mainUrl: storageUrls.mainUrl,
      thumbUrl: storageUrls.thumbUrl,
      authorName: getCurrentDisplayName(),
      userId: userId
    };

    const docId = await savePhotoDocument(photoDoc);

    progressFill.style.width = '100%';
    percentText.textContent = '100%';
    statusText.textContent = 'Готово!';

    showToast('Фото успішно додано на карту! 🎉', 'success');

    // Close modal
    setTimeout(() => {
      const backdrop = document.getElementById('upload-modal-backdrop');
      if (backdrop) backdrop.remove();
      resetUploadState();

      // Fly map to new photo coordinates and re-render
      flyToCoords(currentCoords.lat, currentCoords.lng, 15);
      renderMapMarkers();
    }, 400);

  } catch (err) {
    console.error('Upload failed:', err);
    showToast('Помилка збереження: ' + (err.message || 'Невідома помилка'), 'error');
    btnSubmit.disabled = false;
    progressBox.style.display = 'none';
  }
}

function resetUploadState() {
  currentFile = null;
  currentCoords = null;
  processedData = null;
  selectedEmoji = '📸';
}
