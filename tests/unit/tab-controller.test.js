'use strict';

/**
 * The tab strip every section frame is built on.
 *
 * Only the markup is exercised here, the way the sidebar tests do it: init()
 * needs jQuery and a document, and a fake of both would test the fake. What
 * matters and is testable is that the first tab opens, the rest start hidden,
 * the ids wire buttons to panels for a screen reader, and - the one that would
 * be a real bug - that the class the controller hides panels by is unique to
 * the strip that owns it.
 */

const test = require('node:test');
const assert = require('node:assert');

const TabController = require('../../src/js/components/tab-controller.js');

function options(sectionId) {
  return {
    stripId: 'tabs-' + sectionId,
    stripExtraClass: 'section-tabs',
    panelPrefix: 'panel-' + sectionId + '-',
    panelClass: 'tabpanel-' + sectionId,
    panelExtraClass: 'section-tabpanel',
    tabs: [
      { id: 'description', label: 'Description', content: '<p>what it is</p>' },
      { id: 'examples', label: 'Examples', content: '<p>numbers</p>' },
      { id: 'references', label: 'References', content: '<p>sources</p>' }
    ]
  };
}

test('tabs: the first tab is the open one and the rest start hidden', function () {
  const html = TabController.markup(options('hashing'));

  assert.strictEqual((html.match(/class="tab-btn active"/g) || []).length, 1);
  assert.strictEqual((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.strictEqual((html.match(/ hidden>/g) || []).length, 2);
  assert.ok(html.indexOf('id="panel-hashing-description" role="tabpanel"' +
    ' aria-labelledby="panel-hashing-description-tab">') !== -1);
});

test('tabs: every button names the panel it controls', function () {
  const html = TabController.markup(options('hashing'));

  options('hashing').tabs.forEach(function (tab) {
    assert.ok(html.indexOf('aria-controls="panel-hashing-' + tab.id + '"') !== -1,
      tab.id + ' button points at its panel');
    assert.ok(html.indexOf('id="panel-hashing-' + tab.id + '-tab"') !== -1,
      tab.id + ' button is addressable from its panel');
  });
});

test('tabs: the hide selector is per-strip, so one section cannot hide another', function () {
  const first = TabController.markup(options('hashing'));
  const second = TabController.markup(options('linked-lists'));

  assert.ok(first.indexOf('class="tabpanel-hashing section-tabpanel"') !== -1);
  assert.ok(second.indexOf('class="tabpanel-linked-lists section-tabpanel"') !== -1);
  assert.ok(first.indexOf('tabpanel-linked-lists') === -1);
});

test('tabs: content is placed verbatim, so a panel can hold rendered markup', function () {
  const html = TabController.markup(options('hashing'));
  assert.ok(html.indexOf('<p>what it is</p>') !== -1);
  assert.ok(html.indexOf('<p>sources</p>') !== -1);
});

test('tabs: init without a browser returns null rather than throwing', function () {
  assert.strictEqual(TabController.init(options('hashing')), null);
});
