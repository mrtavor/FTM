/**
 * Auto-Update & New Deploy Version Checker
 * Checks if a newer build is deployed on GitHub Pages and prompts users with a 1-click update banner
 */

const CHECK_INTERVAL_MS = 45 * 1000; // Check every 45 seconds
let currentVersion = null;
let isBannerShown = false;

export async function initVersionChecker() {
  try {
    // 1. Fetch initial version of the current running app
    const initial = await fetchVersion();
    if (initial && initial.version) {
      currentVersion = initial.version;
    }

    // 2. Setup periodic poller
    setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    // 3. Also check whenever the user returns/switches back to the tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    });
  } catch (e) {
    console.warn('Version checker init error:', e);
  }
}

async function fetchVersion() {
  const baseUrl = import.meta.env.BASE_URL || './';
  const url = `${baseUrl}version.json?t=${Date.now()}`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });
  if (response.ok) {
    return await response.json();
  }
  return null;
}

async function checkForUpdates() {
  if (isBannerShown) return;

  try {
    const latest = await fetchVersion();
    if (latest && latest.version && currentVersion) {
      if (latest.version > currentVersion) {
        showUpdateBanner();
      }
    }
  } catch (err) {
    // ignore network errors
  }
}

function showUpdateBanner() {
  if (isBannerShown) return;
  isBannerShown = true;

  const banner = document.createElement('div');
  banner.id = 'app-update-banner';
  banner.innerHTML = `
    <div style="position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 99999; background: #2B2D42; color: #FFFFFF; padding: 10px 16px; border-radius: 99px; box-shadow: 0 4px 20px rgba(0,0,0,0.35); display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.15); animation: toastIn 0.3s ease-out;">
      <span>✨ Доступно свіже оновлення сайту!</span>
      <button id="btn-reload-update" style="background: #E07A5F; color: #FFFFFF; border: none; padding: 5px 12px; border-radius: 99px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(224,122,95,0.4);">
        <span>🔄</span>
        <span>Оновити зараз</span>
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  const btn = document.getElementById('btn-reload-update');
  if (btn) {
    btn.onclick = () => {
      // Force reload ignoring cache
      window.location.reload(true);
    };
  }
}
