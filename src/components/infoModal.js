/**
 * Architecture & Info Modal Component
 */

export function openInfoModal() {
  const container = document.getElementById('modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-backdrop" id="info-modal-backdrop">
      <div class="modal-window">
        <div class="modal-header">
          <h3 class="modal-title"><span>ℹ️</span> Про проект GeoSnap Map</h3>
          <button class="modal-close-btn" id="btn-close-info" aria-label="Закрити">&times;</button>
        </div>

        <div class="modal-body" style="font-size: 13px; line-height: 1.6; color: var(--text-main);">
          <div style="background: var(--bg-subtle); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 8px;">
            <strong>🚀 100% Client-Side Архітектура:</strong>
            <p style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">
              Весь процес обробки медіа, парсинг EXIF-координат, очищення метаданих для приватності та ресайз до WebP виконуються у вашому браузері без Cloud Functions.
            </p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              <strong>💰 Оптимізація Firebase Spark Plan (Безкоштовно):</strong>
              <ul style="padding-left: 18px; margin-top: 4px; color: var(--text-muted); font-size: 12px;">
                <li><strong>Canvas WebP компресія</strong>: Зменшує розмір фото до ~200 КБ, заощаджуючи до 95% трафіку.</li>
                <li><strong>Мікро-мініатюри (100px)</strong>: Дозволяють завантажувати сотні маркерів за лічені кілобайти.</li>
                <li><strong>Geohash Bounding-Box запити</strong>: База Firestore опитується лише для видимого фрагмента екрана.</li>
                <li><strong>Клієнтський кеш (In-Memory Cache)</strong>: Запобігає повторним читанням Firestore при скролі та зумі.</li>
              </ul>
            </div>

            <div>
              <strong>🗺️ Інтерактивні рівні карти:</strong>
              <ul style="padding-left: 18px; margin-top: 4px; color: var(--text-muted); font-size: 12px;">
                <li><strong>Віддалення (Zoom &le; 10)</strong>: Автоматична кластеризація маркерів.</li>
                <li><strong>Середній зум (11–14)</strong>: Емодзі-наклейки.</li>
                <li><strong>Наближення (Zoom &ge; 15)</strong>: Розкриття у фото-мініатюри з мітками.</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-primary" id="btn-close-info-ok">Зрозуміло</button>
        </div>
      </div>
    </div>
  `;

  const backdrop = document.getElementById('info-modal-backdrop');
  const btnClose = document.getElementById('btn-close-info');
  const btnCloseOk = document.getElementById('btn-close-info-ok');

  const close = () => {
    if (backdrop) backdrop.remove();
  };

  btnClose.onclick = close;
  btnCloseOk.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };
}
