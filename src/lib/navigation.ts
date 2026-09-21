export function safeLocalPath(
  value: string | null,
  origin: string,
  fallback = '/me/settings/',
): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.includes('\\') ||
    Array.from(value).some((c) => c.charCodeAt(0) <= 32)
  )
    return fallback;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

export function legacyDestination(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  try {
    const parts = hash.slice(2).split('/').map(decodeURIComponent);
    if (parts[0] === 'read' && /^[a-zA-Z0-9_-]+$/.test(parts[1] ?? '')) {
      const novel = parts[1] === 'tianhuaban';
      const chapter = novel ? String(Math.max(1, Math.min(20, Number(parts[2]) || 1))) + '/' : '';
      const resume = parts.includes('resume') ? '?resume=1' : '';
      const anchor = parts[2] === 'section' ? '#section-' + Math.max(1, Number(parts[3]) || 1) : '';
      return '/articles/' + parts[1] + '/' + chapter + resume + anchor;
    }
    if (parts[0] === 'favorites') return '/me/bookmarks/';
    if (parts[0] === 'section') return '/catalog/?volume=' + encodeURIComponent(parts[1] ?? '');
    if (parts[0] === 'home') return '/';
  } catch {
    /* Malformed legacy URLs remain navigable through the catalog. */
  }
  return null;
}
