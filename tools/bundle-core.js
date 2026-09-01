/**
 * Bundle core — turns the shell's 1 700-odd script tags into one file.
 *
 * The platform is deliberately built with no bundler: every module is a plain
 * classic script, `index.html` lists them in dependency order, and `npm start`
 * serves the tree as it is. That is the right trade for developing it — there
 * is nothing to rebuild after an edit — and it is a bad trade for *publishing*
 * it, because a cold visitor pays one request per module before the app boots.
 *
 * So the bundle is a publish-time step and nothing else touches it. The
 * repository, the dev server, the tests and the offline story are unchanged;
 * only the copy that goes to Pages is rewritten.
 *
 * Why plain concatenation is safe here, precisely:
 *   - Every module in `src/js` is already wrapped in a UMD IIFE, so nothing
 *     leaks a top-level binding that a neighbour could collide with. And
 *     classic scripts already share one global lexical environment, so two
 *     top-level `const`s of the same name collide as separate tags too — the
 *     bundle does not introduce that failure, it only moves it earlier.
 *   - No file carries a top-level `"use strict"` directive, so no file's
 *     strictness can leak into the ones concatenated after it.
 *   - Sources are joined with a newline and a semicolon, so a file ending in a
 *     line comment or an expression cannot merge into the next one.
 *   - The order is exactly the order of the tags it replaces.
 *
 * The one thing concatenation genuinely changes is failure mode: a syntax
 * error used to kill one module and leave the rest running, and now it kills
 * the bundle. `tools/verify-bundle.js` boots the result before it ships, which
 * makes that loud rather than latent.
 *
 * `read` is injected rather than imported so the unit tests never touch a real
 * filesystem.
 */
'use strict';

/* A whole line, so removing a tag removes its indentation and newline with it.
   Every script tag in the shell is exactly this shape - there is not one
   inline script, and not one `defer` or `async` - and `bundle` throws if the
   prefix matches nothing, which is what would happen if that ever changed. */
const SCRIPT_LINE = /^[ \t]*<script\s+src="([^"]+)"><\/script>[ \t]*\r?\n/gm;

/**
 * Replace the run of tags under `prefix` with a single tag for the bundle.
 *
 * The first matching tag becomes the bundle tag and the rest are dropped, so
 * the bundle loads at the position the first module used to, ahead of anything
 * that was listed after it and behind anything before it (jQuery, in practice).
 */
function rewrite(html, prefix, bundlePath) {
  const sources = [];

  const out = html.replace(SCRIPT_LINE, function (line, src) {
    if (src.indexOf(prefix) !== 0) return line;
    sources.push(src);
    return sources.length === 1 ? '  <script src="' + bundlePath + '"></script>\n' : '';
  });

  return { html: out, sources: sources };
}

/**
 * Join the sources, each behind a comment naming the file it came from.
 *
 * The marker is what makes a stack trace from the published site usable: the
 * line number is a bundle line, and the nearest marker above it says which
 * module that line belongs to.
 */
function concatenate(sources, read) {
  return sources.map(function (src) {
    return '/* ==== ' + src + ' ==== */\n' + read(src) + '\n;';
  }).join('\n');
}

/**
 * @param {{ html: string, prefix: string, bundlePath: string, read: function }} options
 * @returns {{ html: string, script: string, sources: string[] }}
 */
function bundle(options) {
  const rewritten = rewrite(options.html, options.prefix, options.bundlePath);

  if (rewritten.sources.length === 0) {
    throw new Error('bundle: no <script src="' + options.prefix + '..."> tags to bundle');
  }

  if (rewritten.html.indexOf('src="' + options.prefix) !== -1) {
    throw new Error('bundle: a ' + options.prefix + ' script tag survived the rewrite');
  }

  return {
    html: rewritten.html,
    script: concatenate(rewritten.sources, options.read),
    sources: rewritten.sources
  };
}

module.exports = { bundle: bundle, rewrite: rewrite, concatenate: concatenate };
