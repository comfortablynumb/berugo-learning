#!/usr/bin/env node
/**
 * Prints what a section actually renders: every metric tile, every table and
 * every note, for one section id.
 *
 * The standing rule on this project is "measure first, then write the sentence
 * that quotes the measurement". The render audit already boots the whole app
 * headlessly, so the numbers a learner will see are available without a
 * browser - this is that boot with the assertions replaced by output.
 *
 * Usage: node tools/section-dump.js <section-id> [control=value ...]
 *
 * Control overrides are applied through the section's own control panel, so a
 * dump at non-default settings goes through exactly the code path a click
 * would: `node tools/section-dump.js heuristic-search heu-side=20`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

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
  window.HTMLCanvasElement.prototype.getContext = canvasContext;
  window.SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: 0, height: 0 };
  };
  window.Worker = undefined;
}

function boot() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const virtualConsole = new VirtualConsole();

  virtualConsole.on('jsdomError', function (error) {
    process.stderr.write('jsdom error: ' + error.message + '\n');
  });
  const dom = new JSDOM(html.replace(/<script\s+src="[^"]+"><\/script>/g, ''),
    { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3002/',
      virtualConsole: virtualConsole });

  installStubs(dom.window);
  scriptSources(html).forEach(function (source) {
    const tag = dom.window.document.createElement('script');

    tag.textContent = fs.readFileSync(path.join(ROOT, source), 'utf8');
    dom.window.document.head.appendChild(tag);
  });
  return dom.window;
}

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function dumpMetrics(container) {
  process.stdout.write('\n--- metrics ---\n');
  Array.prototype.forEach.call(container.querySelectorAll('.metric'), function (tile) {
    const label = tile.querySelector('.metric-label');
    const value = tile.querySelector('.metric-value');
    const note = tile.querySelector('.metric-note');

    process.stdout.write(clean(label && label.textContent) + ' = ' +
      clean(value && value.textContent) + '   [' + clean(note && note.textContent) + ']\n');
  });
}

function dumpTables(container) {
  Array.prototype.forEach.call(container.querySelectorAll('table'), function (table) {
    process.stdout.write('\n--- table #' + (table.id || '(unnamed)') + ' ---\n');
    Array.prototype.forEach.call(table.querySelectorAll('tr'), function (row) {
      const cells = Array.prototype.map.call(row.querySelectorAll('th,td'), function (cell) {
        return clean(cell.textContent);
      });

      process.stdout.write(cells.join(' | ') + '\n');
    });
  });
}

function dumpNotes(container) {
  process.stdout.write('\n--- notes ---\n');
  Array.prototype.forEach.call(container.querySelectorAll('p.note'), function (note) {
    const text = clean(note.textContent);

    if (!text) return;
    process.stdout.write('#' + (note.id || '?') + ': ' + text + '\n');
  });
}

function applyOverrides(window, overrides) {
  if (overrides.length === 0) return;
  overrides.forEach(function (pair) {
    const parts = pair.split('=');
    const node = window.document.getElementById(parts[0]);

    if (!node) throw new Error('no control #' + parts[0]);

    if (node.type === 'checkbox') node.checked = parts[1] === 'true';
    else node.value = parts[1];
    window.jQuery(node).trigger('change');
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) throw new Error('usage: node tools/section-dump.js <section-id> [id=value]');
  const sectionId = args[0];
  const window = boot();
  const app = window.BerugoStart ? window.BerugoStart() : null;

  if (!app) throw new Error('the app did not boot: window.BerugoStart is missing');

  window.location.hash = '#' + sectionId;
  app.navigation.go(sectionId);
  applyOverrides(window, args.slice(1));
  const container = window.document.getElementById(sectionId + '-content');

  if (!container) throw new Error('no container for ' + sectionId);
  process.stdout.write('===== ' + sectionId + ' =====\n');
  dumpMetrics(container);
  dumpTables(container);
  dumpNotes(container);
}

main();
