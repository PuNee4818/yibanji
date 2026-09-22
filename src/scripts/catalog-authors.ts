import { supabase } from '../lib/supabase';
import { authorBadge } from '../lib/author';
import { levelBadge } from '../lib/growth';
const { data } = await supabase.from('catalog_author_profiles').select('*');
for (const row of data ?? []) {
  document.querySelectorAll<HTMLElement>('[data-catalog-author]').forEach((node) => {
    if (node.dataset.catalogAuthor !== row.name || !row.username) return;
    node.querySelector('a')!.href = '/u/' + encodeURIComponent(row.username) + '/?stream=works';
    if (node.hasAttribute('data-author-badges')) {
      if (row.level) node.append(levelBadge(row.level));
      if (row.author_verified) node.append(authorBadge());
    }
  });
}
