import { legacyDestination } from '../lib/navigation';
import './preferences';
import './navigation';

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
