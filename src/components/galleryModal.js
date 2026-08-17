/**
 * Enhanced Gallery Modal Component
 * Displays tabs: '👥 Фото групи' (all members' photos) & '👤 Мої фото' (my own uploads)
 * Allows clicking on any photo to open details & fly to it on map
 */
import { getCurrentUserId } from '../services/authService.js';
import { getActiveGroupCode, getActiveGroupName } from '../services/groupService.js';
import { fetchUserPhotos, fetchGroupPhotos } from '../services/firebase.js';
import { showPhotoViewer } from './photoViewer.js';
import { openUploadModal } from './uploadModal.js';
import { flyToCoords, renderMapMarkers } from './map.js';
import { showToast } from '../utils/toast.js';

let activeTab = 'group'; // 'group' or 'mine'

export async function openGalleryModal(initialTab) {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const currentUserId = getCurrentUserId();
  const activeGroup = getActiveGroupCode();
  const groupName = getActiveGroupName();

  if (initialTab) {
    activeTab = initialTab;
  } else if (!activeGroup) {
    activeTab = 'mine';
  }

  let groupPhotos = [];
  let userPhotos = [];

  if (activeGroup) {
    groupPhotos = await fetchGroupPhotos(activeGroup);
  }
  userPhotos = await fetchUserPhotos(currentUserId);

  const displayedPhotos = activeTab === 'group' && activeGroup ? groupPhotos : userPhotos;

  container.innerHTML = `
    <div class="modal-backdrop" id="gallery-modal-backdrop">
      <div class="modal-window" style="max-width: 620px;">
        <div class="modal-header">
          <h3 class="modal-title"><span>🖼️</span> Галерея фотографій</h3>
          <button class="modal-close-btn" id="btn-close-gallery" aria-label="Закрити">&times;</button>
        </div>

        <!-- Gallery Tabs (Group vs Mine) -->
        ${activeGroup ? `
          <div style="display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle);">
            <button id="tab-gallery-group" class="btn-secondary" style="flex: 1; border-radius: 0; border: none; border-bottom: 2px solid ${activeTab === 'group' ? 'var(--accent-primary)' : 'transparent'}; font-weight: ${activeTab === 'group' ? '700' : '500'}; background: transparent; padding: 12px 6px; font-size: 13px; color: ${activeTab === 'group' ? 'var(--accent-primary)' : 'var(--text-muted)'};">
              👥 Фото групи "${groupName}" (${groupPhotos.length})
            </button>
            <button id="tab-gallery-mine" class="btn-secondary" style="flex: 1; border-radius: 0; border: none; border-bottom: 2px solid ${activeTab === 'mine' ? 'var(--accent-primary)' : 'transparent'}; font-weight: ${activeTab === 'mine' ? '700' : '500'}; background: transparent; padding: 12px 6px; font-size: 13px; color: ${activeTab === 'mine' ? 'var(--accent-primary)' : 'var(--text-muted)'};">
              👤 Мої фото (${userPhotos.length})
            </button>
          </div>
        ` : ''}

        <div class="modal-body" style="padding: 16px;">
          ${displayedPhotos.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 10px;">
              ${displayedPhotos.map((photo) => `
                <div class="gallery-photo-card" data-id="${photo.id}" style="position: relative; background: var(--bg-subtle); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.15s ease;">
                  <div style="width: 100%; aspect-ratio: 1/1; overflow: hidden; background: #E2E8F0;">
                    <img src="${photo.thumbUrl || photo.mainUrl}" alt="${photo.description || 'Фото'}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" />
                  </div>

                  <!-- Author / Visibility Badge -->
                  <div style="position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: var(--radius-pill); backdrop-filter: blur(4px); max-width: 85px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${photo.authorName ? `👤 ${photo.authorName}` : (photo.groupCode ? `👥 ${photo.groupCode}` : '🌍 Публічно')}
                  </div>

                  <!-- Emoji Badge -->
                  <div style="position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,0.9); font-size: 12px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                    ${photo.emoji || '📸'}
                  </div>

                  <div style="padding: 8px;">
                    <div style="font-size: 11px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${photo.description || 'Без опису'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 30px 10px;">
              <div style="font-size: 48px; margin-bottom: 12px;">📷</div>
              <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">
                ${activeTab === 'group' ? 'У групі ще немає фотографій' : 'У вас ще немає доданих фото'}
              </h4>
              <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                Опублікуйте перше фото з пам'ятного місця на карті!
              </p>
              <button class="btn-primary" id="btn-gallery-add-first" style="font-size: 13px; padding: 10px 20px;">
                ➕ Опублікувати перше фото
              </button>
            </div>
          `}
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-close-gallery-footer">Закрити</button>
        </div>
      </div>
    </div>
  `;

  attachGalleryEvents(displayedPhotos);
}

function attachGalleryEvents(photos) {
  const backdrop = document.getElementById('gallery-modal-backdrop');
  const btnClose = document.getElementById('btn-close-gallery');
  const btnCloseFooter = document.getElementById('btn-close-gallery-footer');
  const btnAddFirst = document.getElementById('btn-gallery-add-first');
  const tabGroup = document.getElementById('tab-gallery-group');
  const tabMine = document.getElementById('tab-gallery-mine');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  if (tabGroup) {
    tabGroup.onclick = () => {
      activeTab = 'group';
      openGalleryModal('group');
    };
  }

  if (tabMine) {
    tabMine.onclick = () => {
      activeTab = 'mine';
      openGalleryModal('mine');
    };
  }

  if (btnAddFirst) {
    btnAddFirst.onclick = () => {
      close();
      openUploadModal();
    };
  }

  // Click on any photo card to open details & fly to it
  document.querySelectorAll('.gallery-photo-card').forEach((card) => {
    card.onclick = () => {
      const photoId = card.dataset.id;
      const targetPhoto = photos.find(p => p.id === photoId);
      if (targetPhoto) {
        close();
        flyToCoords(targetPhoto.lat, targetPhoto.lng, 15);
        showPhotoViewer(targetPhoto, () => renderMapMarkers());
      }
    };
  });
}
