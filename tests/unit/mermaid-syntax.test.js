'use strict';

/**
 * Every section diagram is parsed by mermaid itself.
 *
 * Nothing else checked this. The render audit boots all 307 sections in jsdom,
 * but the app loads mermaid lazily and never renders a diagram there, so a
 * diagram with a syntax error passed every gate in this repo and appeared in
 * the browser as `<pre class="mermaid-error">diagram failed to render: Parse
 * error…</pre>`. Two sections were shipping exactly that:
 * `top-down-parsing-and-ll1` had a round bracket inside an unquoted node label
 * (`H[not LL(1): …]`, which ends the label early) and
 * `randomised-and-interactive-classes` had a semicolon in a sequence-diagram
 * note, which mermaid reads as the end of the statement.
 *
 * The first attempt at this guard was a pair of hand-written rules about
 * brackets and semicolons. They were wrong in both directions - they flagged
 * `Y1(("y"))` and `E_p[f(X)]`, which parse, because a regex cannot tell a node
 * definition from the same characters inside a label - so they are gone. The
 * real parser is the only thing that knows, and it runs here: mermaid loads
 * under jsdom in about 200ms as long as it arrives through a script element
 * rather than `eval`, which is what the bundle's trailing
 * `globalThis.__esbuild_esm_mermaid_nm` assignment needs.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SECTIONS_DIR = path.join(ROOT, 'src', 'js', 'sections');

function loadMermaid() {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', function () {});

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'dangerously', virtualConsole: virtualConsole,
    url: 'http://localhost/', pretendToBeVisual: true
  });
  const win = dom.window;
  win.matchMedia = function () {
    return { matches: false, addEventListener: function () {}, removeEventListener: function () {} };
  };

  const script = win.document.createElement('script');
  script.textContent = fs.readFileSync(path.join(ROOT, 'lib', 'mermaid.min.js'), 'utf8');
  win.document.head.appendChild(script);
  return win.mermaid;
}

const mermaid = loadMermaid();

/**
 * The definition exactly as the section builds it.
 *
 * The array literal is evaluated rather than scanned, because gluing every
 * string literal together with a newline invents a line break wherever one
 * element is concatenated across two source lines - and a diagram that renders
 * perfectly then reads as broken. That mistake cost a false report already.
 * These are first-party files with no interpolation in the definition, so
 * evaluating the literal is the accurate reading of it.
 */
function definitionOf(src) {
  const at = src.indexOf('definition:');
  if (at === -1) return null;

  const open = src.indexOf('[', at);
  const quote = src.indexOf("'", at);
  if (open === -1 || (quote !== -1 && quote < open)) {
    const end = src.indexOf("',", quote + 1);
    if (end === -1) return null;
    return evaluate(src.slice(quote, end + 1));
  }
  const close = matchingBracket(src, open);
  if (close === -1) return null;
  const parts = evaluate(src.slice(open, close + 1));
  return Array.isArray(parts) ? parts.join('\n') : null;
}

function evaluate(literal) {
  return new Function('return ' + literal)(); // eslint-disable-line no-new-func
}

function matchingBracket(src, open) {
  let depth = 0;
  let inString = false;

  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === '[') depth += 1;
    else if (ch === ']') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function everyDiagram() {
  return fs.readdirSync(SECTIONS_DIR)
    .filter(function (file) { return file.endsWith('-section.js'); })
    .map(function (file) {
      const src = fs.readFileSync(path.join(SECTIONS_DIR, file), 'utf8');
      let text = null;
      try { text = definitionOf(src); } catch (error) { text = null; }
      return { id: file.replace('-section.js', ''), text: text };
    })
    .filter(function (row) { return typeof row.text === 'string' && row.text.trim(); });
}

test('mermaid: the parser is actually loaded, or this file proves nothing', function () {
  assert.strictEqual(typeof mermaid, 'object', 'mermaid did not load under jsdom');
  assert.strictEqual(typeof mermaid.parse, 'function');
});

test('mermaid: a definition is read from every teaching section', function () {
  assert.ok(everyDiagram().length >= 305,
    'expected a definition from every teaching section, read ' + everyDiagram().length);
});

test('mermaid: every section diagram parses', async function () {
  const broken = [];

  for (const row of everyDiagram()) {
    try {
      await mermaid.parse(row.text);
    } catch (error) {
      broken.push(row.id + ': ' + String(error && error.message).split('\n')[0].slice(0, 110));
    }
  }

  assert.deepStrictEqual(broken, [],
    'these diagrams fail to parse and render as an error block in the browser:\n  ' +
    broken.join('\n  '));
});

/* A concept may carry a diagram of its own, and those are content rather than
   section config - so they come from the registry, and they get the same
   parser. Authoring one that does not parse costs the reader the picture the
   concept was written around. */
test('mermaid: every concept diagram parses', async function () {
  const registries = require('../../src/js/content/registries.js');
  const contentDir = path.join(ROOT, 'src', 'js', 'content');
  fs.readdirSync(contentDir)
    .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
    .forEach(function (file) { require(path.join(contentDir, file)); });

  const broken = [];
  let seen = 0;

  for (const id of registries.ConceptRegistry.ids()) {
    for (const concept of registries.ConceptRegistry.get(id) || []) {
      if (!concept.diagram || !concept.diagram.definition) continue;
      seen += 1;
      try {
        await mermaid.parse(concept.diagram.definition);
      } catch (error) {
        broken.push(id + ' :: ' + concept.term + ': ' +
          String(error && error.message).split('\n')[0].slice(0, 110));
      }
    }
  }

  assert.deepStrictEqual(broken, [],
    'these concept diagrams fail to parse:\n  ' + broken.join('\n  '));
  assert.ok(seen > 0, 'no concept diagram was found to check - has the field been renamed?');
});

/* A parser that accepts everything would make the test above pass for the wrong
   reason, so both shapes that shipped broken are checked to still be rejected. */
test('mermaid: the parser still rejects what shipped broken', async function () {
  await assert.rejects(function () {
    return mermaid.parse('flowchart TD\n' +
      '    F -->|two productions| H[not LL(1): the loop cannot choose]');
  }, 'a round bracket in an unquoted label should not parse');

  await assert.rejects(function () {
    return mermaid.parse('sequenceDiagram\n' +
      '    participant V as Verifier\n' +
      '    Note over V,V: repeat k times; a liar survives with probability 2^-k');
  }, 'a semicolon in a note should not parse');

  await mermaid.parse('flowchart LR\n    H["not LL(1): quoted, so fine"]');
});
