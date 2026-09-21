import { defaults, normalizePreferences, type Preferences } from '../lib/preferences';
import { readStorage, writeStorage } from '../lib/storage';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let preferences = normalizePreferences({
  theme: readStorage('yb_theme'), face: readStorage('yb_face'), size: readStorage('yb_size'),
  line: readStorage('yb_line_height'), width: readStorage('yb_reading_width'),
});
const root = document.documentElement;
function apply() {
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && media.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--reading-size', `${preferences.size}px`);
  root.style.setProperty('--reading-line', preferences.line);
  root.style.setProperty('--reading-width', `${preferences.width}px`);
  root.style.setProperty('--reading-font', `var(--${preferences.face === 'sans' ? 'ui' : preferences.face})`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1d1e1b' : '#f8f4eb');
  document.querySelector('#theme-toggle')?.setAttribute('aria-label', dark ? '切换到日间模式' : '切换到夜间模式');
  document.querySelectorAll<HTMLSelectElement>('[data-preference]').forEach(select => {
    select.value = preferences[select.dataset.preference as keyof Preferences];
  });
}
function save() {
  const keys = { theme: 'yb_theme', face: 'yb_face', size: 'yb_size', line: 'yb_line_height', width: 'yb_reading_width' };
  let saved = true;
  for (const key of Object.keys(keys) as (keyof Preferences)[]) saved = writeStorage(keys[key], preferences[key]) && saved;
  if (!saved) {
    const status = document.querySelector('#status');
    if (status) status.textContent = '设置已应用，但此浏览器无法保存。';
  }
  apply();
}
document.querySelectorAll<HTMLSelectElement>('[data-preference]').forEach(select => {
  select.addEventListener('change', () => {
    preferences = normalizePreferences({ ...preferences, [select.dataset.preference!]: select.value }); save();
  });
});
document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  preferences.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; save();
});
document.querySelector('[data-reset-preferences]')?.addEventListener('click', () => { preferences = { ...defaults }; save(); });
media.addEventListener('change', apply);
window.addEventListener('storage', event => {
  if (event.key === 'yb_theme') { preferences.theme = normalizePreferences({ theme: event.newValue }).theme; apply(); }
});
apply();

const focusButton = document.querySelector<HTMLButtonElement>('[data-focus-reading]');
const exitButton = document.querySelector<HTMLButtonElement>('.exit-focus');
function focusReading(on: boolean) {
  document.body.classList.toggle('focus-reading', on);
  focusButton?.setAttribute('aria-pressed', String(on));
  if (exitButton) exitButton.hidden = !on;
  (on ? exitButton : focusButton)?.focus();
}
focusButton?.addEventListener('click', () => focusReading(true));
exitButton?.addEventListener('click', () => focusReading(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (document.body.classList.contains('focus-reading')) focusReading(false);
    document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(details => {
      details.open = false; details.querySelector('summary')?.focus();
    });
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); location.href = '/search/'; }
});
document.addEventListener('click', event => {
  document.querySelectorAll<HTMLDetailsElement>('.user-menu[open]').forEach(details => {
    if (event.target instanceof Node && !details.contains(event.target)) details.open = false;
  });
});
