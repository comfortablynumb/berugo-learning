'use strict';

/**
 * Wires one already-written section pair into the application.
 *
 * A section is three edits away from existing: an entry in the curriculum
 * group it belongs to, a container in `index.html`, and the two script tags.
 * Doing them by hand is how a template ends up with no controller (the wiring
 * audit calls that `unloaded-module`) or a curriculum entry with an apostrophe
 * in it (which breaks the file, which takes the sidebar down, which crashes
 * the render audit with a confusing message about `tracks`).
 *
 * Usage:
 *   node tools/wire-section.js <curriculum-file> <after-section-id> <spec.json>
 *
 * where spec.json is { id, title, summary, tags: [...] } or an array of them.
 * `after-section-id` names the section the new entries follow, both in the
 * curriculum group and in index.html, so the order on the page matches the
 * order in the syllabus.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

/** Single quotes are the file's string delimiter, so an apostrophe in any
 *  field breaks the module rather than the sentence. */
function checkQuotes(entry) {
  /* These have to be the VALUES, not the field names. Checking the names
     means the guard never fires on a title or a summary - which is how an
     apostrophe reached curriculum-algorithms.js and took the sidebar down. */
  [entry.id, entry.title, entry.summary].concat(entry.tags).forEach(function (value) {
    if (String(value).indexOf("'") === -1) return;
    fail('apostrophe in a curriculum string: ' + value);
  });
}

function entryText(entry) {
  const tags = entry.tags.map(function (tag) { return "'" + tag + "'"; }).join(', ');
  return [
    '            {',
    "              id: '" + entry.id + "',",
    "              title: '" + entry.title + "',",
    "              summary: '" + entry.summary + "',",
    '              tags: [' + tags + ']',
    '            }'
  ].join('\n');
}

/** `after` is either a section id, or `group:<milestone>` to insert as the
 *  first members of a milestone group that is still empty. */
function insertCurriculum(file, after, entries) {
  const source = fs.readFileSync(file, 'utf8');

  if (after.indexOf('group:') === 0) return insertIntoGroup(file, source, after.slice(6), entries);
  const anchor = source.indexOf("id: '" + after + "'");

  if (anchor === -1) fail('no curriculum entry for ' + after + ' in ' + file);
  const close = source.indexOf('\n            }', anchor);

  if (close === -1) fail('could not find the end of the ' + after + ' entry');
  const at = close + '\n            }'.length;
  const addition = entries.map(function (entry) { return ',\n' + entryText(entry); }).join('');
  fs.writeFileSync(file, source.slice(0, at) + addition + source.slice(at));
  return null;
}

/** Insert as the first members of a milestone group's `sections` array. */
function insertIntoGroup(file, source, group, entries) {
  const anchor = source.indexOf("id: '" + group + "',");

  if (anchor === -1) fail('no group ' + group + ' in ' + file);
  const marker = source.indexOf('sections: [', anchor);

  if (marker === -1) fail('group ' + group + ' has no sections array');
  const at = marker + 'sections: ['.length;
  const existing = source.slice(at, source.indexOf(']', at)).trim().length > 0;
  const addition = entries.map(function (entry) { return '\n' + entryText(entry); }).join(',');

  fs.writeFileSync(file, source.slice(0, at) + addition + (existing ? ',' : '') + source.slice(at));
  return null;
}

/** Containers go after the named section's, or at the end of `<main>` when the
 *  anchor is a group rather than a section. */
function insertContainers(entries, after) {
  const file = path.join(ROOT, 'index.html');
  const source = fs.readFileSync(file, 'utf8');
  const anchor = after.indexOf('group:') === 0
    ? '    </main>'
    : '<section data-section="' + after + '" hidden>';
  const at = source.indexOf(anchor);

  if (at === -1) fail('no container for ' + after + ' in index.html');
  const end = after.indexOf('group:') === 0 ? at : source.indexOf('\n', at) + 1;
  const html = entries.map(function (entry) {
    return '      <section data-section="' + entry.id + '" hidden><div class="section-body">' +
      '<div id="' + entry.id + '-content"></div></div></section>\n';
  }).join('');
  fs.writeFileSync(file, source.slice(0, end) + html + source.slice(end));
}

function insertScripts(entries) {
  const file = path.join(ROOT, 'index.html');
  const source = fs.readFileSync(file, 'utf8');
  const anchor = '  <script src="src/js/app.js"></script>';
  const at = source.indexOf(anchor);

  if (at === -1) fail('no app.js script tag in index.html');
  const tags = entries.map(function (entry) {
    return '  <script src="src/js/sections/' + entry.id + '-template.js"></script>\n' +
      '  <script src="src/js/sections/' + entry.id + '-section.js"></script>\n';
  }).join('');
  fs.writeFileSync(file, source.slice(0, at) + tags + source.slice(at));
}

function refuseIfWired(curriculum, entries) {
  const source = fs.readFileSync(curriculum, 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  entries.forEach(function (entry) {
    const inCurriculum = source.indexOf("id: '" + entry.id + "',") !== -1;
    const inHtml = html.indexOf('data-section="' + entry.id + '"') !== -1;

    if (!inCurriculum && !inHtml) return;
    fail(entry.id + ' is already wired (curriculum: ' + inCurriculum + ', index.html: ' + inHtml +
      ') — undo the partial wiring before re-running');
  });
}

function checkFilesExist(entries) {
  entries.forEach(function (entry) {
    ['-template.js', '-section.js'].forEach(function (suffix) {
      const file = path.join(ROOT, 'src', 'js', 'sections', entry.id + suffix);

      if (fs.existsSync(file)) return;
      fail('missing ' + file + ' — write the pair before wiring it');
    });
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length !== 3) fail('usage: node tools/wire-section.js <curriculum-file> <after-id> <spec.json>');
  const parsed = JSON.parse(fs.readFileSync(args[2], 'utf8'));
  const entries = Array.isArray(parsed) ? parsed : [parsed];

  entries.forEach(checkQuotes);
  checkFilesExist(entries);
  /* Wiring is three separate writes, so a failure in the second leaves the
     first applied. Refusing on an id that is already present makes a re-run
     after such a failure safe instead of silently duplicating the section. */
  refuseIfWired(path.join(ROOT, args[0]), entries);
  insertCurriculum(path.join(ROOT, args[0]), args[1], entries);
  insertContainers(entries, args[1]);
  insertScripts(entries);
  process.stdout.write('wired ' + entries.map(function (e) { return e.id; }).join(', ') + '\n');
}

main();
