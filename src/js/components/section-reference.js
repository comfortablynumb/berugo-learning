/**
 * Renders the reference block.
 *
 * The parts are fixed and the content test enforces them: summary, intuition,
 * formulation, invariants, complexity, failure modes, in the wild, sources. A
 * section that cannot state its failure modes has not been understood well
 * enough to teach.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionReference = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  function part(title, body) {
    if (!body) return '';
    return '<div class="reference-part"><h4>' + esc(title) + '</h4>' + body + '</div>';
  }

  function equations(formulation) {
    if (!formulation || !formulation.equations) return '';
    return formulation.equations.map(function (eq) {
      const terms = (eq.terms || []).map(function (term) {
        return '<li><span class="sym">' + esc(term.sym) + '</span> — ' + esc(term.meaning) + '</li>';
      }).join('');
      return '<div class="equation">' +
        (eq.label ? '<div class="eq-label">' + esc(eq.label) + '</div>' : '') +
        esc(eq.expr) + '</div>' +
        (terms ? '<ul class="term-list">' + terms + '</ul>' : '');
    }).join('');
  }

  function derivation(formulation) {
    if (!formulation || !formulation.derivation || !formulation.derivation.length) return '';
    return '<ul class="term-list">' + formulation.derivation.map(function (line) {
      return '<li>' + esc(line) + '</li>';
    }).join('') + '</ul>';
  }

  function invariants(list) {
    if (!list || !list.length) return '';
    return list.map(function (item) {
      return '<div class="fail-mode">' +
        '<div class="symptom">' + esc(item.name) + '</div>' +
        '<div class="cause">Why: ' + esc(item.why) + '</div>' +
        '<div class="fix">Breaks: ' + esc(item.breaks) + '</div>' +
        '</div>';
    }).join('');
  }

  function complexity(rows) {
    if (!rows || !rows.length) return '';
    const body = rows.map(function (row) {
      return '<tr><td>' + esc(row.operation) + '</td>' +
        '<td class="mono">' + esc(row.average) + '</td>' +
        '<td class="mono">' + esc(row.worst) + '</td>' +
        '<td>' + esc(row.note || '') + '</td></tr>';
    }).join('');
    return '<table class="ref-table"><thead><tr><th>Operation</th><th>Typical</th><th>Worst</th>' +
      '<th>Note</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function failures(list) {
    if (!list || !list.length) return '';
    return list.map(function (item) {
      return '<div class="fail-mode">' +
        '<div class="symptom">' + esc(item.symptom) + '</div>' +
        '<div class="cause">Cause: ' + esc(item.cause) + '</div>' +
        '<div class="fix">Fix: ' + esc(item.fix) + '</div>' +
        '</div>';
    }).join('');
  }

  function inTheWild(list) {
    if (!list || !list.length) return '';
    return '<ul class="term-list">' + list.map(function (item) {
      return '<li><span class="sym">' + esc(item.system) + '</span> — ' + esc(item.how) + '</li>';
    }).join('') + '</ul>';
  }

  function sources(list) {
    if (!list || !list.length) return '';
    return '<ul class="source-list">' + list.map(function (item) {
      return '<li>' + esc(item.title) + ' <span class="where">' + esc(item.where || '') + '</span></li>';
    }).join('') + '</ul>';
  }

  function markup(entry) {
    if (!entry) return '';
    return '<section class="section-block">' +
      '<h3>Reference</h3>' +
      '<div class="reference-block">' +
      part('Summary', entry.summary ? '<p>' + esc(entry.summary) + '</p>' : '') +
      part('Intuition', entry.intuition ? '<p>' + esc(entry.intuition) + '</p>' : '') +
      part('Formulation', equations(entry.formulation) + derivation(entry.formulation)) +
      part('Invariants', invariants(entry.invariants)) +
      part('Cost', complexity(entry.complexity)) +
      part('Failure modes', failures(entry.failureModes)) +
      part('In the wild', inTheWild(entry.inTheWild)) +
      part('Sources', sources(entry.sources)) +
      '</div></section>';
  }

  return { markup: markup };
}));
