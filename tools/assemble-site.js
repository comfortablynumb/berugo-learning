#!/usr/bin/env node
/**
 * Assemble the publishable copy of the site: `node tools/assemble-site.js _site`.
 *
 * Only what the browser asks for. The tests, the milestone documents and the
 * tooling are not part of the app, and `node_modules` is 100 MB of things the
 * page never loads.
 *
 * This exists in Node rather than as four lines of `cp` in the workflow so the
 * publish is reproducible on the machine the site is developed on — which is
 * Windows, where those four lines are not four lines. `npm run build:site`
 * runs the whole publish path locally, bundle and audit included.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
/* `src` stays even though the shell is bundled: the Web Worker sandbox is
   started from `src/js/core/worker-runtime.js` at run time and `importScripts`
   its dependencies by relative path. */
const DIRECTORIES = ['assets', 'lib', 'src'];

function copyInto(siteDir, name) {
  const from = path.join(ROOT, name);

  if (!fs.existsSync(from)) throw new Error('assemble: ' + name + ' is missing from the repository');
  fs.cpSync(from, path.join(siteDir, name), { recursive: true });
}

function countFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(function (entry) { return entry.isFile(); }).length;
}

function main() {
  const siteDir = path.resolve(process.argv[2] || '_site');

  fs.rmSync(siteDir, { recursive: true, force: true });
  fs.mkdirSync(siteDir, { recursive: true });

  FILES.concat(DIRECTORIES).forEach(function (name) { copyInto(siteDir, name); });

  /* Branch-served Pages runs Jekyll unless told not to, and Jekyll drops paths
     it does not recognise. The artifact path this repository uses does not run
     Jekyll at all — and `upload-pages-artifact` excludes dotfiles, so this
     marker does not even reach the deployment. It is written anyway because it
     costs nothing and it is what makes `_site` correct to serve any other way. */
  fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');

  console.log('assembled ' + countFiles(siteDir) + ' files into ' + path.relative(ROOT, siteDir));
}

main();
