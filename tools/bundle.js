#!/usr/bin/env node
/**
 * Bundle the assembled site in place: `node tools/bundle.js _site`.
 *
 * Reads `<site>/index.html`, concatenates every `src/js` module it loads into
 * `<site>/lib/app.bundle.js`, and rewrites the shell to load that one file.
 *
 * `src/` is deliberately left in place afterwards. The Web Worker sandbox is
 * started from `src/js/core/worker-runtime.js` at run time and `importScripts`
 * its dependencies by relative path, so those files still have to be fetchable
 * — they are simply no longer part of the boot path.
 *
 * The logic lives in `bundle-core.js`, which knows nothing about a filesystem;
 * this file is the only part that touches disk.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { bundle } = require('./bundle-core.js');

const BUNDLE_PATH = 'lib/app.bundle.js';
const PREFIX = 'src/js/';

function kib(bytes) {
  return (bytes / 1024).toFixed(0);
}

function main() {
  const siteDir = path.resolve(process.argv[2] || '_site');
  const indexPath = path.join(siteDir, 'index.html');

  if (!fs.existsSync(indexPath)) throw new Error('bundle: no index.html under ' + siteDir);

  const result = bundle({
    html: fs.readFileSync(indexPath, 'utf8'),
    prefix: PREFIX,
    bundlePath: BUNDLE_PATH,
    read: function (src) { return fs.readFileSync(path.join(siteDir, src), 'utf8'); }
  });

  fs.writeFileSync(path.join(siteDir, BUNDLE_PATH), result.script);
  fs.writeFileSync(indexPath, result.html);

  console.log('bundled ' + result.sources.length + ' modules into ' + BUNDLE_PATH +
    ' (' + kib(Buffer.byteLength(result.script)) + ' KiB), ' +
    (result.html.match(/<script\s+src=/g) || []).length + ' script tags left in the shell');
}

main();
