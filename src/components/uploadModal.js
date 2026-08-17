/**
 * Upload Photo Modal Component
 * 100% Client-side flow:
 * 1. File pick -> EXIF extraction (exifr)
 * 2. Canvas compression & thumbnail generation + EXIF stripping
 * 3. Group/Circle selection & Emoji selection & Description
 * 4. Geohash encoding & Firebase upload
 */
import { extractExifGps, processImageClientSide, formatBytes } from '../services/imageProcessor.js';
import { uploadPhotoBlobs, savePhotoDocument } from '../services/firebase.js';
import { getCurrentUserId, getCurrentDisplayName, ensureAuthenticatedUser } from '../services/authService.js';
import { getActiveGroupCode } from '../services/groupService.js';
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

  const currentGroup = getActiveGroupCode();

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
            <div class="dropzone-subtitle">JPG, PNG, WebP • Гео-точка визначається автоматично</div>
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

          <!-- Group / Privacy Circle Selector -->
          <div id="group-selector-box" style="display: none; background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm);">
            <label class="form-label" style="font-size: 12px; margin-bottom: 4px;">👥 Видимість для друзів / групи:</label>
            <div style="display: flex; gap: 8px;">
              <select id="select-photo-group" class="form-input-text" style="padding: 8px 12px; font-size: 13px;">
                <option value="" ${!currentGroup ? 'selected' : ''}>🌍 Публічно на загальній карті</option>
                ${currentGroup ? `<option value="${currentGroup}" selected>👥 Тільки для групи "${currentGroup}"</option>` : ''}
                <option value="__custom__">➕ Вказати інший код групи...</option>
              </select>
            </div>
            <input type="text" id="input-custom-group" class="form-input-text" placeholder="Введіть секретний код групи (наприклад: DRUZI2026)" style="display: none; margin-top: 6px; font-size: 12px;" />
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
              <span id="upload-status-text">Оптимізація...</span>
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
  const selectGroup = document.getElementById('select-photo-group');
  const inputCustomGroup = document.getElementById('input-custom-group');

  if (selectGroup && inputCustomGroup) {
    selectGroup.onchange = () => {
      if (selectGroup.value === '__custom__') {
        inputCustomGroup.style.display = 'block';
        inputCustomGroup.focus();
      } else {
        inputCustomGroup.style.display = 'none';
      }
    };
  }

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
    document.getElementById('group-selector-box').style.display = 'none';
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
  showToast('Обробка фото та пошук гео-точки...', 'info', 1500);

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
  const groupBox = document.getElementById('group-selector-box');
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
  groupBox.style.display = 'block';
  emojiGroup.style.display = 'block';
  descGroup.style.display = 'block';

  btnSubmit.disabled = !currentCoords;
}

/**
 * Render GPS Status Info & Actions (Privacy-focused: no raw coordinates shown)
 */
function renderGpsStatusBox(container) {
  container.style.display = 'block';

  if (currentCoords) {
    container.innerHTML = `
      <div class="gps-status-card gps-found">
        <div>
          <strong>✓ Гео-місцеположення визначено</strong>
        </div>
        <button id="btn-change-pin" class="btn-icon-pill" style="font-size: 11px;">Змінити точку</button>
      </div>
    `;
    document.getElementById('btn-change-pin').onclick = startManualPinMode;
  } else {
    container.innerHTML = `
      <div class="gps-status-card gps-missing">
        <div><strong>⚠️ Гео-точка відсутня у метаданих фото</strong></div>
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

function startManualPinMode() {
  const backdrop = document.getElementById('upload-modal-backdrop');
  if (backdrop) backdrop.style.display = 'none';

  startManualLocationPicker((coords) => {
    currentCoords = coords;
    if (backdrop) backdrop.style.display = 'flex';
    const gpsBox = document.getElementById('gps-status-box');
    if (gpsBox) renderGpsStatusBox(gpsBox);
    const btnSubmit = document.getElementById('btn-submit-upload');
    if (btnSubmit) btnSubmit.disabled = false;
    showToast('Точку встановлено на карті!', 'success');
  });
}

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
      showToast('Поточну локацію застосовано!', 'success');
    },
    (err) => {
      showToast('Не вдалося отримати GPS. Будь ласка, вкажіть точку на карті.', 'error');
    },
    { enableHighAccuracy: true }
  );
}

/**
 * Handle Final Upload to Firebase (Firestore Data URLs + Geohash + GroupCode)
 */
async function handleUploadSubmit() {
  if (!processedData || !currentCoords) {
    showToast('Оберіть фото та вкажіть координати', 'error');
    return;
  }

  const descInput = document.getElementById('photo-desc-input');
  const description = descInput ? descInput.value.trim() : '';
  const selectGroup = document.getElementById('select-photo-group');
  const inputCustomGroup = document.getElementById('input-custom-group');
  
  let finalGroupCode = '';
  if (selectGroup) {
    if (selectGroup.value === '__custom__' && inputCustomGroup) {
      finalGroupCode = inputCustomGroup.value.trim().toUpperCase();
    } else {
      finalGroupCode = selectGroup.value.trim().toUpperCase();
    }
  }

  const btnSubmit = document.getElementById('btn-submit-upload');
  const progressBox = document.getElementById('upload-progress-box');
  const progressFill = document.getElementById('progress-bar-fill');
  const statusText = document.getElementById('upload-status-text');
  const percentText = document.getElementById('upload-percent-text');

  btnSubmit.disabled = true;
  progressBox.style.display = 'block';
  progressFill.style.width = '35%';
  percentText.textContent = '35%';
  statusText.textContent = 'Оптимізація та стиснення...';

  try {
    const user = await ensureAuthenticatedUser();
    const userId = user ? user.uid : getCurrentUserId();

    progressFill.style.width = '70%';
    percentText.textContent = '70%';
    statusText.textContent = 'Збереження гео-мітки у базу...';

    // 1. Convert to optimized WebP Data URLs
    const storageUrls = await uploadPhotoBlobs(
      processedData.mainBlob,
      processedData.thumbBlob,
      userId
    );

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
      groupCode: finalGroupCode || null,
      userId: userId
    };

    const docId = await savePhotoDocument(photoDoc);

    progressFill.style.width = '100%';
    percentText.textContent = '100%';
    statusText.textContent = 'Опубліковано!';

    showToast('Фото успішно додано на карту! 🎉', 'success');

    // Close modal
    setTimeout(() => {
      const backdrop = document.getElementById('upload-modal-backdrop');
      if (backdrop) backdrop.remove();
      resetUploadState();

      // Fly map to new photo coordinates and re-render
      flyToCoords(currentCoords.lat, currentCoords.lng, 15);
      renderMapMarkers();
    }, 350);

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
