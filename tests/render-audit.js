#!/usr/bin/env node
/**
 * Render audit - boots the whole app headlessly and activates every section.
 *
 * The wiring audit is static: it proves every module is loaded and every
 * script *parses*. It cannot see a section that parses, loads, and then throws
 * the moment it renders - and three milestones running, the bugs that survived
 * the entire unit suite were exactly that shape:
 *
 *   M06  `TextLab.snapshot` assumed a Map and threw on load; no node test
 *        called it, so the tries section drew nothing and the suite was green.
 *   M07  a metric id collided with a container id, so a table was rendered
 *        inside a metric tile and its own tbody stayed empty.
 *   M10  a section controller did not parse at all, so the section rendered
 *        nothing; every unit test passed because `node --test` never loads a
 *        section controller.
 *
 * So this pass renders. It is NOT a substitute for opening the page in Chrome:
 * jsdom has no layout, so nothing here can see a chart at its fallback width,
 * a colour that vanishes into the background, or a mermaid diagram that fails
 * to lay out. What it does catch is everything that throws, and every DOM
 * target a section declared and then never wrote.
 *
 * It fails on:
 *   - an exception while a section renders or updates
 *   - a console.error raised during a section's activation
 *   - a section whose content container stays (nearly) empty
 *   - a table with a head and an empty body
 *   - a metric tile still reading the em-dash placeholder after the update
 *
 * Run with a section id to audit one section: `node tests/render-audit.js bfs`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

/* A metric that never got a value still reads the placeholder MetricGrid
   renders. A handful of tiles legitimately report "not applicable", and they
   say so in words rather than leaving the dash. */
const PLACEHOLDER = '—';

const failures = [];
const notes = [];

function fail(sectionId, rule, detail) {
  failures.push(sectionId + ' | ' + rule + ': ' + detail);
}

/* -------------------------------------------------- the page */

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

/** jsdom has no layout and no canvas, and the app must not try to fetch the
 *  vendored D3 or mermaid over a network that is not there. */
function installStubs(window) {
  const noop = function () {};

  window.ResizeObserver = function () {
    return { observe: noop, unobserve: noop, disconnect: noop };
  };
  window.IntersectionObserver = window.ResizeObserver;
  window.matchMedia = function (query) {
    return { matches: false, media: query, addListener: noop, removeListener: noop,
      addEventListener: noop, removeEventListener: noop, onchange: null };
  };
  window.scrollTo = noop;
  window.HTMLCanvasElement.prototype.getContext = function () {
    return canvasContext();
  };
  window.SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: 0, height: 0 };
  };
  window.Worker = undefined;
}

/** Enough of a 2D context that a canvas renderer runs to completion. Nothing
 *  here checks what was drawn - only that drawing did not throw. */
function canvasContext() {
  const noop = function () {};
  const context = {
    canvas: { width: 800, height: 400 },
    measureText: function (text) { return { width: String(text).length * 6 }; },
    createLinearGradient: function () { return { addColorStop: noop }; },
    getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
    setTransform: noop, save: noop, restore: noop
  };
  ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
    'arc', 'arcTo', 'rect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke',
    'clip', 'fillText', 'strokeText', 'translate', 'scale', 'rotate', 'drawImage',
    'setLineDash', 'putImageData'].forEach(function (name) { context[name] = noop; });
  return context;
}

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sources = scriptSources(html);
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();

  virtualConsole.on('jsdomError', function (error) { consoleErrors.push(String(error.message)); });
  virtualConsole.on('error', function () {
    consoleErrors.push(Array.prototype.join.call(arguments, ' '));
  });

  const dom = new JSDOM(html.replace(/<script\s+src="[^"]+"><\/script>/g, ''),
    { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3002/',
      virtualConsole: virtualConsole });
  const window = dom.window;

  installStubs(window);

  sources.forEach(function (source) {
    const file = path.join(ROOT, source);

    if (!fs.existsSync(file)) throw new Error('index.html loads a missing file: ' + source);
    const tag = window.document.createElement('script');
    tag.textContent = fs.readFileSync(file, 'utf8');
    window.document.head.appendChild(tag);
  });

  return { window: window, consoleErrors: consoleErrors, scriptCount: sources.length };
}

/* -------------------------------------------------- the per-section checks */

function checkTables(sectionId, container) {
  Array.prototype.forEach.call(container.querySelectorAll('table'), function (table) {
    const head = table.querySelector('thead');
    const body = table.querySelector('tbody');

    if (!head) return;

    if (!body) {
      fail(sectionId, 'table-has-no-body', '#' + (table.id || '(unnamed)') + ' has a head and no body');
      return;
    }

    if (body.querySelectorAll('tr').length === 0) {
      fail(sectionId, 'empty-table-body', '#' + (table.id || '(unnamed)') + ' was never written');
    }
  });
}

