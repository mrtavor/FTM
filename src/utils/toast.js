/**
 * Toast Notification Utility
 * Max 3 simultaneous toasts to prevent screen overflow on mobile
 */

const MAX_TOASTS = 3;

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Remove oldest toast if over limit
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= MAX_TOASTS) {
    existing[0].remove();
  }

  const icons = { info: 'ℹ️', success: '✅', error: '⚠️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 16px;">${icons[type] || 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, duration);
}
