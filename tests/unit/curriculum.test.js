'use strict';

const test = require('node:test');
const assert = require('node:assert');

const Curriculum = require('../../src/js/core/curriculum.js');

test('section ids are unique', function () {
  const ids = Curriculum.sections().map(function (section) { return section.id; });
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate section id in the curriculum');
});

test('every section carries the fields the chrome renders', function () {
  Curriculum.sections().forEach(function (section) {
    assert.ok(section.id, 'id');
    assert.ok(section.title, 'title for ' + section.id);
    assert.ok(section.trackId && section.trackTitle, 'track for ' + section.id);
    assert.ok(section.groupId && section.groupTitle, 'group for ' + section.id);
    assert.ok(['section', 'page'].indexOf(section.kind) !== -1, 'kind for ' + section.id);
  });
});

test('teaching sections declare a summary and tags', function () {
  Curriculum.teachingSections().forEach(function (section) {
    assert.ok(section.summary, 'summary for ' + section.id);
    assert.ok(section.tags.length > 0, 'tags for ' + section.id);
  });
});

test('next and prev walk the flat order and stop at the ends', function () {
  const sections = Curriculum.sections();
  const first = sections[0];
  const last = sections[sections.length - 1];

  assert.strictEqual(Curriculum.prev(first.id), null, 'nothing before the first section');
  assert.strictEqual(Curriculum.next(last.id), null, 'nothing after the last section');

  for (let i = 0; i < sections.length - 1; i += 1) {
    assert.strictEqual(Curriculum.next(sections[i].id).id, sections[i + 1].id);
    assert.strictEqual(Curriculum.prev(sections[i + 1].id).id, sections[i].id);
  }
});

test('lookups reject unknown ids rather than inventing them', function () {
  assert.strictEqual(Curriculum.byId('not-a-section'), null);
  assert.strictEqual(Curriculum.has('not-a-section'), false);
  assert.strictEqual(Curriculum.positionOf('not-a-section'), -1);
});

test('search matches titles, summaries and tags, case-insensitively', function () {
  assert.ok(Curriculum.search('TYPED ARRAYS').length > 0, 'matches a tag');
  assert.ok(Curriculum.search('worker').length > 0, 'matches a summary');
  assert.strictEqual(Curriculum.search('   ').length, 0, 'blank query matches nothing');
  assert.strictEqual(Curriculum.search('zzzzz').length, 0, 'no false matches');
});

test('the first section is a page, so a cold start never lands mid-lesson', function () {
  assert.strictEqual(Curriculum.byId(Curriculum.firstId()).kind, 'page');
});
