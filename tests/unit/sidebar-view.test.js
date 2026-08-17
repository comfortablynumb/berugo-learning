'use strict';

/**
 * The sidebar lists tracks, not sections.
 *
 * With 634 sections planned, a flat nav is unusable long before the curriculum
 * is finished, so the rule this suite pins is: one row per track - built or
 * planned - every built section still present in the markup but inside a
 * hidden body, and the track holding the current section opened for you.
 */

const test = require('node:test');
const assert = require('node:assert');

const SidebarView = require('../../src/js/views/sidebar-view.js');
const Curriculum = require('../../src/js/core/curriculum.js');

const progress = { statusOf: function () { return ''; } };

function countMatches(html, pattern) {
  return (html.match(pattern) || []).length;
}

test('sidebar: one toggle per track, and nothing else at the top level', function () {
  const html = SidebarView.markup(Curriculum, progress, []);
  const tracks = Curriculum.tracks();

  assert.strictEqual(countMatches(html, /data-track-toggle="/g), tracks.length);
  tracks.forEach(function (track) {
    assert.ok(html.indexOf('data-track-toggle="' + track.id + '"') !== -1, track.id + ' has a toggle');
    assert.ok(html.indexOf('>' + track.title + '<') !== -1, track.id + ' shows its title');
  });
});

test('sidebar: every track body is hidden until it is opened', function () {
  const closed = SidebarView.markup(Curriculum, progress, []);
  const tracks = Curriculum.tracks();

  assert.strictEqual(countMatches(closed, /class="sidebar-track-body" hidden/g), tracks.length,
    'all bodies hidden with nothing open');
  assert.strictEqual(countMatches(closed, /aria-expanded="true"/g), 0);

  const opened = SidebarView.markup(Curriculum, progress, [tracks[0].id]);
  assert.strictEqual(countMatches(opened, /class="sidebar-track-body" hidden/g), tracks.length - 1);
  assert.strictEqual(countMatches(opened, /aria-expanded="true"/g), 1);
  assert.ok(opened.indexOf('class="sidebar-track open"') !== -1, 'the open track is marked');
});

test('sidebar: the section links are still in the markup, inside the bodies', function () {
  const html = SidebarView.markup(Curriculum, progress, []);

  Curriculum.sections().forEach(function (section) {
    assert.ok(html.indexOf('data-nav="' + section.id + '"') !== -1,
      section.id + ' is still reachable from the nav');
  });
});

test('sidebar: each row counts what it holds, at both levels', function () {
  const html = SidebarView.markup(Curriculum, progress, []);

  Curriculum.tracks().forEach(function (track) {
    const built = Curriculum.builtCount(track);
    const row = html.slice(html.indexOf('data-track-toggle="' + track.id + '"'));

    if (built) {
      assert.ok(row.indexOf('<span class="sidebar-count">' + built + '</span>') !== -1,
        track.id + ' should count ' + built + ' built sections');
    } else {
      assert.ok(row.indexOf('<span class="sidebar-count planned">' + Curriculum.plannedCount(track) +
        '</span>') !== -1, track.id + ' should count its planned sections');
    }

    track.groups.forEach(function (group) {
      const milestone = html.slice(html.indexOf('data-group-toggle="' + group.id + '"'));
      assert.ok(milestone.indexOf('<span class="sidebar-count">' + group.sections.length + '</span>') !== -1,
        group.id + ' should count ' + group.sections.length + ' sections');
    });
  });
});

test('sidebar: every track in the syllabus has a row, built or not', function () {
  const html = SidebarView.markup(Curriculum, progress, []);
  const tracks = Curriculum.tracks();

  assert.ok(tracks.length >= 10, 'the syllabus has all its tracks, got ' + tracks.length);
  assert.strictEqual(tracks[0].title, 'How to use this site', 'the guide comes first');

  const planned = tracks.filter(function (track) { return Curriculum.builtCount(track) === 0; });
  assert.ok(planned.length > 0, 'some tracks are still unbuilt');

  planned.forEach(function (track) {
    assert.ok(html.indexOf('data-track-toggle="' + track.id + '"') !== -1, track.id + ' is listed');
    assert.ok(html.indexOf('class="sidebar-track planned" data-track="' + track.id + '"') !== -1 ||
      html.indexOf('class="sidebar-track open planned" data-track="' + track.id + '"') !== -1,
      track.id + ' is marked as planned');
  });
});

test('sidebar: planned milestones are listed, counted and not links', function () {
  const tracks = Curriculum.tracks();
  const withPlan = tracks.filter(function (track) { return (track.planned || []).length; });
  assert.ok(withPlan.length > 0, 'the roadmap has planned milestones');

  const html = SidebarView.markup(Curriculum, progress, [withPlan[0].id]);
  const body = html.slice(html.indexOf('data-track-toggle="' + withPlan[0].id + '"'));

  withPlan[0].planned.forEach(function (milestone) {
    assert.ok(body.indexOf(milestone.id + ' · ' + milestone.title) !== -1, milestone.id + ' is listed');
    assert.ok(body.indexOf('data-group="' + milestone.id + '"') !== -1, milestone.id + ' has a row');
  });

  assert.strictEqual(html.indexOf('data-group-toggle="' + withPlan[0].planned[0].id + '"'), -1,
    'a planned milestone has nothing to open');
  assert.strictEqual(html.indexOf('data-nav="' + withPlan[0].planned[0].id + '"'), -1,
    'and is not a navigation target');
});

test('sidebar: built and planned sections add up to the published total', function () {
  const total = Curriculum.tracks().reduce(function (sum, track) {
    return sum + Curriculum.builtCount(track) + Curriculum.plannedCount(track);
  }, 0);

  assert.strictEqual(total, 634, 'the roadmap promises 634 sections');

  /* The built count is not hard-coded here: it moves every time a milestone
     lands, and a number that has to be edited by hand stops being a check.
     What must hold is that the two ways of counting built sections agree -
     walking the tracks and asking the curriculum directly. */
  const built = Curriculum.tracks().reduce(function (sum, track) {
    return sum + Curriculum.builtCount(track);
  }, 0);
  assert.strictEqual(Curriculum.sections().length, built,
    'every built section belongs to exactly one track');
  assert.ok(built >= 31, 'sections are never removed, only added');
});

test('sidebar: milestones are collapsed too, so an open track shows categories', function () {
  const tracks = Curriculum.tracks();
  const multi = tracks.filter(function (track) { return track.groups.length > 1; })[0];

  const trackOnly = SidebarView.markup(Curriculum, progress, [multi.id]);
  assert.strictEqual(countMatches(trackOnly, /class="sidebar-milestone-body" hidden/g),
    tracks.reduce(function (total, track) { return total + track.groups.length; }, 0),
    'opening a track opens no milestone by itself');

  const withGroup = SidebarView.markup(Curriculum, progress, [multi.id, multi.groups[0].id]);
  assert.ok(withGroup.indexOf('class="sidebar-milestone open"') !== -1, 'the open milestone is marked');
  assert.strictEqual(countMatches(withGroup, /class="sidebar-milestone-body" hidden/g),
    tracks.reduce(function (total, track) { return total + track.groups.length; }, 0) - 1);
});

test('sidebar: pathOf finds the track and milestone a section belongs to', function () {
  Curriculum.tracks().forEach(function (track) {
    track.groups.forEach(function (group) {
      group.sections.forEach(function (section) {
        assert.strictEqual(SidebarView.pathOf(Curriculum, section.id).track, track.id, section.id);
      });
    });
  });

  assert.strictEqual(SidebarView.pathOf(Curriculum, 'no-such-section'), null);
});

test('sidebar: search results are a flat list with no track chrome', function () {
  const matches = Curriculum.search('hash');
  const html = SidebarView.resultsMarkup(matches);

  assert.ok(matches.length > 0, 'the curriculum has hashing sections to find');
  assert.strictEqual(countMatches(html, /data-track-toggle/g), 0, 'no toggles in results');
  assert.strictEqual(countMatches(html, /class="sidebar-item"/g), matches.length);
  assert.strictEqual(SidebarView.resultsMarkup([]), '<div class="sidebar-note">no matches</div>');
});

test('sidebar: milestone labels appear inside a track, not at the top level', function () {
  const tracks = Curriculum.tracks();
  const multi = tracks.filter(function (track) { return track.groups.length > 1; });
  assert.ok(multi.length > 0, 'at least one track has several milestones');

  const html = SidebarView.markup(Curriculum, progress, [multi[0].id]);
  const body = html.slice(html.indexOf('data-track-toggle="' + multi[0].id + '"'));

  multi[0].groups.forEach(function (group) {
    assert.ok(body.indexOf(group.id + ' · ' + group.title) !== -1,
      group.id + ' is labelled inside the track body');
  });
});
