#!/usr/bin/env node
/**
 * Bundle audit — boots the *published* shell, not the source tree.
 *
 * `render-audit.js` proves the app works when its 1 700-odd modules are loaded
 * as 1 700-odd script tags. That is not the program the site ships: the
 * publish step concatenates them into one file, and concatenation has exactly
 * one interesting failure mode — a module that parses on its own but not next
 * to its neighbours, or one that silently never made it in. Neither is visible
 * in the repository, so this audit runs against `_site` after the bundle step.
 *
 * It is deliberately cheap. The per-section checks are the render audit's job
 * and the code is identical either way; what is new after bundling is only
 * whether the one file parses, boots, and still contains every module. So:
 * the shell has no module tags left, the bundle carries a marker for every
 * module the source shell listed, the app boots, the curriculum is whole, and
 * three sections spread across the tree actually render.
 *
 *   node tests/bundle-audit.js _site
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { installStubs } = require('./support/jsdom-stubs.js');

const ROOT = path.join(__dirname, '..');
const failures = [];

function fail(rule, detail) {
  failures.push(rule + ': ' + detail);
}

function scriptSources(html) {
  const out = [];
  const pattern = /<script\s+src="([^"]+)"/g;
  let match = pattern.exec(html);

  while (match) {
    out.push(match[1]);
    match = pattern.exec(html);
  }
  return out;
}

/* -------------------------------------------------- the shell */

function checkShell(sources) {
  const modules = sources.filter(function (src) { return src.indexOf('src/js/') === 0; });

  if (modules.length > 0) {
    fail('unbundled-module', modules.length + ' src/js tag(s) survived, first is ' + modules[0]);
  }

  if (sources.indexOf('lib/app.bundle.js') === -1) {
    fail('no-bundle-tag', 'the shell does not load lib/app.bundle.js');
  }
  return sources;
}

/* The other serial round trip in the boot path: `main.css` used to name eleven
   files the browser could only discover after parsing it. */
function checkStylesheet(siteDir) {
  const css = fs.readFileSync(path.join(siteDir, 'src/css/main.css'), 'utf8');
  const expected = fs.readFileSync(path.join(ROOT, 'src/css/main.css'), 'utf8')
    .match(/@import\s+url\(\s*['"]([^'"]+)['"]/g) || [];

  if (css.indexOf('@import') !== -1) fail('stylesheet-not-inlined', 'main.css still has an @import');

  expected.forEach(function (line) {
    const href = /['"]([^'"]+)['"]/.exec(line)[1];

    if (css.indexOf('/* ==== ' + href + ' ==== */') === -1) {
      fail('missing-stylesheet', href + ' is imported by the source and not in the inlined sheet');
    }
  });
  return expected.length;
}

/**
 * Every module the *source* shell lists must have a marker in the bundle.
 *
 * This is the check that catches a dropped file, which is the one bundler bug
 * that boots fine: the missing module is usually a section nobody activates in
 * a smoke test, and its absence surfaces months later as a blank tab.
 */
function checkCompleteness(bundleText) {
  const expected = scriptSources(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))
    .filter(function (src) { return src.indexOf('src/js/') === 0; });

  expected.forEach(function (src) {
    if (bundleText.indexOf('/* ==== ' + src + ' ==== */') === -1) {
      fail('missing-module', src + ' is in the source shell and not in the bundle');
    }
  });
  return expected.length;
}

/* -------------------------------------------------- the boot */

function boot(siteDir, html, sources) {
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();

  virtualConsole.on('jsdomError', function (error) { consoleErrors.push(String(error.message)); });
  virtualConsole.on('error', function () {
    consoleErrors.push(Array.prototype.join.call(arguments, ' '));
  });

  const dom = new JSDOM(html.replace(/<script\s+src="[^"]+"><\/script>/g, ''),
    { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3002/',
      virtualConsole: virtualConsole });

  installStubs(dom.window);

  sources.forEach(function (source) {
    const tag = dom.window.document.createElement('script');
    tag.textContent = fs.readFileSync(path.join(siteDir, source), 'utf8');
    dom.window.document.head.appendChild(tag);
  });

  return { window: dom.window, consoleErrors: consoleErrors };
}

/* The first, the middle and the last section in curriculum order: enough to
   prove the bundle is a working program rather than only a parsing one, and
   spread so a whole track dropping out of the concatenation is visible. */
function sampleIds(sections) {
  return [sections[0], sections[Math.floor(sections.length / 2)], sections[sections.length - 1]]
    .map(function (section) { return section.id; });
}

function renderSample(app, window) {
  const sections = window.Curriculum.sections();

  sampleIds(sections).forEach(function (id) {
    try {
      window.location.hash = '#' + id;
      app.navigation.go(id);
    } catch (error) {
      fail('threw-on-activation', id + ' — ' + (error && error.message));
      return;
    }

    const container = window.document.getElementById(id + '-content');
    const length = container ? container.innerHTML.trim().length : 0;

    if (length < 500) fail('container-empty', id + ' rendered ' + length + ' characters');
  });
  return sections.length;
}

/* -------------------------------------------------- the run */

function run() {
  const siteDir = path.resolve(process.argv[2] || '_site');
  const html = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  const sources = checkShell(scriptSources(html));
  const bundled = checkCompleteness(fs.readFileSync(path.join(siteDir, 'lib/app.bundle.js'), 'utf8'));
  const sheets = checkStylesheet(siteDir);

  const booted = boot(siteDir, html, sources);
  const app = booted.window.BerugoStart ? booted.window.BerugoStart() : null;

  if (!app) throw new Error('the bundle did not boot: window.BerugoStart is missing');

  const rendered = renderSample(app, booted.window);
  const expected = require('../src/js/core/curriculum.js').sections().length;

  if (rendered !== expected) {
    fail('curriculum-truncated', 'the bundle has ' + rendered + ' sections, the source has ' + expected);
  }

  booted.consoleErrors.forEach(function (message) {
    fail('console-error', message.slice(0, 200));
  });

  console.log('  bundled ' + bundled + ' modules into one script and ' + sheets +
    ' stylesheets into one sheet, booted ' + rendered + ' sections, rendered ' +
    sampleIds(booted.window.Curriculum.sections()).join(', '));
}

try {
  run();
} catch (error) {
  failures.push('audit-crashed: ' + (error && error.stack ? error.stack : error));
}

if (failures.length > 0) {
  console.error('\nbundle audit FAILED — ' + failures.length + ' problem(s):\n');
  failures.forEach(function (failure) { console.error('  ' + failure); });
  process.exit(1);
}

console.log('bundle audit passed — one script, every module present, the app boots');
