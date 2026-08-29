/**
 * HomeView - the curriculum map.
 *
 * Rendered from the same curriculum object as the sidebar, and coloured by
 * progress state. The map doubles as a self-audit: the cells you cannot
 * explain are your syllabus.
 *
 * Tracks that are planned and not built are on the map too, with their
 * milestones and section counts. A map that showed only finished work would
 * be the wrong map to plan a study route from.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HomeView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  /* The notation decoder is the one affordance a reader without a maths
     background most needs, and a dotted underline does not announce itself. So
     the map says what it is, and says it in real chips rather than describing
     them: the first Θ a learner meets is one they can hover here, on the page
     they land on, rather than one buried inside an argument they are also
     trying to follow. */
  function decoderNote() {
    const mark = scope.NotationMarkup.createAnnotator({});
    return '<p>' + mark.annotate(
      'You do not need a maths background to read any of it. Every symbol is ' +
      'underlined the first time it appears — Θ(n log n), ⌈x⌉, Σ, ∈, iff — and ' +
      'hovering it, tapping it or tabbing to it says how to pronounce it and what ' +
      'it does. Where a section states something formally, the line directly ' +
      'underneath restates it as a sentence you could say out loud.') + '</p>';
  }

  function intro() {
    return '<div class="section-orientation">' +
      '<p>Every section here is the same five things: a short orientation, an interactive demo of ' +
      'the mechanism, an editable code lab with graded exercises, concepts and worked examples with ' +
      'real arithmetic, and a reference block with the invariants, costs, failure modes and sources.</p>' +
      decoderNote() +
      '<p>Nothing states a cost it does not measure. Where a real system cannot be reproduced in a ' +
      'browser, the section models it, says so, and states what the model leaves out.</p>' +
      '</div>';
  }

  function statusChip(status) {
    const label = { unvisited: 'not started', visited: 'opened', done: 'labs passed' }[status] || status;
    return '<span class="chip">' + esc(label) + '</span>';
  }

  function cell(section, progress) {
    const status = progress.statusOf(section.id);
    return '<a class="concept" href="#' + section.id + '" style="text-decoration:none;display:block">' +
      '<div class="term">' + esc(section.title) + '</div>' +
      '<div class="plain">' + esc(section.summary || '') + '</div>' +
      statusChip(status) +
      '</a>';
  }

  function groupCard(groupNode, progress) {
    return '<section class="section-block">' +
      '<h3>' + esc(groupNode.id + ' · ' + groupNode.title) + '</h3>' +
      (groupNode.summary ? '<p class="note" style="margin-bottom:.5rem">' + esc(groupNode.summary) + '</p>' : '') +
      '<div class="concept-grid">' +
      groupNode.sections.map(function (section) { return cell(section, progress); }).join('') +
      '</div></section>';
  }

  function progressSummary(progress, curriculum) {
    const summary = progress.summary();
    const built = curriculum.teachingSections().length;
    const planned = curriculum.tracks().reduce(function (total, trackNode) {
      return total + curriculum.plannedCount(trackNode);
    }, 0);

    return '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:1.25rem">' +
      metric('Teaching sections', String(built), 'built and gradeable today') +
      metric('Syllabus', String(curriculum.sections().length + planned),
        curriculum.sections().length + ' built, ' + planned + ' planned') +
      metric('Tracks', String(curriculum.tracks().length), 'top-level categories') +
      metric('Opened', String(summary.visited + summary.done), 'sections visited') +
      metric('Labs passed', String(summary.labsPassed), 'of ' + summary.labsAttempted + ' attempted') +
      '</div>';
  }

  function plannedCell(milestone) {
    return '<div class="concept">' +
      '<div class="term">' + esc(milestone.id + ' · ' + milestone.title) + '</div>' +
      '<div class="plain">' + milestone.sections + ' sections</div>' +
      '<span class="chip">planned</span>' +
      '</div>';
  }

  function plannedCard(trackNode) {
    if (!(trackNode.planned || []).length) return '';
    return '<section class="section-block">' +
      '<h3>' + esc(trackNode.title) + ' — still to build</h3>' +
      '<div class="concept-grid">' +
      trackNode.planned.map(plannedCell).join('') +
      '</div></section>';
  }

  function trackHeading(trackNode, curriculum) {
    const built = curriculum.builtCount(trackNode);
    const planned = curriculum.plannedCount(trackNode);
    const note = built
      ? built + ' sections built' + (planned ? ', ' + planned + ' planned' : '')
      : planned + ' sections planned';

    return '<h2 class="map-track">' + esc(trackNode.title) + '</h2>' +
      (trackNode.summary ? '<p class="note map-track-note">' + esc(trackNode.summary) + ' · ' + note + '</p>'
        : '<p class="note map-track-note">' + note + '</p>');
  }

  function metric(label, value, note) {
    return '<div class="metric"><span class="metric-label">' + esc(label) + '</span>' +
      '<span class="metric-value">' + esc(value) + '</span>' +
      '<span class="metric-note">' + esc(note) + '</span></div>';
  }

  function markup(options) {
    const curriculum = options.curriculum;
    const progress = options.progress;

    const tracks = curriculum.tracks().map(function (trackNode) {
      return trackHeading(trackNode, curriculum) +
        trackNode.groups.map(function (groupNode) {
          return groupCard(groupNode, progress);
        }).join('') +
        plannedCard(trackNode);
    }).join('');

    return intro() + progressSummary(progress, curriculum) + tracks;
  }

  return { markup: markup };
}));
