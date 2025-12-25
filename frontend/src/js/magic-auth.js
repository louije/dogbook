/**
 * Magic Link Authentication
 * Detects ?magic= parameter, sets cookie, enables edit mode
 */

const COOKIE_NAME = 'magicToken';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Initialize magic auth on page load
 * Checks for ?magic= param or existing cookie
 */
export function initMagicAuth(text) {
  const urlParams = new URLSearchParams(window.location.search);
  const magicToken = urlParams.get('magic');

  if (magicToken) {
    // Set secure cookie
    setMagicCookie(magicToken);

    // Clean URL (remove ?magic=)
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    // Show notification
    showNotification(text.magic.activated, 'success');

    // Enable edit mode immediately
    enableEditMode(text);
  } else if (hasMagicCookie()) {
    // Cookie already set from previous visit
    enableEditMode(text);
  }
}

/**
 * Set magic token cookie
 * Uses domain attribute to share cookie across subdomains (e.g., example.com and niche.example.com)
 */
function setMagicCookie(token) {
  // Get root domain for cookie sharing across subdomains
  const hostParts = window.location.hostname.split('.');
  const rootDomain = hostParts.length > 2
    ? '.' + hostParts.slice(-2).join('.')  // .example.com
    : hostParts.length === 2
      ? '.' + hostParts.join('.')  // .example.com from example.com
      : '';  // localhost

  const isSecure = window.location.protocol === 'https:';
  // SameSite=None required for cross-origin requests, but requires Secure
  const sameSite = isSecure ? 'None' : 'Lax';

  let cookieValue = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=${sameSite}`;
  if (rootDomain) cookieValue += `; domain=${rootDomain}`;
  if (isSecure) cookieValue += '; Secure';

  document.cookie = cookieValue;
}

/**
 * Check if magic cookie exists
 */
export function hasMagicCookie() {
  return document.cookie.includes(`${COOKIE_NAME}=`);
}

/**
 * Get magic token value from cookie
 */
export function getMagicToken() {
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Clear magic cookie and reload
 */
export function clearMagicCookie() {
  // Get root domain to clear cookie properly
  const hostParts = window.location.hostname.split('.');
  const rootDomain = hostParts.length > 2
    ? '.' + hostParts.slice(-2).join('.')
    : hostParts.length === 2
      ? '.' + hostParts.join('.')
      : '';

  let cookieValue = `${COOKIE_NAME}=; path=/; max-age=0`;
  if (rootDomain) cookieValue += `; domain=${rootDomain}`;

  document.cookie = cookieValue;
  location.reload();
}

/**
 * Enable edit mode UI
 */
function enableEditMode(text) {
  // Show all edit buttons
  document.querySelectorAll('.edit-button, .add-button, .edit-owner-button').forEach(btn => {
    btn.style.display = '';
    btn.removeAttribute('hidden');
  });

  // Add visual indicator
  document.body.classList.add('magic-mode');

  // Show mode indicator in header
  showMagicIndicator(text);
}

/**
 * Show magic mode indicator with deactivate button
 */
function showMagicIndicator(text) {
  // Don't add if already exists
  if (document.querySelector('.magic-indicator')) return;

  const indicator = document.createElement('div');
  indicator.className = 'magic-indicator';
  indicator.innerHTML = `
    <span class="magic-indicator__text">${text.magic.indicator}</span>
    <button
      type="button"
      class="magic-indicator__close"
      onclick="window.confirmDeactivateMagic()"
      aria-label="${text.form.close}"
      title="${text.magic.deactivate_confirm}"
    >×</button>
  `;
  document.body.prepend(indicator);
}

/**
 * Confirm and deactivate magic mode
 * Global function for onclick handler
 */
window.confirmDeactivateMagic = function() {
  const text = window.APP_TEXT || { magic: { deactivate_confirm: 'Désactiver le mode édition ?' } };
  if (confirm(text.magic.deactivate_confirm)) {
    clearMagicCookie();
  }
};

/**
 * Show toast notification
 */
export function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `notification notification--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('notification--visible');
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('notification--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
