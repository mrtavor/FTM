/**
 * Photo Detail Modal Component
 * Displays full photo view, description, coordinates and deletion option
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
  const formattedDate = photo.createdAt ? formatPhotoDate(photo.createdAt) : 'Нещодавно';

  container.innerHTML = `
    <div class="modal-backdrop" id="detail-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <div class="photo-detail-emoji-desc">
            <span class="photo-detail-emoji">${photo.emoji || '📸'}</span>
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: 700; font-size: 15px;">Деталі локації</span>
              <span style="font-size: 11px; color: var(--text-muted);">${photo.lat.toFixed(4)}, ${photo.lng.toFixed(4)}</span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-detail" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <div class="photo-detail-image-box">
            <img class="photo-detail-full-img" src="${photo.mainUrl || photo.thumbUrl}" alt="${photo.description || 'Фото локації'}" />
          </div>

          <div class="photo-detail-meta">
            <div class="photo-detail-desc">${photo.description || 'Без опису'}</div>
            
            <div class="photo-detail-info-row">
              <span>📅 ${formattedDate}</span>
              <span>📍 <a href="https://www.google.com/maps?q=${photo.lat},${photo.lng}" target="_blank" rel="noopener" style="color: var(--accent-terracotta); text-decoration: none;">Google Maps ↗</a></span>
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
      if (confirm('Ви впевнені, що хочете видалити цю гео-мітку з карти?')) {
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

function formatPhotoDate(dateVal) {
  try {
    if (typeof dateVal === 'object' && dateVal.seconds) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date(dateVal).toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return 'Нещодавно';
  }
}
