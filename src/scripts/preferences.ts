import {
  defaults,
  migratePreferences,
  normalizePreferences,
  type Preferences,
} from '../lib/preferences';
import { readStorage, writeStorage } from '../lib/storage';
const media = matchMedia('(prefers-color-scheme: dark)');
let preferences = migratePreferences(readStorage);
const root = document.documentElement;
function apply() {
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && media.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.paper = preferences.paper;
  root.dataset.dropcap = preferences.dropcap;
  root.style.setProperty('--reading-size', preferences.size + 'px');
  root.style.setProperty('--reading-line', preferences.line);
  root.style.setProperty('--reading-width', preferences.width + 'px');
  root.style.setProperty(
    '--reading-font',
    'var(--' + (preferences.face === 'sans' ? 'ui' : preferences.face) + ')',
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#181b1e' : '#f8f5ee');
  document
    .querySelector('#theme-toggle')
    ?.setAttribute('aria-label', dark ? '切换到日间模式' : '切换到夜间模式');
  document
    .querySelectorAll<HTMLSelectElement>('[data-preference]')
    .forEach((s) => (s.value = preferences[s.dataset.preference as keyof Preferences]));
}
function save() {
  const keys = {
    theme: 'yb_theme',
    face: 'yb_face',
    size: 'yb_size',
    line: 'yb_line_height',
    width: 'yb_reading_width',
    paper: 'yb_paper',
    dropcap: 'yb_dropcap',
  };
  let saved = true;
  for (const key of Object.keys(keys) as (keyof Preferences)[])
    saved = writeStorage(keys[key], preferences[key]) && saved;
  if (!saved) {
    const status = document.querySelector('#status');
    if (status) status.textContent = '设置已应用，此浏览器暂时无法保存。';
  }
  apply();
}
document.querySelectorAll<HTMLSelectElement>('[data-preference]').forEach((s) =>
  s.addEventListener('change', () => {
    preferences = normalizePreferences({ ...preferences, [s.dataset.preference!]: s.value });
    save();
  }),
);
document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  preferences.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  save();
});
document.querySelectorAll('[data-reset-preferences]').forEach((b) =>
  b.addEventListener('click', () => {
    preferences = { ...defaults };
    save();
  }),
);
media.addEventListener('change', apply);
window.addEventListener('storage', () => {
  preferences = migratePreferences(readStorage);
  apply();
});
apply();
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]'))
    document.querySelectorAll<HTMLDetailsElement>('details[open]:not(.toc-tree)').forEach((d) => {
      d.open = false;
      d.querySelector('summary')?.focus();
    });
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.dispatchEvent(new Event('open-search'));
  }
});
document.addEventListener('click', (event) =>
  document
    .querySelectorAll<HTMLDetailsElement>('.user-menu[open],.more-actions[open]')
    .forEach((d) => {
      if (event.target instanceof Node && !d.contains(event.target)) d.open = false;
    }),
);
