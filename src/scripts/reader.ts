import { readStorage, writeStorage } from '../lib/storage';
const reader = document.querySelector<HTMLElement>('[data-article-id]');
if (reader) {
  const id = reader.dataset.articleId!;
  const chapter = Number(reader.dataset.chapter) || 1;
  const key = 'yb_scroll_' + id + '_' + chapter;
  const stableKey = key + '_anchor';
  const prose = reader.querySelector<HTMLElement>('.prose')!;
  const bar = document.querySelector<HTMLElement>('[data-reading-progress]')!;
  const toc = document.querySelector<HTMLDetailsElement>('.toc-tree');
  const small = matchMedia('(max-width:800px)');
  const updateToc = () => {
    if (toc) toc.open = !small.matches;
  };
  updateToc();
  small.addEventListener('change', updateToc);
  let frame = 0;
  let timer: ReturnType<typeof setTimeout>;
  function progress() {
    frame = 0;
    const rect = prose.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (innerHeight - rect.top) / Math.max(1, rect.height)));
    bar.style.transform = 'scaleX(' + fraction + ')';
    let current: Element | undefined;
    prose.querySelectorAll('h2[id]').forEach((e) => {
      if (e.getBoundingClientRect().top < innerHeight * 0.4) current = e;
    });
    document.querySelectorAll<HTMLAnchorElement>('.toc-tree a[href^="#section"]').forEach((a) => {
      if (current && a.hash === '#' + current.id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  function save() {
    writeStorage(key, String(scrollY));
    const nodes = [...prose.querySelectorAll<HTMLElement>('[data-paragraph]')];
    const anchor = nodes.find((e) => e.getBoundingClientRect().bottom > 0);
    if (anchor)
      writeStorage(
        stableKey,
        JSON.stringify({
          id: anchor.id,
          offset: anchor.getBoundingClientRect().top,
          ts: Date.now(),
        }),
      );
  }
  const resume = new URLSearchParams(location.search).has('resume');
  if (resume && !location.hash) {
    let touched = false;
    const stop = () => {
      touched = true;
    };
    for (const event of ['wheel', 'touchstart', 'keydown'])
      window.addEventListener(event, stop, { once: true, passive: true });
    void (async () => {
      await document.fonts.ready;
      if (touched) return;
      try {
        const stored = JSON.parse(readStorage(stableKey) ?? 'null');
        const target = stored && document.getElementById(stored.id);
        if (target) {
          scrollTo({
            top: target.getBoundingClientRect().top + scrollY - Number(stored.offset || 0),
            behavior: 'instant',
          });
          return;
        }
      } catch {
        /* Fall back to legacy pixel position. */
      }
      const saved = Number(readStorage(key));
      if (saved > 0) {
        scrollTo({ top: saved, behavior: 'instant' });
        return;
      }
      try {
        const { supabase, getCurrentUser } = await import('../lib/supabase');
        const user = await getCurrentUser();
        if (!user || touched) return;
        const { data } = await supabase
          .from('reading_progress')
          .select('position,chapter')
          .eq('user_id', user.id)
          .eq('article_id', id)
          .abortSignal(AbortSignal.timeout(3000))
          .single();
        if (!touched && data && data.chapter === chapter)
          scrollTo({
            top: Math.max(0, document.documentElement.scrollHeight - innerHeight) * data.position,
            behavior: 'instant',
          });
      } catch {
        /* A failed cloud lookup must never block reading. */
      }
    })();
  }
  writeStorage('yb_last', JSON.stringify({ id, chapter, ts: Date.now() }));
  writeStorage('yb_visited_' + id, String(chapter));
  window.addEventListener(
    'scroll',
    () => {
      if (!frame) frame = requestAnimationFrame(progress);
      clearTimeout(timer);
      timer = setTimeout(save, 180);
    },
    { passive: true },
  );
  window.addEventListener('pagehide', save);
  window.addEventListener('resize', progress);
  progress();
  document.querySelectorAll<HTMLAnchorElement>('[data-read-next],[data-read-prev]').forEach((a) =>
    a.addEventListener('click', () => {
      try {
        sessionStorage.setItem('yb_turn', a.hasAttribute('data-read-next') ? 'next' : 'prev');
      } catch {
        /* Navigation works without storage. */
      }
    }),
  );
  try {
    const turn = sessionStorage.getItem('yb_turn');
    if (turn) document.documentElement.dataset.turn = turn;
    sessionStorage.removeItem('yb_turn');
  } catch {
    /* Optional animation. */
  }
  document.addEventListener('keydown', (e) => {
    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      document.querySelector('dialog[open]') ||
      (e.target instanceof Element &&
        e.target.closest('input,textarea,select,button,[contenteditable="true"]'))
    )
      return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const target = document.querySelector<HTMLAnchorElement>(
        e.key === 'ArrowLeft' ? '[data-read-prev]' : '[data-read-next]',
      );
      if (target) {
        e.preventDefault();
        target.click();
      }
    }
  });
  const focusButton = document.querySelector<HTMLButtonElement>('[data-focus-reading]')!;
  const controls = document.querySelector<HTMLElement>('.focus-controls')!;
  const exit = controls.querySelector<HTMLButtonElement>('.exit-focus')!;
  let idle: ReturnType<typeof setTimeout>;
  function awake() {
    controls.classList.remove('is-idle');
    clearTimeout(idle);
    if (document.body.classList.contains('focus-reading'))
      idle = setTimeout(() => {
        if (!document.body.classList.contains('focus-settings')) controls.classList.add('is-idle');
      }, 3200);
  }
  function focus(on: boolean) {
    document.body.classList.toggle('focus-reading', on);
    document.body.classList.remove('focus-settings');
    controls.hidden = !on;
    focusButton.setAttribute('aria-pressed', String(on));
    (on ? exit : focusButton).focus();
    awake();
  }
  focusButton.addEventListener('click', () => focus(true));
  exit.addEventListener('click', () => focus(false));
  controls.querySelector('[data-focus-settings]')?.addEventListener('click', () => {
    document.body.classList.add('focus-settings');
    const d = document.querySelector<HTMLDetailsElement>('.reader-options details')!;
    d.open = true;
    d.scrollIntoView({ block: 'center' });
    d.querySelector('select')?.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      !document.querySelector('dialog[open]') &&
      document.body.classList.contains('focus-reading')
    )
      focus(false);
  });
  for (const event of ['pointermove', 'pointerdown', 'keydown', 'scroll'])
    window.addEventListener(event, awake, { passive: true });
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());
}
