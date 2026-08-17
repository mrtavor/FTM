/**
 * Friends Circle, Group Members & Notification Manager
 */
import {
  getActiveGroupCode,
  setActiveGroupCode,
  clearActiveGroup,
  getFilterMode,
  setFilterMode,
  getGroupShareUrl,
  isGroupNotificationEnabled,
  setGroupNotificationEnabled,
  isMemberNotificationEnabled,
  setMemberNotificationEnabled
} from '../services/groupService.js';
import { isGoogleUser, loginWithGoogle } from '../services/authService.js';
import { fetchGroupMembers } from '../services/firebase.js';
import { renderMapMarkers } from './map.js';
import { showToast } from '../utils/toast.js';

export async function openFriendsModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const isGoogle = isGoogleUser();
  const activeGroup = getActiveGroupCode();
  const filterMode = getFilterMode();
  const isGlobalNotify = isGroupNotificationEnabled(activeGroup);

  // Fetch group members if active
  let members = [];
  if (isGoogle && activeGroup) {
    members = await fetchGroupMembers(activeGroup);
  }

  container.innerHTML = `
    <div class="modal-backdrop" id="friends-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>👥</span> Коло друзів</h3>
          <button class="modal-close-btn" id="btn-close-friends" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          ${!isGoogle ? `
            <div style="text-align: center; padding: 16px 8px;">
              <div style="font-size: 44px; margin-bottom: 12px;">🔒</div>
              <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                Потрібен вхід через Google
              </h4>
              <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px;">
                Щоб створювати спільні групи з друзями, отримувати сповіщення та безпечно обмінюватися фото, будь ласка, увійдіть через Google.
              </p>

              <button type="button" id="btn-modal-google-auth" class="btn-primary" style="width: 100%; padding: 12px; background: #FFFFFF; color: #3c4043; border: 1px solid #dadce0; box-shadow: 0 1px 3px rgba(60,64,67,.08); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14px;">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Увійти через Google</span>
              </button>
            </div>
          ` : `
            <!-- Active Group Status Card -->
            <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md);">
              <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
                Ваша активна група:
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
                <span style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">
                  ${activeGroup ? `👥 ${activeGroup}` : '🌍 Загальна карта'}
                </span>
                ${activeGroup ? `
                  <button class="btn-danger" id="btn-leave-group" style="padding: 4px 10px; font-size: 11px;">
                    Вийти
                  </button>
                ` : ''}
              </div>

              ${activeGroup ? `
                <div style="margin-top: 10px; display: flex; gap: 6px;">
                  <button class="btn-primary" id="btn-copy-group-link" style="flex: 1; font-size: 13px; padding: 9px 14px;">
                    🔗 Надіслати запрошення друзям
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Join or Create Group -->
            <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md);">
              <label class="form-label" style="font-size: 13px; margin-bottom: 4px;">Створити або зайти в групу:</label>
              <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 10px;">
                Введіть будь-яке слово (наприклад, <code>ДРУЗІ</code> або <code>КАРПАТИ</code>).
              </p>

              <div style="display: flex; gap: 8px;">
                <input type="text" id="input-new-group-code" class="form-input-text" placeholder="Код групи" value="${activeGroup || ''}" maxlength="30" />
                <button class="btn-primary" id="btn-join-group" style="white-space: nowrap; font-size: 13px;">
                  Зайти
                </button>
              </div>
            </div>

            <!-- Group Notifications & Members Section -->
            ${activeGroup ? `
              <!-- Global Notification Toggle -->
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">🔔 Сповіщення групи</div>
                  <div style="font-size: 11px; color: var(--text-muted);">Сповіщати, коли хтось викладає фото</div>
                </div>
                <label class="switch-toggle">
                  <input type="checkbox" id="toggle-global-notify" ${isGlobalNotify ? 'checked' : ''} />
                  <span class="slider-round"></span>
                </label>
              </div>

              <!-- Members List with Individual Notification Toggles -->
              <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-weight: 700; font-size: 13px;">Учасники групи (${members.length}):</span>
                  <span style="font-size: 11px; color: var(--text-muted);">Сповіщення</span>
                </div>

                ${members.length > 0 ? `
                  <div style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
                    ${members.map((m) => {
                      const memberNotify = isMemberNotificationEnabled(activeGroup, m.name);
                      return `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); padding: 8px 10px; border-radius: var(--radius-sm);">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">👤</span>
                            <div>
                              <div style="font-weight: 600; font-size: 13px;">${m.name}</div>
                              <div style="font-size: 10px; color: var(--text-muted);">${m.count} фото на карті</div>
                            </div>
                          </div>
                          <button type="button" class="btn-member-notify ${memberNotify ? 'active' : ''}" data-name="${m.name}" style="background: ${memberNotify ? '#E8F5E9' : '#F5F5F5'}; color: ${memberNotify ? '#2E7D32' : '#9E9E9E'}; border: 1px solid ${memberNotify ? '#C8E6C9' : '#E0E0E0'}; border-radius: var(--radius-pill); padding: 3px 8px; font-size: 11px; font-weight: 600;">
                            ${memberNotify ? '🔔 Увімк' : '🔕 Вимк'}
                          </button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="font-size: 12px; color: var(--text-muted); padding: 6px 0;">
                    Ще немає доданих фото у цій групі. Опублікуйте перше!
                  </div>
                `}
              </div>

              <!-- Map Filter -->
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); padding: 12px 14px; border-radius: var(--radius-md);">
                <label class="form-label" style="font-size: 12px; margin-bottom: 6px;">Режим карти:</label>
                <div style="display: flex; gap: 8px;">
                  <button id="btn-filter-group-only" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px 0; ${filterMode === 'group' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                    👥 Тільки ${activeGroup}
                  </button>
                  <button id="btn-filter-all" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 8px 0; ${filterMode === 'all' ? 'background: var(--accent-primary); color: #fff;' : ''}">
                    🌍 Всі фото
                  </button>
                </div>
              </div>
            ` : ''}
          `}
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
  const btnGoogleAuth = document.getElementById('btn-modal-google-auth');
  const btnJoin = document.getElementById('btn-join-group');
  const inputCode = document.getElementById('input-new-group-code');
  const btnCopyLink = document.getElementById('btn-copy-group-link');
  const btnLeave = document.getElementById('btn-leave-group');
  const btnFilterGroup = document.getElementById('btn-filter-group-only');
  const btnFilterAll = document.getElementById('btn-filter-all');
  const toggleGlobal = document.getElementById('toggle-global-notify');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  if (btnGoogleAuth) {
    btnGoogleAuth.onclick = async () => {
      try {
        await loginWithGoogle();
        showToast('Успішний вхід через Google! 👥', 'success');
        openFriendsModal();
      } catch (err) {
        showToast('Помилка входу через Google', 'error');
      }
    };
  }

  // Global Notification Toggle
  if (toggleGlobal) {
    toggleGlobal.onchange = () => {
      const active = getActiveGroupCode();
      setGroupNotificationEnabled(active, toggleGlobal.checked);
      showToast(toggleGlobal.checked ? 'Сповіщення групи увімкнено 🔔' : 'Сповіщення групи вимкнено 🔕', 'info');
    };
  }

  // Individual Member Notification Buttons
  document.querySelectorAll('.btn-member-notify').forEach((btn) => {
    btn.onclick = () => {
      const memberName = btn.dataset.name;
      const active = getActiveGroupCode();
      const currentlyOn = btn.classList.contains('active');
      const newState = !currentlyOn;

      setMemberNotificationEnabled(active, memberName, newState);
      if (newState) {
        btn.classList.add('active');
        btn.innerHTML = '🔔 Увімк';
        btn.style.background = '#E8F5E9';
        btn.style.color = '#2E7D32';
        btn.style.borderColor = '#C8E6C9';
        showToast(`Сповіщення від ${memberName} увімкнено`, 'info');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '🔕 Вимк';
        btn.style.background = '#F5F5F5';
        btn.style.color = '#9E9E9E';
        btn.style.borderColor = '#E0E0E0';
        showToast(`Сповіщення від ${memberName} вимкнено`, 'info');
      }
    };
  });

  if (btnJoin && inputCode) {
    btnJoin.onclick = () => {
      const code = inputCode.value.trim().toUpperCase();
      if (!code) {
        showToast('Введіть назву групи', 'error');
        return;
      }
      setActiveGroupCode(code);
      showToast(`Групу "${code}" підключено! 👥`, 'success');
      renderMapMarkers();
      updateHeaderGroupBadge();
      close();
    };
  }

  if (btnCopyLink) {
    btnCopyLink.onclick = () => {
      const active = getActiveGroupCode();
      const url = getGroupShareUrl(active);
      navigator.clipboard.writeText(url).then(() => {
        showToast('Посилання для друзів скопійовано! 📋', 'success');
      }).catch(() => {
        prompt('Скопіюйте це посилання:', url);
      });
    };
  }

  if (btnLeave) {
    btnLeave.onclick = () => {
      clearActiveGroup();
      showToast('Ви вийшли з групи', 'info');
      renderMapMarkers();
      updateHeaderGroupBadge();
      close();
    };
  }

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
