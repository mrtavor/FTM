/**
 * Clean & Simple Photo Upload Modal
 * No technical jargon, badges, or developer noise
 */
import { extractExifGps, processImageClientSide } from '../services/imageProcessor.js';
import { uploadPhotoBlobs, savePhotoDocument } from '../services/firebase.js';
import { getCurrentUserId, getCurrentDisplayName, ensureAuthenticatedUser, isGoogleUser } from '../services/authService.js';
import { getActiveGroupCode } from '../services/groupService.js';
import { geoService } from '../services/geoService.js';
import { startManualLocationPicker, renderMapMarkers, flyToCoords } from './map.js';
import { showToast } from '../utils/toast.js';

const EMOJI_LIST = ['📸', '🌅', '🏖️', '🌲', '🏰', '☕', '🍕', '🏕️', '🎨', '🐾', '🌸', '🚴', '⛵', '🏙️', '🍦', '🧗', '🚗', '🚀', '🌌', '💡', '❤️'];

let currentFile = null;
let currentCoords = null;
let processedData = null;
let selectedEmoji = '📸';

export function openUploadModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const currentGroup = getActiveGroupCode();
  const isGoogle = isGoogleUser();

  container.innerHTML = `
    <div class="modal-backdrop" id="upload-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>➕</span> Нове фото на карті</h3>
          <button class="modal-close-btn" id="btn-close-upload" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Step 1: Clean Dropzone -->
          <div id="dropzone-area" class="upload-dropzone">
            <input type="file" id="file-input" class="file-input-hidden" accept="image/jpeg,image/png,image/webp,image/heic" />
            <div class="dropzone-icon">📷</div>
            <div class="dropzone-title">Натисніть або перетягніть фото</div>
            <div class="dropzone-subtitle">Локація визначиться автоматично</div>
          </div>

          <!-- Step 2: Clean Preview Card (No technical badges) -->
          <div id="preview-area" class="preview-card" style="display: none;">
            <img id="preview-image" class="preview-img" src="" alt="Прев'ю" />
            <button id="btn-remove-selected-photo" class="btn-remove-photo" title="Вибрати інше фото">&times;</button>
          </div>

          <!-- GPS Status & Location Picker -->
          <div id="gps-status-box" style="display: none;"></div>

          <!-- Group / Friends Selector (shown if user has active group) -->
          ${isGoogle && currentGroup ? `
            <div id="group-selector-box" style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm);">
              <label class="form-label" style="font-size: 12px; margin-bottom: 4px;">Хто побачить це фото:</label>
              <select id="select-photo-group" class="form-input-text" style="padding: 8px 12px; font-size: 13px;">
                <option value="${currentGroup}" selected>👥 Тільки друзі (${currentGroup})</option>
                <option value="">🌍 Всі користувачі (Публічно)</option>
              </select>
            </div>
          ` : ''}

          <!-- Emoji Picker -->
          <div id="emoji-picker-group" style="display: none;">
            <label class="form-label">
              <span>Оберіть іконку:</span>
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
            <label class="form-label" for="photo-desc-input">Опис або враження:</label>
            <textarea
              id="photo-desc-input"
              class="form-input-text"
              rows="2"
              maxlength="250"
              placeholder="Додайте кілька слів..."
            ></textarea>
          </div>

          <!-- Simple Upload Progress Area -->
          <div id="upload-progress-box" style="display: none;">
            <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
              <span id="upload-status-text">Завантаження...</span>
              <span id="upload-percent-text"></span>
            </div>
            <div class="progress-bar-container" style="margin-top: 6px;">
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

function attachUploadModalEvents() {
  const backdrop = document.getElementById('upload-modal-backdrop');
  const btnClose = document.getElementById('btn-close-upload');
  const btnCancel = document.getElementById('btn-cancel-upload');
  const dropzone = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('file-input');
  const btnRemove = document.getElementById('btn-remove-selected-photo');
  const emojiGrid = document.getElementById('emoji-grid-container');
  const btnSubmit = document.getElementById('btn-submit-upload');

  const close = () => {
    resetUploadState();
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCancel.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
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
    const groupBox = document.getElementById('group-selector-box');
    if (groupBox) groupBox.style.display = 'none';
    document.getElementById('emoji-picker-group').style.display = 'none';
    document.getElementById('description-group').style.display = 'none';
    btnSubmit.disabled = true;
  };

  emojiGrid.querySelectorAll('.emoji-option-btn').forEach((btn) => {
    btn.onclick = () => {
      emojiGrid.querySelectorAll('.emoji-option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = btn.dataset.emoji;
      const display = document.getElementById('selected-emoji-display');
      if (display) display.textContent = selectedEmoji;
    };
  });

  btnSubmit.onclick = handleUploadSubmit;
}

async function handleFileSelected(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Будь ласка, оберіть фотографію', 'error');
    return;
  }

  currentFile = file;

  // Extract EXIF GPS
  const gps = await extractExifGps(file);
  currentCoords = gps;

  // Process WebP
  try {
    processedData = await processImageClientSide(file, {
      maxMainDim: 800,
      thumbDim: 100
    });
  } catch (err) {
    showToast('Помилка відкриття фото', 'error');
    return;
  }

  const dropzone = document.getElementById('dropzone-area');
  const previewArea = document.getElementById('preview-area');
  const previewImg = document.getElementById('preview-image');
  const gpsBox = document.getElementById('gps-status-box');
  const emojiGroup = document.getElementById('emoji-picker-group');
  const descGroup = document.getElementById('description-group');
  const btnSubmit = document.getElementById('btn-submit-upload');

  dropzone.style.display = 'none';
  previewArea.style.display = 'flex';
  previewImg.src = processedData.mainPreviewUrl;

  renderGpsStatusBox(gpsBox);
  emojiGroup.style.display = 'block';
  descGroup.style.display = 'block';

  btnSubmit.disabled = !currentCoords;
}

function renderGpsStatusBox(container) {
  container.style.display = 'block';

  if (currentCoords) {
    container.innerHTML = `
      <div class="gps-status-card gps-found">
        <div><strong>✓ Локацію визначено</strong></div>
        <button id="btn-change-pin" class="btn-icon-pill" style="font-size: 11px;">Змінити місце</button>
      </div>
    `;
    document.getElementById('btn-change-pin').onclick = startManualPinMode;
  } else {
    container.innerHTML = `
      <div class="gps-status-card gps-missing">
        <div><strong>📍 Вкажіть місцеположення фото:</strong></div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button id="btn-pick-map" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">Поставити точку на карті</button>
          <button id="btn-use-geo" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">🧭 Моє місце</button>
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
    showToast('Місце встановлено!', 'success');
  });
}

