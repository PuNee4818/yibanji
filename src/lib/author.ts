export function authorBadge() {
  const badge = document.createElement('span');
  badge.className = 'author-badge';
  badge.title = '作者身份已由一班集确认';
  badge.setAttribute('aria-label', '认证作者');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [
    'M8 1.5 13.5 4v4c0 3-3.4 5.4-5.5 6.5C5.9 13.4 2.5 11 2.5 8V4L8 1.5Z',
    'm5.2 7.8 1.9 2 3.8-4',
  ]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    svg.append(path);
  }
  badge.append(svg, document.createTextNode('认证作者'));
  return badge;
}
