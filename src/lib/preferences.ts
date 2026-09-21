export interface Preferences { theme: 'system' | 'light' | 'dark'; face: 'serif' | 'kai' | 'sans'; size: string; line: string; width: string }
export const defaults: Preferences = { theme: 'system', face: 'serif', size: '19', line: '1.95', width: '760' };
const allowed: Record<keyof Preferences, readonly string[]> = { theme: ['system','light','dark'], face: ['serif','kai','sans'], size: ['17','19','21','24'], line: ['1.72','1.95','2.16'], width: ['650','760','880'] };
export function normalizePreferences(value: Partial<Record<keyof Preferences, string | null>>): Preferences {
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Preferences)[]) {
    const input = value[key];
    if (input && allowed[key].includes(input)) Object.assign(result, { [key]: input });
  }
  return result;
}
