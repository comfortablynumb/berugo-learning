#!/usr/bin/env node
/**
 * Wiring audit - a static pass over index.html and every module.
 *
 * This is the check that stops the two failure modes the reference platform
 * suffered from: a sidebar that disagrees with the syllabus, and a module list
 * maintained by hand in two places. It fails on:
 *   - an inline <script> with a body
 *   - a curriculum section with no <section> container or no #<id>-content
 *   - a container with no curriculum entry
 *   - a curriculum section that no module registers, or a registration with no
 *     curriculum entry
 *   - a duplicate id in index.html
 *   - a <script src> that does not exist on disk
 *   - a module under src/js that index.html never loads
 *   - a subscribe()/emit() for an event outside the known vocabulary
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const KNOWN_EVENTS = ['navigation', 'theme', 'progress'];
const EVENT_PREFIXES = ['runner:', 'change:'];

const failures = [];
const notes = [];

function fail(rule, detail) {
  failures.push(rule + ': ' + detail);
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function walk(dir, out) {
  const results = out || [];
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach(function (entry) {
    const relative = dir + '/' + entry.name;
    if (entry.isDirectory()) walk(relative, results);
    else if (entry.name.endsWith('.js')) results.push(relative);
  });
  return results;
}

function matchAll(source, pattern) {
  const out = [];
  let match = pattern.exec(source);
  while (match) {
    out.push(match);
    match = pattern.exec(source);
  }
  return out;
}

function loadCurriculum() {
  return require(path.join(ROOT, 'src/js/core/curriculum.js'));
}

function checkInlineScripts(html) {
  matchAll(html, /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g).forEach(function (match) {
    if (match[1].trim()) fail('inline-script', 'index.html contains an inline script body');
  });
}

function checkDuplicateIds(html) {
  const seen = new Set();
  matchAll(html, /\sid="([^"]+)"/g).forEach(function (match) {
    if (seen.has(match[1])) fail('duplicate-id', match[1]);
    seen.add(match[1]);
  });
}

function checkContainers(html, curriculum) {
  const containers = matchAll(html, /data-section="([^"]+)"/g).map(function (m) { return m[1]; });
  const contentIds = matchAll(html, /id="([^"]+)-content"/g).map(function (m) { return m[1]; });

  curriculum.sections().forEach(function (section) {
    if (containers.indexOf(section.id) === -1) fail('missing-container', section.id);
    if (contentIds.indexOf(section.id) === -1) fail('missing-content-div', section.id);
  });

  containers.forEach(function (id) {
    if (!curriculum.has(id)) fail('orphan-container', id);
  });

  return containers;
}

function collectRegistrations(files) {
  const ids = [];
  files.forEach(function (file) {
    const source = read(file);
    matchAll(source, /SectionRegistry\.register\(\{\s*id:\s*([A-Za-z_$][\w$]*|'[^']+')/g)
      .forEach(function (match) {
        const raw = match[1];
        if (raw[0] === "'") {
          ids.push({ id: raw.slice(1, -1), file: file });
          return;
        }
        const constant = source.match(new RegExp('const\\s+' + raw + "\\s*=\\s*'([^']+)'"));
        if (constant) ids.push({ id: constant[1], file: file });
        else fail('unresolved-registration', file + ' registers a non-literal id');
      });
  });
  return ids;
}

function checkRegistrations(files, curriculum) {
  const registrations = collectRegistrations(files);
  const ids = registrations.map(function (entry) { return entry.id; });

  curriculum.sections().forEach(function (section) {
    if (ids.indexOf(section.id) === -1) fail('unregistered-section', section.id);
  });

  registrations.forEach(function (entry) {
    if (!curriculum.has(entry.id)) fail('unknown-registration', entry.id + ' in ' + entry.file);
  });

  const counts = ids.reduce(function (acc, id) { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
  Object.keys(counts).forEach(function (id) {
    if (counts[id] > 1) fail('duplicate-registration', id);
  });

  return ids;
}

/**
 * A script the page loads must at least parse.
 *
 * Section controllers and templates are browser-only - `node --test` never
 * requires them - so a syntax error in one of them passes every unit test and
 * silently deletes the whole section in the browser. That is exactly what an
 * unescaped apostrophe in `selection-and-order-section.js` did, and only the
 * page load found it. `new vm.Script` compiles without running, which is all
 * this needs.
 */
