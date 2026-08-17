/**
 * Firebase Settings Modal Component
 * Allows users to input Firebase credentials directly in browser or reset to default
 */
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, isConfigured } from '../utils/config.js';
import { showToast } from '../utils/toast.js';

export function openSettingsModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  const currentConfig = getFirebaseConfig();
  const configured = isConfigured();

  container.innerHTML = `
    <div class="modal-backdrop" id="settings-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>⚙️</span> Налаштування Firebase</h3>
          <button class="modal-close-btn" id="btn-close-settings" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body">
          <div style="font-size: 13px; color: var(--text-muted);">
            Статус підключення: 
            <span style="font-weight: 700; color: ${configured ? 'var(--accent-sage)' : 'var(--accent-amber)'}">
              ${configured ? '🟢 Підключено до Firebase' : '🟡 Демо-режим (Без бекенду)'}
            </span>
          </div>

          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
            Ви можете вставити ваші ключі з Firebase Console нижче. Вони зберігаються локально у вашому браузері (localStorage) і дозволяють працювати на GitHub Pages без розкриття ключів у відкритому репозиторії.
          </p>

          <form id="firebase-settings-form" style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label class="form-label" style="font-size: 11px;">API Key:</label>
              <input type="text" id="cfg-apiKey" class="form-input-text" value="${currentConfig.apiKey || ''}" placeholder="AIzaSy..." required />
            </div>

            <div>
              <label class="form-label" style="font-size: 11px;">Auth Domain:</label>
              <input type="text" id="cfg-authDomain" class="form-input-text" value="${currentConfig.authDomain || ''}" placeholder="project.firebaseapp.com" />
            </div>

            <div>
              <label class="form-label" style="font-size: 11px;">Project ID:</label>
              <input type="text" id="cfg-projectId" class="form-input-text" value="${currentConfig.projectId || ''}" placeholder="my-geo-project" required />
            </div>

            <div>
              <label class="form-label" style="font-size: 11px;">Storage Bucket:</label>
              <input type="text" id="cfg-storageBucket" class="form-input-text" value="${currentConfig.storageBucket || ''}" placeholder="my-geo-project.appspot.com" required />
            </div>

            <div>
              <label class="form-label" style="font-size: 11px;">App ID:</label>
              <input type="text" id="cfg-appId" class="form-input-text" value="${currentConfig.appId || ''}" placeholder="1:123456:web:abcdef" />
            </div>
          </form>
        </div>

        <div class="modal-footer" style="justify-content: space-between;">
          <button class="btn-danger" id="btn-reset-config" style="font-size: 12px;">Скинути</button>
          <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" id="btn-cancel-settings">Скасувати</button>
            <button class="btn-primary" id="btn-save-settings">Зберегти та оновити</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachSettingsEvents();
}

function attachSettingsEvents() {
  const backdrop = document.getElementById('settings-modal-backdrop');
  const btnClose = document.getElementById('btn-close-settings');
  const btnCancel = document.getElementById('btn-cancel-settings');
  const btnSave = document.getElementById('btn-save-settings');
  const btnReset = document.getElementById('btn-reset-config');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCancel.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  btnSave.onclick = () => {
    const newConfig = {
      apiKey: document.getElementById('cfg-apiKey').value.trim(),
      authDomain: document.getElementById('cfg-authDomain').value.trim(),
      projectId: document.getElementById('cfg-projectId').value.trim(),
      storageBucket: document.getElementById('cfg-storageBucket').value.trim(),
      appId: document.getElementById('cfg-appId').value.trim()
    };

    if (!newConfig.apiKey || !newConfig.projectId) {
      showToast('Введіть щонайменше API Key та Project ID', 'error');
      return;
    }

    saveFirebaseConfig(newConfig);
    showToast('Налаштування збережено! Перезавантаження...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  btnReset.onclick = () => {
    if (confirm('Очистити налаштування Firebase?')) {
      clearFirebaseConfig();
      showToast('Налаштування скинуто. Перезавантаження...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  };
}
