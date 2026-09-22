import { prefetch } from 'astro:prefetch';
// Warm only public, static HTML. Never prerender scripts or send interaction requests.
function destination(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest('a') : null;
  if (
    !anchor ||
    anchor.hasAttribute('download') ||
    anchor.target ||
    anchor.dataset.astroPrefetch === 'false'
  )
    return;
  const url = new URL(anchor.href, location.href);
  if (
    url.origin !== location.origin ||
    (url.pathname === location.pathname && url.search === location.search)
  )
    return;
  if (
    !/^\/(?:$|catalog\/|articles\/|search\/|community\/(?:$|comments\/|guidelines\/))/.test(
      url.pathname,
    )
  )
    return;
  return url.href;
}
let timer: ReturnType<typeof setTimeout>;
document.addEventListener(
  'pointerover',
  (event) => {
    const url = destination(event.target);
    clearTimeout(timer);
    if (url) timer = setTimeout(() => prefetch(url), 70);
  },
  { passive: true },
);
document.addEventListener('pointerout', () => clearTimeout(timer), { passive: true });
document.addEventListener('focusin', (event) => {
  const url = destination(event.target);
  if (url) prefetch(url);
});
document.addEventListener(
  'touchstart',
  (event) => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    const url = destination(event.target);
    if (url && !connection?.saveData) prefetch(url);
  },
  { passive: true },
);
