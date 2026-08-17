/**
 * Section: Augmented trees.
 *
 * One tree, three fields, three structures. Every answer the demo gives is
 * checked against a brute-force scan of the same data and the disagreement, if
 * there ever is one, is shown rather than hidden — an augmentation that is
 * subtly wrong still returns plausible answers, which is the failure mode this
 * section is really about.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'augmented-trees';
  const DRAW_LIMIT = 31;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'An augmented tree is an ordinary balanced tree with an extra field on each node, maintained ' +
          'through every rotation. The rule for what can be augmented is exactly one sentence: the ' +
          'field must be computable from the node itself and the same field on its two children.',
        'That rule is not a guideline, it is the whole theory. A field that satisfies it can be ' +
          'restored in constant time whenever a node\'s children change, so a rotation costs the same ' +
          'as before. A field that needs to look further down cannot be repaired without walking the ' +
          'subtree, and the structure collapses to linear time.',
        'Three fields give three classic structures. Subtree size gives rank and select, so the tree ' +
          'becomes an order-statistic structure. Maximum endpoint gives interval stabbing, and the ' +
          'field is what lets a query skip whole subtrees. Subtree sum gives range sums in ' +
          'logarithmic time rather than proportional to the range.'
      ],
      demo: { title: 'Interactive demo — one tree, three fields', markup: root.AugmentedTreesTemplate.render() },
      diagram: {
        title: 'Diagram — the augmentation rule',
        caption: 'Everything a node needs is on the node and its two children. That is what survives a rotation.',
        definition: [
          'flowchart TB',
          '    N["node<br/>size = 1 + size(L) + size(R)<br/>sum = value + sum(L) + sum(R)<br/>maxEnd = max(end, maxEnd(L), maxEnd(R))"]',
          '    N --> L["left subtree<br/>its own size, sum, maxEnd"]',
          '    N --> R["right subtree<br/>its own size, sum, maxEnd"]',
          '    ROT["after a rotation:<br/>recompute the lower node,<br/>then the upper one"] --> N'
        ].join('\n')
      },
      insight: 'The augmentation rule — the field must be computable from the node and its children — ' +
        'is the whole theory; everything else is bookkeeping on rotation. It is also the test to ' +
        'apply before designing one: "the median of my subtree" fails it, "the size of my subtree" ' +
        'passes, and that single question decides whether the idea is O(log n) or O(n).'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AugmentedTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /** One tree carrying all three fields, plus the raw data for brute force. */
  function build(values) {
    const tree = root.AugmentedTree.create({ fields: ['size', 'sum', 'maxEnd'] });
    const rng = root.Random.seeded(values['aug-seed']);
    const intervals = new Map();

    for (let i = 0; i < values['aug-count']; i += 1) {
      const start = rng.int(values['aug-count'] * 5);
      const end = start + rng.int(50);
      tree.insert(start, start, end);
      intervals.set(start, end);
    }
    return { tree: tree, intervals: intervals };
  }

  function answerFor(mode, built, query) {
    const tree = built.tree;
    const starts = Array.from(built.intervals.keys()).sort(function (a, b) { return a - b; });
    tree.resetStats();

    if (mode === 'size') {
      const value = tree.select(Math.min(query, starts.length));
      return {
        value: value,
        brute: starts[Math.min(query, starts.length) - 1],
        label: 'select(' + Math.min(query, starts.length) + ')',
        scan: starts.length
      };
    }
    if (mode === 'maxEnd') {
      const hits = tree.stab(query).map(function (row) { return row.start; }).sort(function (a, b) { return a - b; });
      const brute = starts.filter(function (start) {
        return start <= query && query <= built.intervals.get(start);
      });
      return {
        value: hits.length + ' intervals',
        brute: brute.length + ' intervals',
        label: 'stab(' + query + ')',
        scan: starts.length,
        agree: hits.join(',') === brute.join(',')
      };
    }

    const hi = query + Math.max(10, Math.floor(built.intervals.size / 20));
    const total = tree.rangeSum(query, hi);
    const brute = starts.filter(function (start) { return start >= query && start <= hi; })
      .reduce(function (sum, start) { return sum + start; }, 0);
    return {
      value: root.Format.exact(total),
      brute: root.Format.exact(brute),
      label: 'rangeSum(' + query + ', ' + hi + ')',
      scan: starts.length
    };
  }

  function update(app) {
    const values = panel.values();
    const built = build(values);
    const answer = answerFor(values['aug-mode'], built, values['aug-query']);
    const stats = built.tree.stats();
    const agrees = answer.agree === undefined
      ? String(answer.value) === String(answer.brute)
      : answer.agree;

    root.MetricGrid.update({
      'aug-answer': { value: String(answer.value), note: answer.label },
      'aug-check': {
        value: agrees ? 'yes' : 'NO',
        note: agrees ? 'the scan returns the same answer' : 'the scan says ' + answer.brute
      },
      'aug-visits': {
        value: root.Format.exact(stats.nodeVisits),
        note: 'out of ' + root.Format.exact(built.tree.size()) + ' keys, height ' + built.tree.height()
      },
      'aug-pruned': {
        value: root.Format.exact(stats.prunedSubtrees),
        note: stats.prunedSubtrees
          ? 'subtrees answered or rejected without descending'
          : 'this query descends one path, so there is nothing to prune'
      }
    });

    paintTable(built, values);
    paintRule();
    draw(app, built);
  }

  function paintTable(built, values) {
    const rows = [
      { field: 'size', how: '1 + size(left) + size(right)', query: 'select(k) and rank(key)' },
      { field: 'maxEnd', how: 'max(end, maxEnd(left), maxEnd(right))', query: 'stab(point)' },
      { field: 'sum', how: 'value + sum(left) + sum(right)', query: 'rangeSum(lo, hi)' }
    ].map(function (row) {
      const answer = answerFor(row.field, built, values['aug-query']);
      return '<tr><td class="mono">' + row.field + '</td>' +
        '<td class="mono">' + row.how + '</td>' +
        '<td class="mono">' + row.query + '</td>' +
        '<td class="mono">' + root.Format.exact(built.tree.stats().nodeVisits) + '</td>' +
        '<td class="mono">' + root.Format.exact(answer.scan) + '</td></tr>';
    }).join('');

    root.jQuery('#aug-table tbody').html(rows);
    root.jQuery('#aug-table-note').text('All three fields are maintained on the same tree at the same ' +
      'time, because they all satisfy the rule. The last column is what a scan of the same data would ' +
      'have to touch.');
  }

  function paintRule() {
    const rows = [
      { field: 'subtree size', ok: true, why: 'yes — 1 + the two children sizes' },
      { field: 'subtree sum', ok: true, why: 'yes — the value plus the two children sums' },
      { field: 'subtree max or min', ok: true, why: 'yes — the node against the two children' },
      { field: 'subtree height', ok: true, why: 'yes — this is what AVL already stores' },
      { field: 'subtree median', ok: false, why: 'no — the median of a union is not a function of the two medians' },
      { field: 'k-th smallest in subtree', ok: false, why: 'no — but size gives it by descending instead' },
      { field: 'number of distinct values', ok: false, why: 'no — the two children can overlap and the node cannot tell' }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.field + '</td>' +
        '<td class="mono">' + (row.ok ? 'yes' : 'no') + '</td>' +
        '<td class="note">' + row.why + '</td></tr>';
    }).join('');

    root.jQuery('#aug-rule tbody').html(rows);
  }

  function draw(app, built) {
    const small = root.AugmentedTree.create({ fields: ['size'] });
    const rng = root.Random.seeded(2);
    root.TreeLab.shuffle(Array.from({ length: DRAW_LIMIT }, function (_, i) { return i + 1; }), rng)
      .forEach(function (key) { small.insert(key, key); });

    root.jQuery('#aug-tree-note').text('A ' + DRAW_LIMIT + '-key tree with the subtree size on every ' +
      'node. select(k) descends by comparing k against the left size — no scanning, no counting. The ' +
      'demo above runs on the full ' + root.Format.exact(built.tree.size()) + '-key tree.');

    chart = root.TreeView.render(root.jQuery('#aug-tree')[0], {
      lazyLib: app.lazyLib,
      height: 250,
      snapshot: small.snapshot({ maxDepth: 12 }),
      summary: function () {
        return 'An order-statistic tree of ' + DRAW_LIMIT + ' keys, each node annotated with the ' +
          'size of its subtree.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
