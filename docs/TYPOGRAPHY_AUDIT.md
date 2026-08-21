# Typography audit

This site keeps literary wording separate from typographic normalization.

Current checks cover:

- no forced blank gap after the first line of every poem;
- full-width Chinese punctuation in Chinese prose/dialogue;
- mixed ellipsis such as `……..` / `……．`;
- malformed quote + punctuation combinations;
- accidental ASCII parentheses in Chinese prose;
- obvious missing sentence-ending punctuation in prose;
- source paragraph breaks created by pagination/import errors;
- publication-style treatment of prefaces, author notes, notes and colophons.

Run before release:

```bash
node tools/check-content.js
node tools/audit-typography.js
```

Poetry is intentionally conservative: line-ending punctuation is not automatically inserted into modern free verse. Classical verse is only corrected when the surrounding poem clearly establishes a consistent punctuation pattern.