function useCurrentDeviceLocation() {
  if (!navigator.geolocation) {
    showToast('Геолокація недоступна', 'error');
    return;
  }

  showToast('Визначення локації...', 'info', 1500);
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
      showToast('Локацію знайдено!', 'success');
    },
    (err) => {
      showToast('Вкажіть місце на карті вручну.', 'error');
    },
    { enableHighAccuracy: true }
  );
}

async function handleUploadSubmit() {
  if (!processedData || !currentCoords) {
    showToast('Оберіть фото та вкажіть місце', 'error');
    return;
  }

  const descInput = document.getElementById('photo-desc-input');
  const description = descInput ? descInput.value.trim() : '';
  const selectGroup = document.getElementById('select-photo-group');
  const finalGroupCode = selectGroup ? selectGroup.value.trim().toUpperCase() : '';

  const btnSubmit = document.getElementById('btn-submit-upload');
  const progressBox = document.getElementById('upload-progress-box');
  const progressFill = document.getElementById('progress-bar-fill');
  const statusText = document.getElementById('upload-status-text');

  btnSubmit.disabled = true;
  progressBox.style.display = 'block';
  progressFill.style.width = '40%';
  statusText.textContent = 'Збереження на карті...';

  try {
    const user = await ensureAuthenticatedUser();
    const userId = user ? user.uid : getCurrentUserId();

    progressFill.style.width = '80%';

    const storageUrls = await uploadPhotoBlobs(
      processedData.mainBlob,
      processedData.thumbBlob,
      userId
    );

    const geohashVal = geoService.encode(currentCoords.lat, currentCoords.lng, 9);

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

    await savePhotoDocument(photoDoc);

    progressFill.style.width = '100%';
    statusText.textContent = 'Опубліковано!';

    showToast('Фото успішно додано! 🎉', 'success');

    setTimeout(() => {
      const backdrop = document.getElementById('upload-modal-backdrop');
      if (backdrop) backdrop.remove();
      resetUploadState();
      flyToCoords(currentCoords.lat, currentCoords.lng, 15);
      renderMapMarkers();
    }, 300);

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Помилка збереження. Спробуйте ще раз.', 'error');
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
