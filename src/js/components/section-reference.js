/**
 * Renders the reference block.
 *
 * The parts are fixed and the content test enforces them: summary, intuition,
 * formulation, invariants, complexity, failure modes, in the wild, sources. A
 * section that cannot state its failure modes has not been understood well
 * enough to teach.
 *
 * Every field runs through the notation annotator. The Cost table is the part
 * of this platform a working engineer scans most often and reads least
 * carefully, and it is written almost entirely in symbols - a row saying
 * Θ(n log n) is useless to a reader who cannot say it out loud.
 *
 * The annotator is created per *part* rather than per block. One annotator for
 * the whole reference would spend O on the summary paragraph and leave the
 * cost table - the place the symbol actually needs decoding - bare.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionReference = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* Resolved on use, not on load, exactly as the annotator itself does: it
     lets `node --test` require this renderer and check that the notation is
     actually decoded, rather than that guarantee living only in a browser. */
  function notation() {
    return scope && scope.NotationMarkup ? scope.NotationMarkup
      : require('../utils/notation-markup.js');
  }

  function helpers() {
    return scope && scope.Helpers ? scope.Helpers : require('../utils/helpers.js');
  }

  function icons() {
    return scope && scope.Icons ? scope.Icons : require('../utils/icons.js');
  }

  function esc(value) {
    return helpers().escapeHtml(value);
  }

  function annotator(sectionId) {
    return notation().createAnnotator({ sectionId: sectionId });
  }

  /** Builds one part with its own annotator, and drops it when it has no body. */
  function part(title, sectionId, build) {
    const body = build(annotator(sectionId));
    if (!body) return '';
    return '<div class="reference-part"><h4>' + esc(title) + '</h4>' + body + '</div>';
  }

  function paragraph(text, mark) {
    return text ? '<p>' + mark.annotate(text) + '</p>' : '';
  }

  /* The expression asks for every symbol decoded rather than the first, for
     the same reason the concept's formal line does: it *is* the notation, and
     a reader stuck on its third symbol is not helped by the first one being
     the only chip. The term list beneath it is already a definition, so its
     `sym` column is left bare - a chip there would only repeat the meaning
     sitting next to it. */
  function terms(list, mark) {
    if (!list || !list.length) return '';
    return '<ul class="term-list">' + list.map(function (term) {
      return '<li><span class="sym">' + esc(term.sym) + '</span> — ' +
        mark.annotate(term.meaning) + '</li>';
    }).join('') + '</ul>';
  }

  /* The same translation the concepts block gives its formal line: the
     equation as a sentence you could say out loud. 46 of these were written
     and none of them were rendered, which is the worst way to lose content -
     the reader who most needed it never knew it existed. */
  function readAs(text, mark) {
    if (!text) return '';
    return '<p class="reads-as"><strong>In words.</strong> ' + mark.annotate(text) + '</p>';
  }

  function equation(eq, mark) {
    return '<div class="equation">' +
      (eq.label ? '<div class="eq-label">' + mark.annotate(eq.label) + '</div>' : '') +
      mark.annotate(eq.expr, { all: true }) + '</div>' +
      readAs(eq.readAs, mark) +
      terms(eq.terms, mark);
  }

  function equations(formulation, mark) {
    if (!formulation || !formulation.equations) return '';
    return formulation.equations.map(function (eq) {
      return equation(eq, mark);
    }).join('');
  }

  function derivation(formulation, mark) {
    if (!formulation || !formulation.derivation || !formulation.derivation.length) return '';
    return '<ul class="term-list">' + formulation.derivation.map(function (line) {
      return '<li>' + mark.annotate(line) + '</li>';
    }).join('') + '</ul>';
  }

  function invariants(list, mark) {
    if (!list || !list.length) return '';
    return list.map(function (item) {
      return '<div class="fail-mode">' +
        '<div class="symptom">' + mark.annotate(item.name) + '</div>' +
        '<div class="cause">Why: ' + mark.annotate(item.why) + '</div>' +
        '<div class="fix">Breaks: ' + mark.annotate(item.breaks) + '</div>' +
        '</div>';
    }).join('');
  }

  function complexity(rows, mark) {
    if (!rows || !rows.length) return '';
    const body = rows.map(function (row) {
      return '<tr><td>' + mark.annotate(row.operation) + '</td>' +
        '<td class="mono">' + mark.annotate(row.average) + '</td>' +
        '<td class="mono">' + mark.annotate(row.worst) + '</td>' +
        '<td>' + mark.annotate(row.note || '') + '</td></tr>';
    }).join('');
    return '<table class="ref-table"><thead><tr><th>Operation</th><th>Typical</th><th>Worst</th>' +
      '<th>Note</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function failures(list, mark) {
    if (!list || !list.length) return '';
    return list.map(function (item) {
      return '<div class="fail-mode">' +
        '<div class="symptom">' + mark.annotate(item.symptom) + '</div>' +
        '<div class="cause">Cause: ' + mark.annotate(item.cause) + '</div>' +
        '<div class="fix">Fix: ' + mark.annotate(item.fix) + '</div>' +
        '</div>';
    }).join('');
  }

  /* Two shapes are in the content and both are legitimate. Most entries name
     a system and say what it does with the idea; 122 sections instead write
     one sentence that already names the system inside it. Reading only the
     first shape rendered those as `<li><span class="sym"></span> — </li>` -
     488 empty bullets, and "In the wild" is the part a working engineer
     actually came for. */
  function wildEntry(item, mark) {
    if (typeof item === 'string') return '<li>' + mark.annotate(item) + '</li>';
    return '<li><span class="sym">' + esc(item.system) + '</span> — ' +
      mark.annotate(item.how) + '</li>';
  }

  function inTheWild(list, mark) {
    if (!list || !list.length) return '';
    return '<ul class="term-list">' +
      list.map(function (item) { return wildEntry(item, mark); }).join('') +
      '</ul>';
  }

  /* A source is a recommendation, and a recommendation needs three things a
     bare title does not carry: who wrote it, where in it to look, and what it
     is good for. 121 authors and 623 notes were written and none rendered,
     leaving a reader facing a list of six textbooks with no way to choose. */
  /* Bracketed rather than run on after the title. Some titles already carry
     their authors - "Hopcroft, Motwani and Ullman — Introduction to Automata
     Theory" - so a bare space between title and author produces a sentence
     with no seam in it, and the muted colour is not a separator you can hear. */
  function locator(item, mark) {
    const parts = [item.author, item.where].filter(Boolean);
    if (!parts.length) return '';
    return ' <span class="where">(' +
      parts.map(function (text) { return mark.annotate(text); }).join(', ') +
      ')</span>';
  }

  function sources(list, mark) {
    if (!list || !list.length) return '';
    return '<ul class="source-list">' + list.map(function (item) {
      return '<li>' + mark.annotate(item.title) + locator(item, mark) +
        (item.note ? ' <span class="source-note">— ' + mark.annotate(item.note) + '</span>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function markup(entry, options) {
    if (!entry) return '';
    const id = options && options.sectionId;
    return '<section class="section-block">' +
      icons().heading('reference', 'Reference') +
      '<div class="reference-block">' +
      part('Summary', id, function (m) { return paragraph(entry.summary, m); }) +
      part('Intuition', id, function (m) { return paragraph(entry.intuition, m); }) +
      part('Formulation', id, function (m) {
        return equations(entry.formulation, m) + derivation(entry.formulation, m);
      }) +
      part('Invariants', id, function (m) { return invariants(entry.invariants, m); }) +
      part('Cost', id, function (m) { return complexity(entry.complexity, m); }) +
      part('Failure modes', id, function (m) { return failures(entry.failureModes, m); }) +
      part('In the wild', id, function (m) { return inTheWild(entry.inTheWild, m); }) +
      part('Sources', id, function (m) { return sources(entry.sources, m); }) +
      '</div></section>';
  }

  return { markup: markup };
}));
