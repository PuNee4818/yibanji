import { rpc, getCurrentUser } from '../lib/supabase';
import { listLocalWriting } from '../lib/writing-storage';
import { submissionUrl, type Submission, type WritingDraft } from '../lib/submissions';
import { el, link } from './submission-ui';
const latest = document.querySelector<HTMLElement>('[data-home-submissions]')!;
void rpc<Submission[]>('submission_feed')
  .then((rows) => {
    for (const row of rows.slice(0, 3))
      latest.append(link(row.title + ' · ' + row.display_name, submissionUrl(row.id)));
    if (rows.length) {
      latest.prepend(el('span', '最近发表', 'eyebrow'));
      latest.hidden = false;
    }
  })
  .catch(() => {});
void getCurrentUser().then(async (user) => {
  const local = listLocalWriting(user?.id || 'guest').filter(
    (row) => row.dirty || !row.draft.revision,
  );
  let id = local[0]?.draft.id;
  if (user) {
    try {
      const rows = await rpc<WritingDraft[]>('my_writing');
      const draft = rows.find(
        (row) =>
          row.status === 'draft' ||
          (row.status === 'published' && row.revision !== row.published_revision),
      );
      if (draft && (!local[0] || Date.parse(draft.updated_at!) > local[0].savedAt)) id = draft.id;
    } catch {
      /* Local drafts can still be continued. */
    }
  }
  if (id) {
    const resume = document.querySelector<HTMLAnchorElement>('[data-home-writing-resume]')!;
    resume.href = '/write/?draft=' + id;
    resume.hidden = false;
  }
});
