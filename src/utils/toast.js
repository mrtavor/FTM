/**
 * Toast Notification Utility
 * Max 2 simultaneous toasts, with deduplication to prevent notification spam
 */

const MAX_TOASTS = 2;
const recentToasts = new Map(); // msg -> timestamp

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container || !message) return;

  // Deduplicate exact same message within 3 seconds
  const now = Date.now();
  const lastTime = recentToasts.get(message) || 0;
  if (now - lastTime < 3000) {
    return;
  }
  recentToasts.set(message, now);
  if (recentToasts.size > 30) {
    recentToasts.clear();
  }

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
