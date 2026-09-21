import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
const directory = 'src/styles';
const failures = [];
let rules = 0;
const crossFile = new Map();
for (const file of fs.readdirSync(directory).filter((f) => f.endsWith('.css'))) {
  const root = postcss.parse(fs.readFileSync(path.join(directory, file), 'utf8'), { from: file });
  const seen = new Map();
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
    rules++;
    const parents = [];
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule') parents.unshift('@' + parent.name + ' ' + parent.params);
      parent = parent.parent;
    }
    const scope = parents.join(' / ');
    // A shared base group followed by disjoint properties is not an override.
    // Detect repeated blocks and repeated selector/property pairs instead.
    const blockKey = scope + ' :: ' + rule.selector;
    if (seen.has('block:' + blockKey))
      failures.push(file + ': repeated rule block ' + rule.selector);
    seen.set('block:' + blockKey, true);
    for (const selector of rule.selectors ?? []) {
      rule.walkDecls((decl) => {
        const key = scope + ' :: ' + selector.trim() + ' :: ' + decl.prop;
        const previousFile = crossFile.get(key);
        if (previousFile && previousFile !== file)
          failures.push(
            file +
              ': cross-file override of ' +
              previousFile +
              ' / ' +
              selector +
              ' / ' +
              decl.prop,
          );
        crossFile.set(key, file);
        if (seen.has(key))
          failures.push(
            file + ': redundant override ' + selector + ' / ' + decl.prop + ' (' + scope + ')',
          );
        seen.set(key, true);
      });
    }
    const properties = new Set();
    rule.walkDecls((decl) => {
      if (properties.has(decl.prop))
        failures.push(file + ': duplicate property ' + decl.prop + ' in ' + rule.selector);
      properties.add(decl.prop);
      if (
        decl.important &&
        !(file === 'global.css' || (file === 'reader.css' && scope === '@media print'))
      )
        failures.push(file + ': unscoped !important');
    });
  });
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'Style audit passed: ' +
      rules +
      ' rules; no repeated blocks, redundant same-scope/cross-file overrides, or duplicate declarations.',
  );
