/**
 * The implication graph at a SAT conflict, as a mermaid definition.
 *
 * This is a renderer even though it emits text rather than SVG, and it lives
 * out here rather than in the section for one reason: a diagram built at run
 * time is not covered by the guard that parses every section's static
 * definition, so a syntax error in it would appear only as an error block in
 * the browser. As a module it can be handed to the real parser in a test.
 *
 * The graph shown is the CONE behind the conflict — start from the falsified
 * clause and walk the reasons backwards — because the trail at a deep conflict
 * is hundreds of assignments and all but a handful of them are irrelevant to
 * why this clause has no satisfied literal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ImplicationGraph = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LIMIT = 20;

  function nodeId(literal) {
    return 'n' + Math.abs(literal) + (literal > 0 ? 'p' : 'q');
  }

  function showLiteral(literal) {
    return (literal > 0 ? '' : 'not ') + 'x' + Math.abs(literal);
  }

  function showClause(literals) {
    return '(' + literals.map(showLiteral).join(' or ') + ')';
  }

  function nodeLine(row, inCut) {
    const text = 'x' + Math.abs(row.literal) + ' = ' + (row.literal > 0 ? 'true' : 'false') +
      '<br/>level ' + row.level + (row.decision ? ' · decision' : '');

    if (inCut) return '  ' + nodeId(row.literal) + '(["' + text + '<br/>in the learned clause"])';
    return '  ' + nodeId(row.literal) + '["' + text + '"]';
  }

  /**
   * Every assignment the conflict clause depends on, nearest first. The
   * conflict clause is falsified, so for each of its literals the trail holds
   * the NEGATION - which is the assignment that helped cause the conflict.
   */
  function cone(snapshot, limit) {
    const byLiteral = {};
    const seen = {};
    const kept = [];
    const queue = snapshot.conflict.map(function (literal) { return -literal; });

    snapshot.trail.forEach(function (row) { byLiteral[row.literal] = row; });
    while (queue.length && kept.length < (limit || LIMIT)) {
      const literal = queue.shift();

      if (seen[literal] || !byLiteral[literal]) continue;
      seen[literal] = true;
      kept.push(byLiteral[literal]);
      (byLiteral[literal].reason || []).forEach(function (other) {
        if (other !== literal) queue.push(-other);
      });
    }
    return kept;
  }

  function definition(snapshot, options) {
    const settings = options || {};
    const rows = cone(snapshot, settings.limit);
    const present = {};
    const cut = {};
    const lines = ['flowchart LR'];

    rows.forEach(function (row) { present[row.literal] = true; });
    snapshot.learned.forEach(function (literal) { cut[-literal] = true; });
    rows.forEach(function (row) { lines.push(nodeLine(row, cut[row.literal])); });
    rows.forEach(function (row) {
      (row.reason || []).forEach(function (other) {
        if (other === row.literal || !present[-other]) return;
        lines.push('  ' + nodeId(-other) + ' --> ' + nodeId(row.literal));
      });
    });
    snapshot.conflict.forEach(function (literal) {
      if (!present[-literal]) return;
      lines.push('  ' + nodeId(-literal) + ' --> K{{"conflict"}}');
    });
    return lines.join('\n');
  }

  return { definition: definition, cone: cone, nodeId: nodeId,
    showClause: showClause, showLiteral: showLiteral, LIMIT: LIMIT };
}));
