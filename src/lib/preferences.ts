export interface Preferences {
  theme: 'system' | 'light' | 'dark';
  face: 'serif' | 'kai' | 'sans';
  size: string;
  line: string;
  width: string;
  paper: string;
  dropcap: string;
}
export const defaults: Preferences = {
  theme: 'system',
  face: 'serif',
  size: '19',
  line: '1.95',
  width: '720',
  paper: 'rice',
  dropcap: 'on',
};
const allowed: Record<keyof Preferences, readonly string[]> = {
  theme: ['system', 'light', 'dark'],
  face: ['serif', 'kai', 'sans'],
  size: ['16', '17', '18', '19', '20', '21', '22', '23', '24'],
  line: ['1.72', '1.95', '2.16'],
  width: ['650', '720', '760', '880'],
  paper: ['rice', 'xuan', 'sepia'],
  dropcap: ['on', 'off'],
};
export function normalizePreferences(
  value: Partial<Record<keyof Preferences, string | null>>,
): Preferences {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
    const input = value[key];
    if (input && allowed[key].includes(input)) Object.assign(result, { [key]: input });
  }
  return result;
}
export function migratePreferences(read: (key: string) => string | null): Preferences {
  const oldFont = read('yb_font');
  const oldLine: Record<string, string> = { compact: '1.72', normal: '1.95', loose: '2.16' };
  const oldWidth: Record<string, string> = { narrow: '650', normal: '760', wide: '880' };
  return normalizePreferences({
    theme: read('yb_theme'),
    face: read('yb_face'),
    size: read('yb_size') ?? (oldFont !== null ? String(19 + Number(oldFont)) : null),
    line: read('yb_line_height') ?? oldLine[read('yb_line') ?? ''],
    width: read('yb_reading_width') ?? oldWidth[read('yb_width') ?? ''],
    paper: read('yb_paper'),
    dropcap: read('yb_dropcap'),
  });
}
