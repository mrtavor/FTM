/**
 * Photo Detail Modal Component with Inline Editor for Visibility & Content
 */
import { getCurrentUserId } from '../services/authService.js';
import { getActiveGroupCode } from '../services/groupService.js';
import { deletePhoto, updatePhotoDocument } from '../services/firebase.js';
import { renderMapMarkers, flyToCoords } from './map.js';
import { showToast } from '../utils/toast.js';

const EMOJI_LIST = ['📸', '🌅', '🏖️', '🌲', '🏰', '☕', '🍕', '🏕️', '🎨', '🐾', '🌸', '🚴', '⛵', '🏙️', '🍦', '🧗', '🚗', '🚀', '🌌', '💡', '❤️'];

let isEditing = false;
let selectedEmoji = '';

export function openPhotoDetailModal(photo) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const currentUserId = getCurrentUserId();
  const isOwner = Boolean(photo.userId === currentUserId || !photo.userId);
  const formattedDate = formatPhotoDate(photo.createdAt);
  const activeGroup = getActiveGroupCode();

  selectedEmoji = photo.emoji || '📸';
  isEditing = false;

  renderModalContent(container, photo, isOwner, formattedDate, activeGroup);
}

function renderModalContent(container, photo, isOwner, formattedDate, activeGroup) {
  container.innerHTML = `
    <div class="modal-backdrop" id="detail-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <div class="photo-detail-emoji-desc">
            <span class="photo-detail-emoji" id="detail-header-emoji">${photo.emoji || '📸'}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 700; font-size: 15px;">Фотографія на карті</span>
              <span style="font-size: 11px; color: var(--text-muted);" id="detail-header-group">
                ${photo.groupCode ? `👥 Група: <strong>${photo.groupCode}</strong>` : '🌍 Публічно для всіх'}
              </span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-detail" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <div class="photo-detail-image-box">
            <img class="photo-detail-full-img" src="${photo.mainUrl || photo.thumbUrl}" alt="${photo.description || 'Фото'}" />
          </div>

          <!-- View Mode Meta -->
          <div id="detail-view-mode" style="display: ${isEditing ? 'none' : 'flex'}; flex-direction: column; gap: 8px;">
            <div class="photo-detail-desc" id="detail-text-desc">${photo.description || 'Без опису'}</div>
            
            <div class="photo-detail-info-row">
              <span>👤 Автор: <strong>${photo.authorName || 'Мандрівник'}</strong></span>
              <span>📅 ${formattedDate}</span>
              <span id="detail-badge-vis" style="background: var(--bg-subtle); padding: 2px 6px; border-radius: var(--radius-pill); font-weight: 600;">
                ${photo.groupCode ? `👥 Тільки група #${photo.groupCode}` : '🌍 Видно всім'}
              </span>
            </div>
          </div>

          <!-- Edit Mode Form (Author Only) -->
          ${isOwner ? `
            <div id="detail-edit-mode" style="display: ${isEditing ? 'flex' : 'none'}; flex-direction: column; gap: 10px; background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
                ✏️ Редагування видимості та опису
              </div>

              <!-- Visibility Selector -->
              <div>
                <label class="form-label" style="font-size: 12px; margin-bottom: 4px;">Де показувати фото:</label>
                <select id="edit-photo-visibility" class="form-input-text" style="font-size: 13px; padding: 8px 10px;">
                  <option value="" ${!photo.groupCode ? 'selected' : ''}>🌍 Публічно на карті (видно всім)</option>
                  ${activeGroup ? `
                    <option value="${activeGroup}" ${photo.groupCode === activeGroup ? 'selected' : ''}>
                      👥 Тільки для групи (${activeGroup})
                    </option>
                  ` : ''}
                  ${photo.groupCode && photo.groupCode !== activeGroup ? `
                    <option value="${photo.groupCode}" selected>
                      👥 Тільки для групи (${photo.groupCode})
                    </option>
                  ` : ''}
                </select>
              </div>

              <!-- Emoji selector -->
              <div>
                <label class="form-label" style="font-size: 12px; margin-bottom: 4px;">Іконка мітки:</label>
                <div class="emoji-grid" id="edit-emoji-grid" style="grid-template-columns: repeat(7, 1fr); gap: 4px;">
                  ${EMOJI_LIST.map((emoji) => `
                    <button type="button" class="emoji-option-btn ${emoji === selectedEmoji ? 'selected' : ''}" data-emoji="${emoji}" style="height: 32px; font-size: 16px;">
                      ${emoji}
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Description input -->
              <div>
                <label class="form-label" style="font-size: 12px; margin-bottom: 4px;">Опис фото:</label>
                <textarea id="edit-photo-description" class="form-input-text" rows="2" maxlength="250" style="font-size: 13px;">${photo.description || ''}</textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
                <button id="btn-cancel-photo-edit" class="btn-secondary" style="font-size: 12px; padding: 6px 12px;">Скасувати</button>
                <button id="btn-save-photo-edit" class="btn-primary" style="font-size: 12px; padding: 6px 16px;">Зберегти зміни</button>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <div style="display: flex; gap: 6px;">
            ${isOwner ? `
              <button class="btn-secondary" id="btn-toggle-edit-photo" style="font-size: 12px; padding: 8px 12px; display: flex; align-items: center; gap: 4px;">
                <span>✏️</span>
                <span>Редагувати</span>
              </button>
              <button class="btn-danger" id="btn-delete-photo" style="font-size: 12px; padding: 8px 10px;">
                🗑️
              </button>
            ` : '<span></span>'}
          </div>
          <button class="btn-secondary" id="btn-close-detail-footer">Закрити</button>
        </div>
      </div>
    </div>
  `;

  attachDetailModalEvents(photo);
}

function attachDetailModalEvents(photo) {
  const backdrop = document.getElementById('detail-modal-backdrop');
  const btnClose = document.getElementById('btn-close-detail');
  const btnCloseFooter = document.getElementById('btn-close-detail-footer');
  const btnDelete = document.getElementById('btn-delete-photo');
  const btnToggleEdit = document.getElementById('btn-toggle-edit-photo');
  const btnCancelEdit = document.getElementById('btn-cancel-photo-edit');
  const btnSaveEdit = document.getElementById('btn-save-photo-edit');
  const viewMode = document.getElementById('detail-view-mode');
  const editMode = document.getElementById('detail-edit-mode');
  const emojiGrid = document.getElementById('edit-emoji-grid');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  // Toggle edit
  if (btnToggleEdit && editMode && viewMode) {
    btnToggleEdit.onclick = () => {
      isEditing = !isEditing;
      editMode.style.display = isEditing ? 'flex' : 'none';
      viewMode.style.display = isEditing ? 'none' : 'flex';
      btnToggleEdit.style.display = isEditing ? 'none' : 'flex';
    };
  }

  if (btnCancelEdit && editMode && viewMode) {
    btnCancelEdit.onclick = () => {
      isEditing = false;
      editMode.style.display = 'none';
      viewMode.style.display = 'flex';
      if (btnToggleEdit) btnToggleEdit.style.display = 'flex';
    };
  }

  // Emoji picker in edit mode
  if (emojiGrid) {
    emojiGrid.querySelectorAll('.emoji-option-btn').forEach((btn) => {
      btn.onclick = () => {
        emojiGrid.querySelectorAll('.emoji-option-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedEmoji = btn.dataset.emoji;
      };
    });
  }

  // Save changes
  if (btnSaveEdit) {
    btnSaveEdit.onclick = async () => {
      const editDesc = document.getElementById('edit-photo-description').value.trim();
      const editVis = document.getElementById('edit-photo-visibility').value.trim();

      btnSaveEdit.disabled = true;
      btnSaveEdit.textContent = 'Збереження...';

      try {
        await updatePhotoDocument(photo.id, {
          description: editDesc,
          emoji: selectedEmoji,
          groupCode: editVis || null
        });

        // Update local object
        photo.description = editDesc;
        photo.emoji = selectedEmoji;
        photo.groupCode = editVis || null;

        showToast('Фото успішно оновлено! ✨', 'success');
        isEditing = false;
        renderMapMarkers();

        // Refresh UI elements
        const textDesc = document.getElementById('detail-text-desc');
        if (textDesc) textDesc.textContent = editDesc || 'Без опису';
        const headerEmoji = document.getElementById('detail-header-emoji');
        if (headerEmoji) headerEmoji.textContent = selectedEmoji;
        const headerGroup = document.getElementById('detail-header-group');
        if (headerGroup) {
          headerGroup.innerHTML = photo.groupCode ? `👥 Група: <strong>${photo.groupCode}</strong>` : '🌍 Публічно для всіх';
        }
        const badgeVis = document.getElementById('detail-badge-vis');
        if (badgeVis) {
          badgeVis.textContent = photo.groupCode ? `👥 Тільки група #${photo.groupCode}` : '🌍 Видно всім';
        }

        if (editMode) editMode.style.display = 'none';
        if (viewMode) viewMode.style.display = 'flex';
        if (btnToggleEdit) btnToggleEdit.style.display = 'flex';

      } catch (err) {
        console.error(err);
        showToast('Помилка оновлення фото', 'error');
        btnSaveEdit.disabled = false;
        btnSaveEdit.textContent = 'Зберегти зміни';
      }
    };
  }

  // Delete photo
  if (btnDelete) {
    btnDelete.onclick = async () => {
      if (confirm('Видалити цю фотографію з карти?')) {
        try {
          await deletePhoto(photo);
          showToast('Фото видалено з карти', 'info');
          close();
          renderMapMarkers();
        } catch (err) {
          console.error(err);
          showToast('Помилка видалення', 'error');
        }
      }
    };
  }
}

/**
 * Robust date formatting
 */
function formatPhotoDate(dateVal) {
  if (!dateVal) return 'Нещодавно';
  try {
    let dateObj = null;
    if (typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        dateObj = dateVal.toDate();
      } else if (typeof dateVal.seconds === 'number') {
        dateObj = new Date(dateVal.seconds * 1000);
      } else if (dateVal._seconds) {
        dateObj = new Date(dateVal._seconds * 1000);
      }
    } else if (typeof dateVal === 'number') {
      dateObj = new Date(dateVal);
    } else if (typeof dateVal === 'string') {
      const parsed = Date.parse(dateVal);
      if (!isNaN(parsed)) dateObj = new Date(parsed);
    }

    if (!dateObj || isNaN(dateObj.getTime())) return 'Нещодавно';

    return dateObj.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Нещодавно';
  }
}
