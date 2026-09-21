import { legacyDestination } from '../lib/navigation';
import { parseBookmarks, readStorage } from '../lib/storage';
import './preferences';

let announcementTimer: ReturnType<typeof setTimeout>;
export function announce(message: string) {
  const status = document.querySelector('#status');
  if (status) {
    clearTimeout(announcementTimer);
    status.textContent = message;
    announcementTimer = setTimeout(() => {
      status.textContent = '';
    }, 5000);
  }
}

function legacyRoute() {
  const next = legacyDestination(location.hash);
  if (next) location.replace(next);
}
legacyRoute();
window.addEventListener('hashchange', legacyRoute);

function renderBookmarks() {
  const ids = parseBookmarks(readStorage('yb_favs'));
  let visible = 0;
  document.querySelectorAll<HTMLElement>('[data-bookmark-item]').forEach((item) => {
    item.hidden = !ids.includes(item.dataset.bookmarkItem ?? '');
    if (!item.hidden) visible++;
  });
  const empty = document.querySelector<HTMLElement>('#bookmark-empty');
  if (empty) empty.hidden = visible > 0;
}
renderBookmarks();
window.addEventListener('storage', renderBookmarks);
document.querySelector('[data-share]')?.addEventListener('click', async () => {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('resume');
    await navigator.clipboard.writeText(url.href);
    announce('链接已复制，可以分享给书友了。');
  } catch {
    announce('请复制地址栏链接进行分享。');
  }
});

let historyCount = 0;
document.querySelectorAll<HTMLElement>('[data-history-item]').forEach((item) => {
  const id = item.dataset.historyItem!;
  const chapter = Number(readStorage(`yb_visited_${id}`));
  item.hidden = !chapter;
  if (chapter) {
    historyCount++;
    const link = item.querySelector('a')!;
    link.href = `/articles/${id}/${id === 'tianhuaban' ? `${chapter}/` : ''}?resume=1`;
  }
});
const historyEmpty = document.querySelector<HTMLElement>('#history-empty');
if (historyEmpty) historyEmpty.hidden = historyCount > 0;

const observer = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('reveal-in');
        observer.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12 },
);
document
  .querySelectorAll('.volume-section,.community-invitation,.home-reading,.preface-strip')
  .forEach((e) => observer.observe(e));
