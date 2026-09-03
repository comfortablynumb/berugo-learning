#!/usr/bin/env node
/**
 * Lift a section's `orientation: [...]` array into its own function.
 *
 * The prose pass splits long orientation paragraphs into shorter ones, and
 * every split costs the enclosing function two lines. Several `config()`
 * functions sit within a few lines of the 50-line limit, so a purely editorial
 * change to the prose turns `npm run lint:size` red.
 *
 * The orientation is self-contained prose with no locals, so moving it out is
 * the fix that changes nothing else. This does it mechanically, because doing
 * it by hand across the curriculum is how indentation drifts.
 *
 * Usage: node tools/extract-orientation.js src/js/sections/<id>-section.js
 */
'use strict';

const fs = require('fs');

/** Index just past the `]` closing the array whose `[` is at `start`. */
function arrayEnd(source, start) {
  let depth = 0;
  let quote = null;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error('unbalanced orientation array');
}

function dedent(block, spaces) {
  const prefix = ' '.repeat(spaces);
  return block.split('\n')
    .map(function (line) { return line.startsWith(prefix) ? line.slice(spaces) : line; })
    .join('\n');
}

function extract(source) {
  const key = /\n(\s*)orientation: \[/.exec(source);

  if (!key) throw new Error('no orientation array');
  const openAt = source.indexOf('[', key.index);
  const end = arrayEnd(source, openAt);
  const body = dedent(source.slice(openAt, end), key[1].length - 4);
  const host = source.lastIndexOf('\n  function ', key.index);

  if (host < 0) throw new Error('no enclosing function');
  const rewritten = source.slice(0, openAt) + 'orientation()' + source.slice(end);
  const fn = '\n  function orientation() {\n    return ' + body + ';\n  }\n';
  return rewritten.slice(0, host) + fn + rewritten.slice(host);
}

function main() {
  const file = process.argv[2];

  if (!file) throw new Error('usage: node tools/extract-orientation.js <section-file>');
  fs.writeFileSync(file, extract(fs.readFileSync(file, 'utf8')));
  process.stdout.write('extracted orientation from ' + file + '\n');
}

if (require.main === module) main();

module.exports = { extract: extract, arrayEnd: arrayEnd };
