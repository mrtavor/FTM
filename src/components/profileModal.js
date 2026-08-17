/**
 * Simplified Human-Friendly Profile & Google Sign-In Modal
 */
import {
  getCurrentUser,
  getCurrentDisplayName,
  setDisplayNickname,
  isGoogleUser,
  loginWithGoogle,
  logoutUser
} from '../services/authService.js';
import { updateHeaderGroupBadge } from './friendsModal.js';
import { openGalleryModal } from './galleryModal.js';
import { showToast } from '../utils/toast.js';

export function openProfileModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const isGoogle = isGoogleUser();
  const currentNick = getCurrentDisplayName();
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="modal-backdrop" id="profile-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>👤</span> Мій профіль</h3>
          <button class="modal-close-btn" id="btn-close-profile" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Display Name on Map -->
          <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md);">
            <label class="form-label" style="margin-bottom: 4px;">Ваше ім'я на карті:</label>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
              Це ім'я бачитимуть інші під вашими фотографіями.
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="input-nickname" class="form-input-text" value="${currentNick}" placeholder="Ваше ім'я" maxlength="30" />
              <button class="btn-primary" id="btn-save-nickname" style="white-space: nowrap; padding: 0 14px; font-size: 13px;">
                Зберегти
              </button>
            </div>
          </div>

          <!-- My Photos Gallery Shortcut -->
          <div>
            <button type="button" id="btn-profile-open-gallery" class="btn-secondary" style="width: 100%; padding: 11px; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>🖼️</span>
              <span>Моя галерея опублікованих фото</span>
            </button>
          </div>

          <!-- Google Account Card -->
          <div style="border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md);">
            ${!isGoogle ? `
              <div style="margin-bottom: 12px;">
                <span style="font-weight: 700; font-size: 14px; display: block; margin-bottom: 4px;">Вхід через Google</span>
                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                  Увійдіть через Google, щоб розблокувати створення груп друзів та зберегти свої локації.
                </p>
              </div>

              <button type="button" id="btn-google-login" class="btn-primary" style="width: 100%; padding: 11px; background: #FFFFFF; color: #3c4043; border: 1px solid #dadce0; box-shadow: 0 1px 3px rgba(60,64,67,.08); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 14px;">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Увійти через Google</span>
              </button>
            ` : `
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 11px; color: var(--accent-sage); font-weight: 700;">✓ ПІДКЛЮЧЕНО GOOGLE</div>
                  <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 2px;">
                    ${user?.email || 'Google Акаунт'}
                  </div>
                </div>
                <button class="btn-danger" id="btn-logout" style="font-size: 12px; padding: 6px 12px;">
                  Вийти
                </button>
              </div>
            `}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-close-profile-footer">Закрити</button>
        </div>
      </div>
    </div>
  `;

  attachProfileEvents();
}

function attachProfileEvents() {
  const backdrop = document.getElementById('profile-modal-backdrop');
  const btnClose = document.getElementById('btn-close-profile');
  const btnCloseFooter = document.getElementById('btn-close-profile-footer');
  const btnSaveNick = document.getElementById('btn-save-nickname');
  const inputNick = document.getElementById('input-nickname');
  const btnGoogle = document.getElementById('btn-google-login');
  const btnLogout = document.getElementById('btn-logout');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  const btnProfileGallery = document.getElementById('btn-profile-open-gallery');
  if (btnProfileGallery) {
    btnProfileGallery.onclick = () => {
      close();
      openGalleryModal();
    };
  }

  if (btnSaveNick && inputNick) {
    btnSaveNick.onclick = async () => {
      const val = inputNick.value.trim();
      if (!val) {
        showToast('Введіть ім\'я', 'error');
        return;
      }
      await setDisplayNickname(val);
      showToast(`Ім'я збережено: ${val} ✨`, 'success');
      updateHeaderNickDisplay();
    };
  }

  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      try {
        await loginWithGoogle();
        showToast('Успішний вхід через Google! 🛡️', 'success');
        updateHeaderNickDisplay();
        updateHeaderGroupBadge();
        close();
      } catch (err) {
        showToast('Помилка входу через Google', 'error');
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      await logoutUser();
      showToast('Ви вийшли з акаунту', 'info');
      updateHeaderNickDisplay();
      updateHeaderGroupBadge();
      close();
    };
  }
}

export function updateHeaderNickDisplay() {
  const headerNick = document.getElementById('header-user-nick');
  if (headerNick) {
    headerNick.textContent = getCurrentDisplayName();
  }
}
