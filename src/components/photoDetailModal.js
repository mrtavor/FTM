/**
 * Photo Detail Modal Component
 * Displays photo, author, description, and group badge with maximum privacy:
 * - NO raw coordinates exposed
 * - NO Google Maps route links
 * - Robust date formatting
 */
import { getCurrentUserId } from '../services/authService.js';
import { deletePhoto } from '../services/firebase.js';
import { renderMapMarkers } from './map.js';
import { showToast } from '../utils/toast.js';

export function openPhotoDetailModal(photo) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const currentUserId = getCurrentUserId();
  const isOwner = photo.userId === currentUserId || !photo.userId;
  const formattedDate = formatPhotoDate(photo.createdAt);

  container.innerHTML = `
    <div class="modal-backdrop" id="detail-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <div class="photo-detail-emoji-desc">
            <span class="photo-detail-emoji">${photo.emoji || '📸'}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 700; font-size: 15px;">Фотографія на карті</span>
              <span style="font-size: 11px; color: var(--text-muted);">
                ${photo.groupCode ? `👥 Група: <strong>${photo.groupCode}</strong>` : '🌍 Публічна мітка'}
              </span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-detail" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <div class="photo-detail-image-box">
            <img class="photo-detail-full-img" src="${photo.mainUrl || photo.thumbUrl}" alt="${photo.description || 'Фото'}" />
          </div>

          <div class="photo-detail-meta">
            <div class="photo-detail-desc">${photo.description || 'Без опису'}</div>
            
            <div class="photo-detail-info-row">
              <span>👤 Автор: <strong>${photo.authorName || 'Мандрівник'}</strong></span>
              <span>📅 ${formattedDate}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <div>
            ${isOwner ? `
              <button class="btn-danger" id="btn-delete-photo">
                🗑️ Видалити
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

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

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
 * Robust date formatting that never outputs 'Invalid Date'
 */
function formatPhotoDate(dateVal) {
  if (!dateVal) return 'Нещодавно';

  try {
    let dateObj = null;

    // 1. Firestore Timestamp object with .toDate() or .seconds
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
      if (!isNaN(parsed)) {
        dateObj = new Date(parsed);
      }
    }

    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Нещодавно';
    }

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
