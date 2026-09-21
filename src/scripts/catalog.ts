const params = new URLSearchParams(location.search);
const buttons = document.querySelectorAll<HTMLButtonElement>('[data-genre-filter]');
function filter(value: string) {
  let count = 0;
  document.querySelectorAll<HTMLElement>('.catalog-grid li[data-genre]').forEach((li) => {
    li.hidden = !!value && li.dataset.genre !== value;
    if (!li.hidden) count++;
  });
  document
    .querySelectorAll<HTMLElement>('[data-volume]')
    .forEach(
      (section) =>
        (section.hidden = ![...section.querySelectorAll<HTMLElement>('li')].some(
          (li) => !li.hidden,
        )),
    );
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.genreFilter === value)));
  document.querySelector('[data-catalog-count]')!.textContent = '共 ' + count + ' 篇作品';
}
buttons.forEach((b) =>
  b.addEventListener('click', () => {
    filter(b.dataset.genreFilter ?? '');
    const q = new URLSearchParams(location.search);
    if (b.dataset.genreFilter) q.set('genre', b.dataset.genreFilter);
    else q.delete('genre');
    history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash);
  }),
);
const value = params.get('genre') ?? '';
filter(['poetry', 'essay', 'story', 'novel'].includes(value) ? value : '');
const volume = params.get('volume');
if (volume) {
  const section = [...document.querySelectorAll<HTMLElement>('[data-volume]')].find(
    (s) => s.dataset.volume === volume,
  );
  if (section) {
    filter('');
    requestAnimationFrame(() => section.scrollIntoView());
    history.replaceState(null, '', location.pathname + '#' + section.id);
  }
}
