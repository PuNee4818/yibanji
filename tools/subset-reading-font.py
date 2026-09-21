from pathlib import Path
from fontTools import subset
# Re-run when adding corpus/UI text; missing characters fall back to system serif.
root = Path(__file__).resolve().parent.parent
text = ''.join(p.read_text(encoding='utf-8') for folder in ('src', 'content', 'data') for p in (root / folder).rglob('*') if p.suffix in ('.ts', '.astro', '.js', '.json'))
options = subset.Options()
options.flavor = 'woff2'
font = subset.load_font(str(root / 'tools/fonts/NotoSerifCJKsc-Regular.otf'), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
output = root / 'public/fonts/ReadingSerif.woff2'
output.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(font, str(output), options)
(root / 'public/fonts/OFL.txt').write_bytes((root / 'tools/fonts/OFL.txt').read_bytes())
print('Reading font:', output.stat().st_size, 'bytes')
