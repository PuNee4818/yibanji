import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const dialog = document.querySelector<HTMLDialogElement>('#pdf-dialog');
if (dialog) {
  const edition = dialog.querySelector<HTMLSelectElement>('[data-pdf-edition]')!;
  const zoom = dialog.querySelector<HTMLSelectElement>('[data-pdf-zoom]')!;
  const stage = dialog.querySelector<HTMLElement>('[data-pdf-stage]')!;
  const canvas = dialog.querySelector<HTMLCanvasElement>('[data-pdf-canvas]')!;
  const status = dialog.querySelector<HTMLElement>('[data-pdf-status]')!;
  const pages = dialog.querySelector('[data-pdf-pages]')!;
  const previous = dialog.querySelector<HTMLButtonElement>('[data-pdf-prev]')!;
  const next = dialog.querySelector<HTMLButtonElement>('[data-pdf-next]')!;
  const retry = dialog.querySelector<HTMLButtonElement>('[data-pdf-retry]')!;
  const download = dialog.querySelector<HTMLAnchorElement>('[data-pdf-download]')!;
  const external = dialog.querySelector<HTMLAnchorElement>('[data-pdf-external]')!;
  let pdf: PDFDocumentProxy | undefined;
  let loading: PDFDocumentLoadingTask | undefined;
  let rendering: RenderTask | undefined;
  let version = 0;
  let pageNumber = 1;
  let opener: HTMLElement | null = null;
  function links() {
    download.href = edition.value;
    external.href = edition.value;
    download.download = edition.selectedOptions[0]!.dataset.filename!;
  }
  function controls(busy: boolean) {
    previous.disabled = busy || !pdf || pageNumber <= 1;
    next.disabled = busy || !pdf || pageNumber >= pdf.numPages;
    stage.setAttribute('aria-busy', String(busy));
  }
  async function render() {
    if (!pdf || !dialog?.open) return;
    const request = ++version;
    rendering?.cancel();
    controls(true);
    retry.hidden = true;
    try {
      const page = await pdf.getPage(pageNumber);
      if (request !== version) return;
      const original = page.getViewport({ scale: 1 });
      const scale =
        zoom.value === 'fit'
          ? Math.min(1.4, Math.max(160, stage.clientWidth - 32) / original.width)
          : Number(zoom.value);
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(devicePixelRatio || 1, 2);
      // Render into a fresh canvas so cancellation cannot corrupt a later page.
      const buffer = document.createElement('canvas');
      buffer.width = Math.ceil(viewport.width * ratio);
      buffer.height = Math.ceil(viewport.height * ratio);
      rendering = page.render({ canvas: buffer, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await rendering.promise;
      if (request !== version) return;
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      canvas.style.width = Math.ceil(viewport.width) + 'px';
      canvas.style.height = Math.ceil(viewport.height) + 'px';
      canvas.getContext('2d')!.drawImage(buffer, 0, 0);
      canvas.setAttribute(
        'aria-label',
        edition.selectedOptions[0]!.textContent +
          '，第 ' +
          pageNumber +
          ' 页，共 ' +
          pdf.numPages +
          ' 页',
      );
      canvas.hidden = false;
      pages.textContent = pageNumber + ' / ' + pdf.numPages;
      status.textContent = '第 ' + pageNumber + ' 页 · 共 ' + pdf.numPages + ' 页';
      stage.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch (error) {
      if (request !== version || (error as Error).name === 'RenderingCancelledException') return;
      status.textContent = '本页暂时无法预览，可以重试或直接下载文件。';
      retry.hidden = false;
    } finally {
      if (request === version) controls(false);
    }
  }
  async function load() {
    const request = ++version;
    rendering?.cancel();
    const old = loading;
    loading = undefined;
    pdf = undefined;
    canvas.hidden = true;
    pages.textContent = '— / —';
    pageNumber = 1;
    controls(true);
    links();
    retry.hidden = true;
    status.textContent = '正在展开纸页…';
    await old?.destroy().catch(() => {});
    try {
      const library = await import('pdfjs-dist');
      if (request !== version || !dialog?.open) return;
      library.GlobalWorkerOptions.workerSrc = workerUrl;
      const task = library.getDocument({ url: edition.value });
      loading = task;
      const result = await task.promise;
      if (request !== version) {
        await task.destroy();
        return;
      }
      pdf = result;
      await render();
    } catch {
      if (request !== version) return;
      status.textContent = '预览暂时无法载入。请重试，或使用下载和新页打开。';
      retry.hidden = false;
      controls(false);
    }
  }
  document.querySelector('[data-pdf-open]')?.addEventListener('click', (event) => {
    event.preventDefault();
    opener = document.activeElement as HTMLElement;
    dialog.showModal();
    void load();
  });
  edition.addEventListener('change', () => void load());
  zoom.addEventListener('change', () => void render());
  previous.addEventListener('click', () => {
    pageNumber--;
    void render();
  });
  next.addEventListener('click', () => {
    pageNumber++;
    void render();
  });
  retry.addEventListener('click', () => (pdf ? void render() : void load()));
  dialog.addEventListener('close', () => {
    version++;
    rendering?.cancel();
    const task = loading;
    loading = undefined;
    pdf = undefined;
    void task?.destroy().catch(() => {});
    opener?.focus();
  });
  let resizeTimer: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    if (dialog.open && pdf && zoom.value === 'fit')
      resizeTimer = setTimeout(() => void render(), 120);
  });
  observer.observe(stage);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) observer.observe(stage);
  });
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    clearTimeout(resizeTimer);
  });
}
