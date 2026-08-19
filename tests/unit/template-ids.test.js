'use strict';

/**
 * Within one section template, control ids, metric ids and literal element ids
 * must be disjoint.
 *
 * `ControlPanel` and `MetricGrid` both emit `id` attributes, and every section
 * is in the DOM at once, so a clash makes `getElementById` return whichever
 * node comes first in document order. The symptom is a panel that silently
 * never renders - `$('#x tbody')` finds nothing because `#x` resolved to a
 * range input - and neither the wiring audit nor any unit test sees it, because
 * both halves exist and both are wired.
 *
 * This check is one regular expression per source of ids and it found a real
 * one: `b-trees-template.js` used `bt-scan` for a slider and for the range-scan
 * table, so that table's body was never written.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');

function matchAll(source, pattern) {
  const out = [];
  let match = pattern.exec(source);
  while (match) {
    out.push(match);
    match = pattern.exec(source);
  }
  return out;
}

function idsOf(source) {
  const metricsBlock = source.match(/const METRICS = \[([\s\S]*?)\n {2}\];/);
  return {
    controls: matchAll(source, /\{\s*id:\s*'([^']+)',\s*kind:/g).map(function (m) { return m[1]; }),
    metrics: metricsBlock
      ? matchAll(metricsBlock[1], /\{\s*id:\s*'([^']+)'/g).map(function (m) { return m[1]; })
      : [],
    elements: matchAll(source, /id="([a-z][\w-]*)"/g).map(function (m) { return m[1]; })
  };
}

const templates = fs.readdirSync(SECTIONS).filter(function (file) {
  return file.endsWith('-template.js');
});

test('templates: there is at least one template to check', function () {
  assert.ok(templates.length > 20, 'found only ' + templates.length + ' templates');
});

templates.forEach(function (file) {
  test('templates: ' + file + ' has no id used for two different things', function () {
    const source = fs.readFileSync(path.join(SECTIONS, file), 'utf8');
    const ids = idsOf(source);
    const seen = new Map();

    ['controls', 'metrics', 'elements'].forEach(function (kind) {
      ids[kind].forEach(function (id) {
        assert.ok(!seen.has(id),
          id + ' is used as a ' + seen.get(id) + ' and as ' + (kind === 'elements' ? 'an element' : 'a ' + kind.slice(0, -1)) +
          '; getElementById will return whichever comes first in the document');
        seen.set(id, kind === 'elements' ? 'element' : kind.slice(0, -1));
      });
    });

    /* MetricGrid also emits `<id>-note`, and ControlPanel emits `<id>-value`
       for a range. Those derived ids must not clash with anything either. */
    ids.metrics.forEach(function (id) {
      assert.ok(!seen.has(id + '-note') || seen.get(id + '-note') === undefined,
        id + '-note collides with a hand-written element id');
    });
    ids.controls.forEach(function (id) {
      assert.ok(ids.elements.indexOf(id + '-value') === -1,
        id + '-value collides with a hand-written element id');
    });
  });
});

test('templates: no id is emitted by two different sections', function () {
  /* Every section is in the DOM at once - hidden, but present - so an id
     reused across two templates is the same collision as one reused within a
     template, and it fails in whichever section renders second. */
  const owners = new Map();

  templates.forEach(function (file) {
    const source = fs.readFileSync(path.join(SECTIONS, file), 'utf8');
    const ids = idsOf(source);
    const emitted = ids.controls
      .concat(ids.controls.map(function (id) { return id + '-value'; }))
      .concat(ids.metrics)
      .concat(ids.metrics.map(function (id) { return id + '-note'; }))
      .concat(ids.elements);

    new Set(emitted).forEach(function (id) {
      assert.ok(!owners.has(id),
        'id "' + id + '" is emitted by both ' + owners.get(id) + ' and ' + file);
      owners.set(id, file);
    });
  });

  assert.ok(owners.size > 400, 'only ' + owners.size + ' ids seen across the templates');
});
