// Both catalog and published submissions have one interaction identity.
export function readingUrl(id: string): string {
  return (
    (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? '/submissions/' : '/articles/') +
    encodeURIComponent(id) +
    '/'
  );
}
