/**
 * Privacy-First Profile & Account Modal
 * Allows setting a custom display nickname and creating/logging into
 * dedicated in-app accounts without sharing real personal emails or passwords.
 */
import {
  getCurrentUser,
  getCurrentDisplayName,
  setDisplayNickname,
  registerDedicatedAccount,
  loginDedicatedAccount,
  loginWithGoogle,
  logoutUser
} from '../services/authService.js';
import { showToast } from '../utils/toast.js';

export function openProfileModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const user = getCurrentUser();
  const currentNick = getCurrentDisplayName();
  const isAnon = !user || user.isAnonymous;

  container.innerHTML = `
    <div class="modal-backdrop" id="profile-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>👤</span> Мій профіль та акаунт</h3>
          <button class="modal-close-btn" id="btn-close-profile" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <!-- 1. Quick Nickname Section -->
          <div style="background: var(--bg-subtle); padding: 14px; border-radius: var(--radius-md);">
            <label class="form-label" style="margin-bottom: 4px;">Ваше відображуване ім'я / нікнейм:</label>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
              Це ім'я бачитимуть інші користувачі на ваших фотографіях.
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="input-nickname" class="form-input-text" value="${currentNick}" placeholder="Наприклад: Мандрівник_Київ" maxlength="40" />
              <button class="btn-primary" id="btn-save-nickname" style="white-space: nowrap; padding: 0 14px; font-size: 13px;">
                Зберегти
              </button>
            </div>
          </div>

          <!-- 2. Account Status & Dedicated In-App Auth -->
          <div style="border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 700; font-size: 13px;">Статус акаунту:</span>
              <span style="font-size: 12px; font-weight: 600; color: ${isAnon ? 'var(--accent-amber)' : 'var(--accent-sage)'}">
                ${isAnon ? '🟡 Тимчасовий (Анонімний)' : '🟢 Постійний акаунт'}
              </span>
            </div>

            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">
              ${isAnon 
                ? 'Ви можете створити власний логін і пароль спеціально для цього сайту. Жодні ваші реальні паролі чи особисті дані з інших сервісів не передаються.'
                : `Ви увійшли як <strong>${user.email?.replace('@geosnap.local', '') || user.displayName}</strong>`
              }
            </div>

            ${isAnon ? `
              <!-- Google Sign In Button (Maximum Security) -->
              <button type="button" id="btn-google-login" class="btn-primary" style="width: 100%; margin-bottom: 12px; background: #FFFFFF; color: #3c4043; border: 1px solid #dadce0; box-shadow: 0 1px 3px rgba(60,64,67,.08); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Увійти через Google (Максимальний захист)</span>
              </button>

              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
                <span style="font-size: 11px; color: var(--text-muted);">або окремий логін без пошти</span>
                <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
              </div>

              <!-- Tabs for In-App Login / Register -->
              <div style="display: flex; gap: 6px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                <button type="button" id="tab-btn-register" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 6px 0; background: var(--bg-surface); border-color: var(--accent-primary);">Створити акаунт</button>
                <button type="button" id="tab-btn-login" class="btn-secondary" style="flex: 1; font-size: 12px; padding: 6px 0;">Увійти</button>
              </div>

              <!-- Register Form -->
              <form id="form-auth-register" style="display: flex; flex-direction: column; gap: 8px;">
                <div>
                  <label class="form-label" style="font-size: 11px;">Придумайте логін / нік:</label>
                  <input type="text" id="reg-username" class="form-input-text" placeholder="alex99" required autocomplete="username" />
                </div>
                <div>
                  <label class="form-label" style="font-size: 11px;">Придумайте пароль (PIN або код для карти):</label>
                  <input type="password" id="reg-password" class="form-input-text" placeholder="Мінімум 6 символів" required minlength="6" autocomplete="new-password" />
                </div>
                <button type="submit" class="btn-primary" style="margin-top: 4px; font-size: 13px;">
                  Зареєструвати мій акаунт
                </button>
              </form>

              <!-- Login Form -->
              <form id="form-auth-login" style="display: none; flex-direction: column; gap: 8px;">
                <div>
                  <label class="form-label" style="font-size: 11px;">Ваш логін:</label>
                  <input type="text" id="login-username" class="form-input-text" placeholder="alex99" required autocomplete="username" />
                </div>
                <div>
                  <label class="form-label" style="font-size: 11px;">Пароль:</label>
                  <input type="password" id="login-password" class="form-input-text" placeholder="Введіть пароль" required autocomplete="current-password" />
                </div>
                <button type="submit" class="btn-primary" style="margin-top: 4px; font-size: 13px;">
                  Увійти в акаунт
                </button>
              </form>
            ` : `
              <div style="display: flex; justify-content: flex-end;">
                <button class="btn-secondary" id="btn-logout" style="font-size: 12px; color: var(--accent-coral);">
                  🚪 Вийти з акаунту
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

  const tabReg = document.getElementById('tab-btn-register');
  const tabLog = document.getElementById('tab-btn-login');
  const formReg = document.getElementById('form-auth-register');
  const formLog = document.getElementById('form-auth-login');
  const btnGoogle = document.getElementById('btn-google-login');
  const btnLogout = document.getElementById('btn-logout');

  // Google Login
  if (btnGoogle) {
    btnGoogle.onclick = async () => {
      try {
        await loginWithGoogle();
        showToast('Успішний вхід через Google! 🛡️', 'success');
        updateHeaderNickDisplay();
        close();
      } catch (err) {
        console.error(err);
        showToast('Помилка входу через Google: ' + (err.message || ''), 'error');
      }
    };
  }

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseFooter.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  // Save display nickname
  if (btnSaveNick && inputNick) {
    btnSaveNick.onclick = async () => {
      const val = inputNick.value.trim();
      if (!val) {
        showToast('Введіть ім\'я', 'error');
        return;
      }
      await setDisplayNickname(val);
      showToast(`Нікнейм оновлено: ${val} ✨`, 'success');
      updateHeaderNickDisplay();
    };
  }

  // Switch tabs
  if (tabReg && tabLog && formReg && formLog) {
    tabReg.onclick = () => {
      tabReg.style.borderColor = 'var(--accent-primary)';
      tabReg.style.background = 'var(--bg-surface)';
      tabLog.style.borderColor = 'var(--border-color)';
      tabLog.style.background = 'var(--bg-subtle)';
      formReg.style.display = 'flex';
      formLog.style.display = 'none';
    };

    tabLog.onclick = () => {
      tabLog.style.borderColor = 'var(--accent-primary)';
      tabLog.style.background = 'var(--bg-surface)';
      tabReg.style.borderColor = 'var(--border-color)';
      tabReg.style.background = 'var(--bg-subtle)';
      formLog.style.display = 'flex';
      formReg.style.display = 'none';
    };

    // Form Register
    formReg.onsubmit = async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('reg-username').value.trim();
      const passVal = document.getElementById('reg-password').value;
      const nickVal = inputNick ? inputNick.value.trim() : userVal;

      try {
        await registerDedicatedAccount(userVal, passVal, nickVal);
        showToast('Акаунт створено та підключено! 🎉', 'success');
        updateHeaderNickDisplay();
        close();
      } catch (err) {
        showToast('Помилка реєстрації: ' + (err.message || 'Спробуйте інший логін'), 'error');
      }
    };

    // Form Login
    formLog.onsubmit = async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value.trim();
      const passVal = document.getElementById('login-password').value;

      try {
        await loginDedicatedAccount(userVal, passVal);
        showToast('Успішний вхід у ваш акаунт! 🚀', 'success');
        updateHeaderNickDisplay();
        close();
      } catch (err) {
        showToast('Невірний логін або пароль', 'error');
      }
    };
  }

  // Logout
  if (btnLogout) {
    btnLogout.onclick = async () => {
      await logoutUser();
      showToast('Ви вийшли з акаунту', 'info');
      updateHeaderNickDisplay();
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
