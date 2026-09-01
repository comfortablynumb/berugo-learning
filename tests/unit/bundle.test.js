/**
 * The publish-time bundler.
 *
 * Every test here feeds an in-memory shell and an in-memory reader, so nothing
 * touches a filesystem and the shape being asserted is the shape the workflow
 * actually produces. The two properties that carry the whole thing are
 * *order preserved* and *nothing dropped*: a bundle that loads the same
 * modules in a different order is a different program, and one that silently
 * skips a module fails at run time in a section nobody opened.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { bundle, rewrite, concatenate, inlineImports } = require('../../tools/bundle-core.js');

const SHELL = [
  '<!DOCTYPE html>',
  '<html><body>',
  '  <script src="lib/jquery-3.7.1.min.js"></script>',
  '',
  '  <!-- utilities first -->',
  '  <script src="src/js/utils/helpers.js"></script>',
  '  <script src="src/js/utils/palette.js"></script>',
  '  <script src="src/js/app.js"></script>',
  '</body></html>',
  ''
].join('\n');

const FILES = {
  'src/js/utils/helpers.js': '(function () { window.Helpers = {}; }());',
  'src/js/utils/palette.js': '(function () { window.Palette = {}; }())',
  'src/js/app.js': '(function () { window.BerugoStart = function () {}; }())'
};

function reader(src) {
  if (!Object.prototype.hasOwnProperty.call(FILES, src)) throw new Error('no such file: ' + src);
  return FILES[src];
}

function run(html) {
  return bundle({
    html: html === undefined ? SHELL : html,
    prefix: 'src/js/',
    bundlePath: 'lib/app.bundle.js',
    read: reader
  });
}

test('every src/js module is collected, in the order the shell listed them', function () {
  assert.deepStrictEqual(run().sources, [
    'src/js/utils/helpers.js',
    'src/js/utils/palette.js',
    'src/js/app.js'
  ]);
});

test('the shell keeps one bundle tag where the first module was, and jQuery', function () {
  const html = run().html;
  const tags = html.match(/<script\s+src="([^"]+)"><\/script>/g);

  assert.deepStrictEqual(tags, [
    '<script src="lib/jquery-3.7.1.min.js"></script>',
    '<script src="lib/app.bundle.js"></script>'
  ], 'jQuery is untouched and the bundle takes the first module\'s position');
});

test('removing a tag removes its whole line, leaving no blank gap per module', function () {
  const html = run().html;

  assert.strictEqual(html.indexOf('src/js/'), -1, 'no module path survives in the shell');
  assert.ok(html.indexOf('<!-- utilities first -->') !== -1, 'surrounding markup is untouched');
  assert.ok(!/\n[ \t]*\n[ \t]*\n/.test(html), 'deleted tags did not leave stacked blank lines');
});

test('sources are separated so a trailing comment or expression cannot merge', function () {
  const script = concatenate(['a.js', 'b.js'], function (src) {
    return src === 'a.js' ? 'window.a = 1 // trailing comment' : '(function () {}())';
  });

  assert.ok(/\/\/ trailing comment\n/.test(script), 'the comment is closed by a newline');
  assert.ok(script.indexOf('comment\n;') !== -1, 'and a semicolon follows it');
  assert.doesNotThrow(function () { new Function(script); }, 'the joined text parses');
});

test('each module is preceded by a marker naming it, so a stack line is traceable', function () {
  const result = run();

  result.sources.forEach(function (src) {
    assert.ok(result.script.indexOf('/* ==== ' + src + ' ==== */') !== -1, 'marker for ' + src);
  });
});

test('the bundle contains every module body exactly once', function () {
  const script = run().script;

  Object.keys(FILES).forEach(function (src) {
    const parts = script.split(FILES[src]);
    assert.strictEqual(parts.length, 2, FILES[src] + ' appears once');
  });
});

test('the concatenation parses as one program', function () {
  assert.doesNotThrow(function () { new Function(run().script); });
});

test('a shell with nothing to bundle is an error, not a silent empty bundle', function () {
  assert.throws(function () {
    run('<html><body><script src="lib/jquery-3.7.1.min.js"></script></body></html>\n');
  }, /no <script src="src\/js\/\.\.\."> tags to bundle/);
});

test('a tag the line matcher cannot see is reported rather than left behind', function () {
  /* `rewrite` only matches a tag that occupies its own line. Two on one line
     is the shape that would slip past, so the guard in `bundle` has to catch
     it - a stray un-bundled tag would load a module the bundle also contains,
     and every UMD module would register itself twice. */
  const html = '<html><body>\n  <script src="src/js/utils/helpers.js"></script>\n' +
    '  <script src="src/js/utils/palette.js"></script><script src="src/js/app.js"></script>\n' +
    '</body></html>\n';

  assert.throws(function () { run(html); }, /survived the rewrite/);
});

test('rewrite reports the sources it took and leaves other prefixes alone', function () {
  const result = rewrite(SHELL, 'src/js/utils/', 'lib/utils.bundle.js');

  assert.deepStrictEqual(result.sources, ['src/js/utils/helpers.js', 'src/js/utils/palette.js']);
  assert.ok(result.html.indexOf('src="src/js/app.js"') !== -1, 'app.js is outside the prefix');
});

/* -------------------------------------------------- the stylesheet */

const SHEETS = {
  'base.css': ':root { --hue-a: 210; }',
  'layout.css': '.sidebar { width: 16rem; }'
};

function inlined(css) {
  return inlineImports({
    css: css,
    read: function (href) {
      if (!Object.prototype.hasOwnProperty.call(SHEETS, href)) throw new Error('no such sheet: ' + href);
      return SHEETS[href];
    }
  });
}

test('every @import is replaced by the file it named, in order', function () {
  const result = inlined("@import url('base.css');\n@import url('layout.css');\n.x { color: red; }\n");

  assert.deepStrictEqual(result.imports, ['base.css', 'layout.css']);
  assert.ok(result.css.indexOf('--hue-a: 210') < result.css.indexOf('width: 16rem'),
    'the cascade order the manifest declared is preserved');
  assert.ok(result.css.indexOf('.x { color: red; }') !== -1, 'the importing file\'s own rules survive');
});

test('the inlined stylesheet has no @import left and names what it absorbed', function () {
  const result = inlined("@import url('base.css');\n");

  assert.strictEqual(result.css.indexOf('@import'), -1);
  assert.ok(result.css.indexOf('/* ==== base.css ==== */') !== -1, 'marker for base.css');
});

test('double quotes and loose spacing are the same import', function () {
  assert.deepStrictEqual(inlined('  @import   url( "base.css" ) ;  \n').imports, ['base.css']);
});

test('an @import that survives is an error, because it would be a nested one', function () {
  assert.throws(function () {
    inlineImports({
      css: "@import url('base.css');\n",
      read: function () { return "@import url('deeper.css');\n.y {}"; }
    });
  }, /@import survived inlining/);
});

test('a stylesheet with no imports passes through untouched', function () {
  const css = '.x { color: red; }\n';

  assert.strictEqual(inlined(css).css, css);
  assert.deepStrictEqual(inlined(css).imports, []);
});
