/**
 * Universal Photo Viewer & Editor Modal
 * Built completely from scratch for seamless operation across Mobile, Tablet, and Desktop PC.
 */
import { getCurrentUserId } from '../services/authService.js';
import { getActiveGroupCode } from '../services/groupService.js';
import { updatePhotoDocument, deletePhoto } from '../services/firebase.js';
import { showToast } from '../utils/toast.js';

const AVAILABLE_EMOJIS = [
  '📸', '🌅', '🏖️', '🌲', '🏰', '☕', '🍕', '🏕️', '🎨', '🐾',
  '🌸', '🚴', '⛵', '🏙️', '🍦', '🧗', '🚗', '🚀', '🌌', '💡', '❤️'
];

/**
 * Open the universal photo viewer
 * @param {Object} photo - The photo document
 * @param {Function} [onChanged] - Callback when photo is edited or deleted
 */
export function showPhotoViewer(photo, onChanged) {
  if (!photo) return;

  // Remove any existing viewer modal immediately
  const existing = document.getElementById('universal-photo-viewer');
  if (existing) existing.remove();

  const currentUserId = getCurrentUserId();
  const isAuthor = Boolean(photo.userId && currentUserId && photo.userId === currentUserId);
  const activeGroup = getActiveGroupCode();

  // Create clean modal container
  const modal = document.createElement('div');
  modal.id = 'universal-photo-viewer';
  modal.className = 'pv-overlay';

  // Format date safely
  let dateString = 'Нещодавно';
  try {
    if (photo.createdAt) {
      const d = photo.createdAt.toDate ? photo.createdAt.toDate() : new Date(photo.createdAt.seconds ? photo.createdAt.seconds * 1000 : photo.createdAt);
      if (!isNaN(d.getTime())) {
        dateString = d.toLocaleDateString('uk-UA', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
  } catch (_) {
    dateString = 'Нещодавно';
  }

  let isEditMode = false;
  let currentEmoji = photo.emoji || '📸';

  function render() {
    modal.innerHTML = `
      <div class="pv-backdrop" data-action="close"></div>
      <div class="pv-card" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="pv-header">
          <div class="pv-title-row">
            <span class="pv-emoji-icon">${currentEmoji}</span>
            <div>
              <div class="pv-title-text">${photo.description ? photo.description.slice(0, 35) + (photo.description.length > 35 ? '...' : '') : 'Фотографія на карті'}</div>
              <div class="pv-subtitle-text">
                ${photo.groupCode ? `👥 Група: <strong>${photo.groupCode}</strong>` : '🌍 Публічна фотографія'}
              </div>
            </div>
          </div>
          <button type="button" class="pv-close-btn" data-action="close" aria-label="Закрити">&times;</button>
        </div>

        <!-- Body -->
        <div class="pv-body">
          <!-- Image Container -->
          <div class="pv-image-wrap">
            <img src="${photo.mainUrl || photo.thumbUrl}" alt="${photo.description || 'Фото'}" class="pv-image" loading="eager" />
          </div>

          <!-- View Mode Details -->
          <div class="pv-details" style="display: ${isEditMode ? 'none' : 'flex'};">
            <p class="pv-description">${photo.description || 'Без опису'}</p>
            
            <div class="pv-meta-grid">
              <div class="pv-meta-item">
                <span class="pv-meta-label">Автор</span>
                <span class="pv-meta-val">👤 ${photo.authorName || 'Мандрівник'}</span>
              </div>
              <div class="pv-meta-item">
                <span class="pv-meta-label">Дата</span>
                <span class="pv-meta-val">📅 ${dateString}</span>
              </div>
              <div class="pv-meta-item">
                <span class="pv-meta-label">Видимість</span>
                <span class="pv-meta-val">${photo.groupCode ? `👥 Тільки група ${photo.groupCode}` : '🌍 Для всіх'}</span>
              </div>
            </div>
          </div>

          <!-- Edit Mode Form (Author Only) -->
          ${isAuthor ? `
            <div class="pv-edit-form" style="display: ${isEditMode ? 'flex' : 'none'};">
              <div class="pv-form-group">
                <label class="pv-label">Опис фотографії:</label>
                <textarea id="pv-edit-desc" class="pv-textarea" rows="2" maxlength="250" placeholder="Введіть опис...">${photo.description || ''}</textarea>
              </div>

              <div class="pv-form-group">
                <label class="pv-label">Хто бачить це фото:</label>
                <select id="pv-edit-visibility" class="pv-select">
                  <option value="" ${!photo.groupCode ? 'selected' : ''}>🌍 Всі користувачі (Публічно)</option>
                  ${activeGroup ? `
                    <option value="${activeGroup}" ${photo.groupCode === activeGroup ? 'selected' : ''}>
                      👥 Тільки група (${activeGroup})
                    </option>
                  ` : ''}
                  ${photo.groupCode && photo.groupCode !== activeGroup ? `
                    <option value="${photo.groupCode}" selected>
                      👥 Тільки група (${photo.groupCode})
                    </option>
                  ` : ''}
                </select>
              </div>

              <div class="pv-form-group">
                <label class="pv-label">Іконка мітки:</label>
                <div class="pv-emoji-grid">
                  ${AVAILABLE_EMOJIS.map(e => `
                    <button type="button" class="pv-emoji-btn ${e === currentEmoji ? 'active' : ''}" data-emoji="${e}">
                      ${e}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="pv-edit-actions">
                <button type="button" class="pv-btn pv-btn-ghost" data-action="cancel-edit">Скасувати</button>
                <button type="button" class="pv-btn pv-btn-primary" id="pv-btn-save">Зберегти зміни</button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="pv-footer">
          <div class="pv-footer-left">
            ${isAuthor && !isEditMode ? `
              <button type="button" class="pv-btn pv-btn-secondary" data-action="start-edit">
                ✏️ Редагувати
              </button>
              <button type="button" class="pv-btn pv-btn-danger" id="pv-btn-delete" title="Видалити фото">
                🗑️
              </button>
            ` : ''}
          </div>
          <button type="button" class="pv-btn pv-btn-secondary" data-action="close">Закрити</button>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Close on any close button or backdrop click
    modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.onclick = close;
    });

    // Toggle edit mode
    const btnStartEdit = modal.querySelector('[data-action="start-edit"]');
    if (btnStartEdit) {
      btnStartEdit.onclick = () => {
        isEditMode = true;
        render();
      };
    }

    const btnCancelEdit = modal.querySelector('[data-action="cancel-edit"]');
    if (btnCancelEdit) {
      btnCancelEdit.onclick = () => {
        isEditMode = false;
        render();
      };
    }

    // Emoji picker
    modal.querySelectorAll('.pv-emoji-btn').forEach(btn => {
      btn.onclick = () => {
        currentEmoji = btn.dataset.emoji;
        modal.querySelectorAll('.pv-emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Save changes
    const btnSave = modal.querySelector('#pv-btn-save');
    if (btnSave) {
      btnSave.onclick = async () => {
        const descInput = modal.querySelector('#pv-edit-desc');
        const visInput = modal.querySelector('#pv-edit-visibility');
        const newDesc = descInput ? descInput.value.trim() : '';
        const newVis = visInput ? visInput.value.trim() : '';

        btnSave.disabled = true;
        btnSave.textContent = 'Збереження...';

        try {
          await updatePhotoDocument(photo.id, {
            description: newDesc,
            groupCode: newVis || null,
            emoji: currentEmoji
          });

          photo.description = newDesc;
          photo.groupCode = newVis || null;
          photo.emoji = currentEmoji;

          showToast('Фото оновлено! ✨', 'success');
          isEditMode = false;
          render();

          if (typeof onChanged === 'function') {
            onChanged('update', photo);
          }
        } catch (err) {
          console.error('Update error:', err);
          showToast('Помилка оновлення', 'error');
          btnSave.disabled = false;
          btnSave.textContent = 'Зберегти зміни';
        }
      };
    }

    // Delete photo
    const btnDelete = modal.querySelector('#pv-btn-delete');
    if (btnDelete) {
      btnDelete.onclick = async () => {
        if (confirm('Видалити цю фотографію з карти назавжди?')) {
          try {
            await deletePhoto(photo);
            showToast('Фото видалено', 'info');
            close();
            if (typeof onChanged === 'function') {
              onChanged('delete', photo);
            }
          } catch (err) {
            console.error('Delete error:', err);
            showToast('Помилка видалення', 'error');
          }
        }
      };
    }
  }

  function close() {
    window.removeEventListener('keydown', onKeyDown);
    modal.remove();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }

  window.addEventListener('keydown', onKeyDown);

  render();
  document.body.appendChild(modal);
}
