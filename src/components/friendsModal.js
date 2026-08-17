/**
 * Friends Circle / Groups Modal Component
 * Create, join, share and filter by group secret codes.
 */
import {
  getActiveGroupCode,
  setActiveGroupCode,
  clearActiveGroup,
  getFilterMode,
  setFilterMode,
  getGroupShareUrl
} from '../services/groupService.js';
import { renderMapMarkers } from './map.js';
import { showToast } from '../utils/toast.js';

export function openFriendsModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const activeGroup = getActiveGroupCode();
  const filterMode = getFilterMode();

  container.innerHTML = `
    <div class="modal-backdrop" id="friends-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>👥</span> Групи та Коло друзів</h3>
          <button class="modal-close-btn" id="btn-close-friends" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Active Group Status Card -->
          <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md);">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
              Поточна активна група:
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
              <span style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">
                ${activeGroup ? `👥 ${activeGroup}` : '🌍 Загальна карта (Без групи)'}
              </span>
              ${activeGroup ? `
                <button class="btn-danger" id="btn-leave-group" style="padding: 4px 10px; font-size: 11px;">
                  Вийти з групи
                </button>
              ` : ''}
            </div>

            ${activeGroup ? `
              <div style="margin-top: 10px; display: flex; gap: 6px;">
                <button class="btn-primary" id="btn-copy-group-link" style="flex: 1; font-size: 12px; padding: 8px 12px;">
                  🔗 Скопіювати посилання для друзів
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Join or Create Group Section -->
          <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md);">
            <label class="form-label" style="font-size: 13px;">Створити або приєднатися до групи:</label>
            <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">
              Придумайте секретний код (наприклад, <code>FRIENDS-2026</code> або <code>FAMILY</code>) та надішліть його друзям. Тільки ті, хто має цей код, зможуть бачити спільні фотографії.
            </p>

            <div style="display: flex; gap: 8px;">
              <input type="text" id="input-new-group-code" class="form-input-text" placeholder="Код групи (напр. TRIP2026)" value="${activeGroup || ''}" maxlength="30" />
              <button class="btn-primary" id="btn-join-group" style="white-space: nowrap; font-size: 13px;">
                Приєднатися
              </button>
            </div>

            <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
              <button type="button" id="btn-generate-code" style="font-size: 11px; color: var(--accent-terracotta); font-weight: 600;">
                🎲 Згенерувати випадковий код
              </button>
            </div>
          </div>

          <!-- Map Filter Mode Toggle -->
          ${activeGroup ? `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-md);">
              <label class="form-label" style="font-size: 12px; margin-bottom: 6px;">Режим відображення на карті:</label>
              <div style="display: flex; gap: 8px;">
                <button id="btn-filter-group-only" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px 0; ${filterMode === 'group' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                  👥 Тільки наша група
                </button>
                <button id="btn-filter-all" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px 0; ${filterMode === 'all' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                  🌍 Всі фото
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-close-friends-footer">Закрити</button>
        </div>
      </div>
    </div>
  `;

  attachFriendsEvents();
}

function attachFriendsEvents() {
  const backdrop = document.getElementById('friends-modal-backdrop');
  const btnClose = document.getElementById('btn-close-friends');
  const btnCloseFooter = document.getElementById('btn-close-friends-footer');
  const btnJoin = document.getElementById('btn-join-group');
  const inputCode = document.getElementById('input-new-group-code');
  const btnGenerate = document.getElementById('btn-generate-code');
  const btnCopyLink = document.getElementById('btn-copy-group-link');
  const btnLeave = document.getElementById('btn-leave-group');
  const btnFilterGroup = document.getElementById('btn-filter-group-only');
  const btnFilterAll = document.getElementById('btn-filter-all');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  // Join / Set group
  if (btnJoin && inputCode) {
    btnJoin.onclick = () => {
      const code = inputCode.value.trim().toUpperCase();
      if (!code) {
        showToast('Введіть код групи', 'error');
        return;
      }
      setActiveGroupCode(code);
      showToast(`Ви приєдналися до групи "${code}" 👥`, 'success');
      renderMapMarkers();
      updateHeaderGroupBadge();
      close();
    };
  }

  // Generate random code
  if (btnGenerate && inputCode) {
    btnGenerate.onclick = () => {
      const rand = 'GROUP-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      inputCode.value = rand;
    };
  }

  // Copy link
  if (btnCopyLink) {
    btnCopyLink.onclick = () => {
      const active = getActiveGroupCode();
      const url = getGroupShareUrl(active);
      navigator.clipboard.writeText(url).then(() => {
        showToast('Посилання для запрошення друзів скопійовано! 📋', 'success');
      }).catch(() => {
        prompt('Скопіюйте це посилання:', url);
      });
    };
  }

  // Leave group
  if (btnLeave) {
    btnLeave.onclick = () => {
      clearActiveGroup();
      showToast('Ви вийшли з групи', 'info');
      renderMapMarkers();
      updateHeaderGroupBadge();
      close();
    };
  }

  // Filter mode
  if (btnFilterGroup) {
    btnFilterGroup.onclick = () => {
      setFilterMode('group');
      showToast('Відображаються лише фото вашої групи', 'info');
      renderMapMarkers();
      close();
    };
  }

  if (btnFilterAll) {
    btnFilterAll.onclick = () => {
      setFilterMode('all');
      showToast('Відображаються всі фото', 'info');
      renderMapMarkers();
      close();
    };
  }
}

export function updateHeaderGroupBadge() {
  const badge = document.getElementById('header-group-badge');
  if (!badge) return;
  const active = getActiveGroupCode();
  if (active) {
    badge.style.display = 'inline-flex';
    badge.querySelector('.btn-text').textContent = active;
  } else {
    badge.style.display = 'none';
  }
}
