import { readStorage, writeStorage } from './storage';
import { submissionGenres, type WritingDraft } from './submissions';
export interface LocalWriting {
  draft: WritingDraft;
  owner: string;
  dirty: boolean;
  savedAt: number;
}
export const writingKey = (owner: string, id: string) => 'yb_writing_' + owner + '_' + id;
export function readLocalWriting(owner: string, id: string): LocalWriting | null {
  try {
    const value = JSON.parse(readStorage(writingKey(owner, id)) || 'null');
    if (
      value?.owner !== owner ||
      value?.draft?.id !== id ||
      typeof value.draft.body !== 'string' ||
      typeof value.draft.title !== 'string' ||
      !Array.isArray(value.draft.tags) ||
      !Number.isInteger(value.draft.revision) ||
      value.draft.revision < 0 ||
      typeof value.draft.summary !== 'string' ||
      typeof value.draft.indent !== 'boolean' ||
      !Object.hasOwn(submissionGenres, value.draft.genre) ||
      !value.draft.tags.every((tag: unknown) => typeof tag === 'string') ||
      !Number.isFinite(value.savedAt) ||
      typeof value.dirty !== 'boolean'
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function storeLocalWriting(value: LocalWriting) {
  return writeStorage(writingKey(value.owner, value.draft.id), JSON.stringify(value));
}
export function listLocalWriting(owner: string): LocalWriting[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith('yb_writing_' + owner + '_'))
      .flatMap((key) => {
        const row = readLocalWriting(owner, key.slice(('yb_writing_' + owner + '_').length));
        return row ? [row] : [];
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}
export function removeLocalWriting(owner: string, id: string) {
  try {
    localStorage.removeItem(writingKey(owner, id));
  } catch {
    /* A stale local copy remains recoverable. */
  }
}