/**
 * A tile still reading the em-dash is only a defect when it says nothing.
 *
 * Several tiles report the dash *on purpose* and are right to: the chooser's
 * margin column cannot rank a winner that makes no comparisons, the
 * counter-example tile has no counter-example to show in range, and the code
 * engine has not run yet. Every one of those carries a note saying so, which
 * is the platform's standing rule - never a bare number, and never a bare
 * dash either. So the rule enforced here is the rule the content already
 * follows: a placeholder needs an explanation next to it.
 */
function checkMetrics(sectionId, container) {
  Array.prototype.forEach.call(container.querySelectorAll('.metric-value'), function (tile) {
    const text = (tile.textContent || '').trim();

    if (text !== '' && text !== PLACEHOLDER) return;

    const note = tile.parentNode.querySelector('.metric-note');
    const explanation = note ? (note.textContent || '').trim() : '';

    if (explanation === '') {
      fail(sectionId, 'unexplained-placeholder', '#' + (tile.id || '(unnamed)') +
        ' reads "' + text + '" and its tile carries no note');
    }
  });
}

/**
 * The orientation and the insight are written with two pieces of inline
 * markup - `**` around the claim a paragraph is making and backticks around an
 * identifier - and for the whole life of the project both were escaped and
 * shown to the learner raw, in 204 of 306 sections. Nothing caught it, because
 * every check here was about structure and none about the text.
 *
 * So this is the text check: after rendering, no marker may survive in either
 * block. It runs against the real DOM the app produced rather than against the
 * source, which is what makes it robust - the prose is assembled by
 * concatenating string fragments, so a pair of markers routinely straddles two
 * literals and no scan of the source can pair them reliably.
 */
const MARKERS = [
  { pattern: /\*\*/, name: 'bold' },
  { pattern: /`/, name: 'code' }
];

function checkProse(sectionId, container) {
  ['.section-orientation', '.insight'].forEach(function (selector) {
    Array.prototype.forEach.call(container.querySelectorAll(selector), function (block) {
      const text = block.textContent || '';

      MARKERS.forEach(function (marker) {
        if (!marker.pattern.test(text)) return;
        fail(sectionId, 'raw-markup', selector + ' shows a raw ' + marker.name +
          ' marker: ' + snippet(text, marker.pattern));
      });
    });
  });
}

function snippet(text, pattern) {
  const at = text.search(pattern);

  return JSON.stringify(text.slice(Math.max(0, at - 30), at + 30));
}

function checkContainer(sectionId, container) {
  if (!container) {
    fail(sectionId, 'no-container', 'index.html has no #' + sectionId + '-content');
    return false;
  }

  if (container.innerHTML.trim().length < 500) {
    fail(sectionId, 'container-empty', '#' + sectionId + '-content rendered ' +
      container.innerHTML.trim().length + ' characters');
    return false;
  }
  return true;
}

/* `navigation.go` sets `location.hash` and waits for `hashchange`, which jsdom
   delivers on a later turn - so the audit would check an unrendered container.
   Setting the hash first makes the second call take the "already there" branch,
   which activates synchronously. */
function activate(app, window, sectionId) {
  window.location.hash = '#' + sectionId;
  app.navigation.go(sectionId);
}

function auditSection(app, window, consoleErrors, sectionId) {
  const before = consoleErrors.length;

  try {
    activate(app, window, sectionId);
  } catch (error) {
    /* Four frames rather than one: the message alone rarely says which of a
       section's dozen measurement calls threw. */
    fail(sectionId, 'threw-on-activation', error && error.stack
      ? error.stack.split('\n').slice(0, 4).join(' | ') : error);
    return;
  }

  consoleErrors.slice(before).forEach(function (message) {
    fail(sectionId, 'console-error', message.slice(0, 200));
  });

  const container = window.document.getElementById(sectionId + '-content');

  if (!checkContainer(sectionId, container)) return;
  checkTables(sectionId, container);
  checkMetrics(sectionId, container);
  checkProse(sectionId, container);
}

/* -------------------------------------------------- the run */

function run() {
  const only = process.argv[2];
  const booted = boot();
  const window = booted.window;
  const app = window.BerugoStart ? window.BerugoStart() : null;

  if (!app) throw new Error('the app did not boot: window.BerugoStart is missing');

  const sections = window.Curriculum.sections()
    .filter(function (section) { return !only || section.id === only; });

  if (sections.length === 0) throw new Error('no section matched ' + only);
  sections.forEach(function (section) {
    auditSection(app, window, booted.consoleErrors, section.id);
  });

  notes.push('booted ' + booted.scriptCount + ' scripts, activated ' + sections.length + ' sections');
  return sections.length;
}

try {
  run();
} catch (error) {
  failures.push('audit-crashed: ' + (error && error.stack ? error.stack : error));
}

notes.forEach(function (note) { console.log('  ' + note); });

if (failures.length > 0) {
  console.error('\nrender audit FAILED — ' + failures.length + ' problem(s):\n');
  failures.forEach(function (failure) { console.error('  ' + failure); });
  process.exit(1);
}

console.log('render audit passed \u2014 every section rendered, no empty table, metric or raw marker');