function checkParses(src) {
  try {
    /* eslint-disable-next-line no-new */
    new vm.Script(read(src), { filename: src });
  } catch (error) {
    fail('script-does-not-parse', src + ' — ' + error.message);
  }
}

function checkScriptTags(html, files) {
  const loaded = matchAll(html, /<script src="([^"]+)"><\/script>/g).map(function (m) { return m[1]; });

  loaded.forEach(function (src) {
    if (!fs.existsSync(path.join(ROOT, src))) {
      fail('missing-script-file', src);
      return;
    }
    checkParses(src);
  });

  files.forEach(function (file) {
    if (file === 'src/js/core/worker-runtime.js') return;   // loaded by the Worker, not the page
    if (loaded.indexOf(file) === -1) fail('unloaded-module', file);
  });

  return loaded;
}

function checkEvents(files) {
  files.forEach(function (file) {
    const source = read(file);
    matchAll(source, /\.(?:subscribe|emit)\(\s*'([^']+)'/g).forEach(function (match) {
      const event = match[1];
      if (KNOWN_EVENTS.indexOf(event) !== -1) return;
      if (EVENT_PREFIXES.some(function (prefix) { return event.indexOf(prefix) === 0; })) return;
      fail('unknown-event', event + ' in ' + file);
    });
  });
}

function checkSelectors(html, files) {
  const htmlIds = new Set(matchAll(html, /\sid="([^"]+)"/g).map(function (m) { return m[1]; }));
  const templateSource = files
    .filter(function (file) { return /template|view|component|section|lab/.test(file); })
    .map(read)
    .join('\n');

  files.forEach(function (file) {
    const source = read(file);
    matchAll(source, /jQuery\('#([a-z][\w-]*)'\)/g).forEach(function (match) {
      const id = match[1];
      if (htmlIds.has(id)) return;
      if (templateSource.indexOf('id="' + id + '"') !== -1) return;
      if (templateSource.indexOf("id=\"' + ") !== -1 && /-$/.test(id)) return;
      fail('dangling-selector', '#' + id + ' used in ' + file + ' is never rendered');
    });
  });
}

/**
 * Two modules that publish the same global name silently overwrite each other,
 * and the survivor depends on script order. That cost a debugging round when
 * `logic-minimisation-template.js` claimed `MinimiseTemplate`, which the
 * automata section already used: the automata section then rendered with the
 * wrong template and threw inside a regex parser, several hundred lines from
 * the actual mistake.
 */
function checkGlobalNames(files) {
  const owners = {};

  files.forEach(function (file) {
    matchAll(read(file), /(?:root|scope)[.]([A-Z][A-Za-z0-9_]*)[ ]*=[ ]*api;/g).forEach(function (match) {
      const name = match[1];

      if (owners[name] && owners[name] !== file) {
        fail('duplicate-global', name + ' is published by ' + owners[name] + ' and ' + file);
        return;
      }
      owners[name] = file;
    });
  });
}

function run() {
  const html = read('index.html');
  const files = walk('src/js');
  const curriculum = loadCurriculum();

  checkInlineScripts(html);
  checkDuplicateIds(html);
  checkContainers(html, curriculum);
  checkRegistrations(files, curriculum);
  checkScriptTags(html, files);
  checkEvents(files);
  checkSelectors(html, files);
  checkGlobalNames(files);

  notes.push(curriculum.sections().length + ' sections, ' + files.length + ' modules');

  if (failures.length) {
    console.error('WIRING AUDIT FAILED');
    failures.forEach(function (line) { console.error('  ✗ ' + line); });
    process.exit(1);
  }

  console.log('wiring audit passed — ' + notes.join('; '));
}

run();
