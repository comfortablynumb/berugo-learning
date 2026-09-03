/**
 * Pulling prose back out of the source, and cutting it into sentences.
 *
 * The concepts live in a registry a test can `require`, but the orientation
 * paragraphs and the closing insight are arguments to `shell.render` inside a
 * section's IIFE - there is no way to ask for them without booting the whole
 * application in a DOM. For a report over 364 sections that is minutes of
 * work to read four strings, so this reads the source instead.
 *
 * The scan is deliberately narrow: find the key, take the value with a
 * bracket-aware walk (so a `[` inside a string cannot end it early), splice
 * adjacent string literals back together across their `+`, and hand back the
 * paragraphs. Anything it cannot parse it reports as absent rather than
 * guessing, because a wrong sentence count is worse than a missing one.
 */
'use strict';

const fs = require('fs');

const OPEN = { '[': 1, '{': 1, '(': 1 };
const CLOSE = { ']': 1, '}': 1, ')': 1 };

/**
 * The raw source text of the value starting at `from`, ending at the comma or
 * closing bracket that terminates it at depth zero.
 */
function valueAt(source, from) {
  let depth = 0;
  let quote = null;

  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (OPEN[ch]) { depth += 1; continue; }
    if (CLOSE[ch]) {
      if (depth === 0) return source.slice(from, i);
      depth -= 1;
      continue;
    }
    if (ch === ',' && depth === 0) return source.slice(from, i);
  }
  return source.slice(from);
}

/** `'a ' +\n  'b'` is one paragraph, not two. */
function stringsIn(source) {
  const spliced = source.replace(/'\s*\+\s*'/g, '');
  const pattern = /'((?:[^'\\]|\\.)*)'/g;
  const out = [];
  let match = pattern.exec(spliced);

  while (match) {
    out.push(match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    match = pattern.exec(spliced);
  }
  return out;
}

function valuesFor(source, key) {
  const at = source.indexOf(key + ':');
  if (at < 0) return [];
  return stringsIn(valueAt(source, at + key.length + 1));
}

/** The prose a section passes to `shell.render`: orientation, then insight. */
function configProse(file) {
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, 'utf8');
  return valuesFor(source, 'orientation').concat(valuesFor(source, 'insight'));
}

/** `detail` is one paragraph or several; both arrive here as an array. */
function paragraphsOf(detail) {
  if (!detail) return [];
  return (Array.isArray(detail) ? detail : [detail]).filter(Boolean);
}

/**
 * Sentence boundaries. A full stop only ends a sentence when whitespace and
 * something that could start a sentence follow, which keeps "1.5" and "n₀."
 * from splitting the line into fragments and reporting a flattering average.
 * Markdown counts, on both sides of the boundary: a paragraph here often opens
 * with a bold thesis, so the full stop can sit inside the `**` and the next
 * sentence can start with one. Treating either as a continuation glues two
 * sentences into a phantom that reports as the longest in the curriculum.
 */
function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?][*_`"'”)\]]{0,3})\s+(?=[A-Z0-9"'“(*`_])/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

function wordCount(sentence) {
  return sentence.split(/\s+/).filter(Boolean).length;
}

module.exports = {
  configProse: configProse,
  paragraphsOf: paragraphsOf,
  sentences: sentences,
  wordCount: wordCount,
  stringsIn: stringsIn,
  valueAt: valueAt
};
