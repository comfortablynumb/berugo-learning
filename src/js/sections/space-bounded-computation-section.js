/**
 * Section: space-bounded computation.
 *
 * The measurement is a memory meter that counts bits as they are actually
 * taken and released, so "log space" is a number rather than a label. BFS holds
 * one vertex index per visited vertex and never releases them; Savitch holds
 * three per recursion level and releases each frame on the way out. At a
 * thousand vertices that is 10 240 bits against a bound of 300.
 *
 * The honest caveat is in the demo: Savitch's time makes it unrunnable at that
 * size, and the section says so. A theoretical result whose constant hides its
 * cost is exactly the kind of thing this course refuses to quote without the
 * other column.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'space-bounded-computation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — Savitch’s recursive midpoint search',
      caption: 'Can you get from s to t in at most 2^k steps? Guess a midpoint m, and ask the ' +
        'same question twice with half the budget. The recursion is k levels deep, and each ' +
        'level holds three vertex names — s, t and m — and nothing else. No visited set, no ' +
        'queue, no memo table. The cost is that each level tries EVERY vertex as the midpoint, ' +
        'and both halves are re-explored from scratch every time, so the work is n^log n rather ' +
        'than linear. That is the trade in its purest form: the algorithm refuses to remember ' +
        'anything, and pays for every fact it needs by deriving it again.',
      definition: [
        'flowchart TD',
        '    A["reach(s, t, budget)"] --> B{"s = t?"}',
        '    B -->|yes| C[true]',
        '    B -->|no| D{"budget = 0?"}',
        '    D -->|yes| E["is there an edge s to t?"]',
        '    D -->|no| F["for every vertex m"]',
        '    F --> G["reach(s, m, budget − 1)"]',
        '    G -->|true| H["reach(m, t, budget − 1)"]',
        '    H -->|true| C',
        '    H -->|false| F',
        '    G -->|false| F',
        '    F -->|exhausted| I[false]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Space can be reused and time cannot, and every difference between the two families of ' +
        'classes comes from that.** A cell of memory freed is as good as new; a second spent is ' +
        'gone. So a space-bounded machine can run for an enormous time in a small amount of ' +
        'memory, and the space classes end up behaving quite differently from the time ones.',
      '**SPACE(f) counts the WORK tape only, not the input.** Otherwise every class would ' +
        'contain at least linear space and sublinear classes would be empty. The input is ' +
        'read-only and free; the scratch space is what is charged for. That convention is what ' +
        'makes L — logarithmic space — a meaningful class rather than an empty one.',
      '**L is a constant number of pointers into the input, and nothing else.** Logarithmic ' +
        'space is exactly enough to hold a fixed number of indices, so an L algorithm is one ' +
        'that walks the input with a handful of cursors. Reingold showed in 2004 that UNDIRECTED ' +
        'reachability fits, which was a genuine surprise and does not extend to directed graphs.',
      '**NL is nondeterministic log space, and directed reachability is complete for it.** Guess ' +
        'the path one vertex at a time, holding only the current vertex and a step counter. ' +
        'Every NL problem reduces to that one, which is why reachability is the problem this ' +
        'section is built around.',
      '**Savitch’s theorem says NSPACE(f) is inside SPACE(f²), so nondeterminism buys almost ' +
        'nothing in space.** Compare that to time, where the same question is P versus NP and ' +
        'has been open for fifty years. The proof is the midpoint recursion the demo runs, and ' +
        'the squaring is the recursion depth times the frame size.',
      '**PSPACE = NPSPACE follows immediately, and that is a striking asymmetry.** For ' +
        'polynomial SPACE, determinism and nondeterminism coincide — squaring a polynomial is a ' +
        'polynomial. For polynomial TIME, squaring an exponential is not an exponential, and the ' +
        'same argument gives nothing.',
      '**NL = coNL, which nobody expected.** Immerman and Szelepcsényi showed independently in ' +
        '1987 that nondeterministic space classes are closed under complement, by counting ' +
        'reachable vertices inductively without storing them. The analogous question for time — ' +
        'whether NP = coNP — is wide open and believed false.',
      '**The practical reading is that recomputation is a legitimate alternative to caching.** ' +
        'Streaming systems, checkpointed neural network training and log-structured databases ' +
        'all make this trade deliberately: keep less, derive more. Savitch is the extreme ' +
        'version, and the demo measures both sides so the trade is a number rather than a ' +
        'preference.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the same question, with the memory actually metered',
        markup: root.SpaceBoundedTemplate.render()
      },
      diagram: diagram(),
      insight: '**Space can be reused and time cannot, which is why space classes behave so ' +
        'differently; the practical version is that recomputation is a legitimate alternative ' +
        'to caching, and streaming systems make that trade constantly.** Once you see the trade ' +
        'as a dial rather than a mistake, several familiar designs line up on it. Gradient ' +
        'checkpointing in neural network training stores every k-th activation and recomputes ' +
        'the rest, trading roughly a third more compute for a large constant factor in memory. ' +
        'A log-structured database keeps the log and rebuilds indexes rather than keeping both ' +
        'durable. A stream processor holds a window instead of the history. None of those is a ' +
        'compromise forced by hardware; each is a point chosen on the same curve Savitch sits ' +
        'at the far end of, and knowing the curve exists is what turns "we ran out of memory" ' +
        'into a design question.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SpaceBoundedTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function graphFor(name, size) {
    return root.SpaceBounded.graphs()[name](Number(size));
  }

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const graph = graphFor(parts[0], parts[1]);

    return { graph: graph,
      result: root.SpaceBounded.compare(graph, 0, Number(parts[1]) - 1) };
  });

  /**
   * How the two curves diverge. BFS is measured, because it is cheap at every
   * size; Savitch is the BOUND rather than a measurement past the sizes where
   * it actually runs, and the note says so — quoting a projected number as a
   * measurement would be the exact dishonesty this course is against.
   */
  const growthFor = root.Helpers.memoise(function (limit) {
    const sizes = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096]
      .filter(function (n) { return n <= Number(limit); });

    return sizes.map(function (n) {
      const graph = root.SpaceBounded.path(n);
      const bfs = root.SpaceBounded.breadthFirst(graph, 0, n - 1);
      const bits = root.SpaceBounded.indexBits(n);
      const levels = Math.ceil(Math.log2(Math.max(2, n)));
      const bound = 3 * bits * levels;

      return { n: n, bfs: bfs.peakBits, bound: bound, ratio: bfs.peakBits / bound };
    });
  });

  function update() {
    const values = panel.values();
    const state = compareFor(values['spa-graph'] + '\n' + values['spa-size']);

    paintMetrics(state);
    paintCompare(state);
    paintGrowth(values['spa-projected']);
    paintRecursion(values['spa-size']);
    paintClasses();
    paintPractice();
  }

  function paintMetrics(state) {
    const bfs = state.result.rows[0];
    const savitch = state.result.rows[1];

    root.MetricGrid.update({
      'spa-agree': { value: state.result.agree ? 'yes' : 'NO',
        note: state.result.agree
          ? 'both say ' + (bfs.reachable ? 'reachable' : 'not reachable') +
            ', which is the correctness check'
          : 'the two algorithms disagree, which is a bug rather than a trade' },
      'spa-bfs': { value: root.Format.exact(bfs.peakBits) + ' bits',
        note: root.Format.exact(bfs.visited) +
          ' vertex indices held at once, and never released' },
      'spa-savitch': { value: root.Format.exact(savitch.peakBits) + ' bits',
        note: root.Format.exact(savitch.levels) + ' recursion levels, three indices each, each ' +
          'frame released on the way out' },
      'spa-trade': { value: root.Format.fixed(state.result.timeRatio, 1) + '×',
        note: root.Format.exact(savitch.steps) + ' Savitch calls against ' +
          root.Format.exact(bfs.steps) + ' BFS steps — the time paid for the space' }
    });
  }

  function paintCompare(state) {
    root.jQuery('#spa-compare tbody').html(state.result.rows.map(function (row) {
      return '<tr><td class="mono">' + row.algorithm + '</td><td class="mono">' +
        (row.reachable ? 'yes' : 'no') + (row.overflow ? ' (capped)' : '') +
        '</td><td class="mono">' + root.Format.exact(row.steps) + '</td><td class="mono">' +
        root.Format.exact(row.peakBits) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('spa-compare-note',
      'Both columns on the right move in opposite directions, and that is the section. The ' +
      'memory figure is METERED rather than asserted: every allocation is registered as it is ' +
      'taken and deregistered as it is released, so the peak is the high-water mark of what was ' +
      'held at once. A "log-space" implementation with an accidental memo table would show up ' +
      'here immediately as a linear curve, which is the point of measuring rather than ' +
      'labelling.');
  }

  function paintGrowth(limit) {
    root.jQuery('#spa-growth tbody').html(growthFor(limit).map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' +
        root.Format.exact(row.bfs) + '</td><td class="mono">' + row.bound +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 2) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('spa-growth-note',
      'The middle column is MEASURED — BFS is cheap at every size, so the meter runs. The third ' +
      'is the Savitch BOUND, three indices times the recursion depth, and it is a bound rather ' +
      'than a measurement because Savitch cannot be run at these sizes: its time is n^log n and ' +
      'the demo above needs thousands of calls on a twelve-vertex graph. That caveat is the ' +
      'honest half of the result. Savitch proves the space is available and does not offer a ' +
      'way to spend it — which is the position a great many theoretical results are in, and the ' +
      'reason to keep the two columns visibly different.');
  }

  function paintRecursion(size) {
    const n = Number(size);
    const levels = Math.ceil(Math.log2(Math.max(2, n)));
    const lines = [];

    for (let k = levels; k >= 0; k -= 1) {
      lines.push('depth ' + (levels - k) + ': reachable in at most 2^' + k + ' = ' +
        Math.pow(2, k) + ' steps?   frame holds 3 indices');
    }
    lines.push('base: is there a single edge?');
    root.jQuery('#spa-recursion').html(lines.map(function (line, i) {
      return root.Helpers.escapeHtml('  '.repeat(i) + line);
    }).join('<br>'));

    root.Helpers.setText('spa-recursion-note',
      'The recursion is ' + levels + ' levels deep for ' + n + ' vertices — logarithmic, ' +
      'because the budget halves each time — and each frame holds three vertex indices costing ' +
      root.SpaceBounded.indexBits(n) + ' bits each. Multiply and you have the whole space ' +
      'bound: three indices times log n levels, which is O(log² n). Nothing else is stored ' +
      'anywhere, and that is the entire content of Savitch\'s theorem.');
  }

  function paintClasses() {
    root.jQuery('#spa-classes tbody').html(root.SpaceBounded.CLASSES.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.definition + '</td><td>' +
        root.Helpers.escapeHtml(row.canonical) + '</td><td>' +
        root.Helpers.escapeHtml(row.note) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('spa-classes-note',
      'The PSPACE row carries the asymmetry worth remembering. Savitch says nondeterminism is ' +
      'worth at most a squaring in space, and squaring a polynomial gives a polynomial — so ' +
      'PSPACE and NPSPACE are the same class, settled. The identical question for time is P ' +
      'versus NP, and squaring an exponential is not an exponential, so the same argument gives ' +
      'nothing at all. One theorem, two questions, and only one of them answered.');
  }

  function paintPractice() {
    const rows = [
      { system: 'Gradient checkpointing', stores: 'every k-th activation',
        derives: 'the rest, by re-running the forward pass',
        why: 'about a third more compute for a large constant factor less memory' },
      { system: 'A log-structured database', stores: 'the write-ahead log',
        derives: 'indexes and the current state, by replay',
        why: 'one durable thing to fsync instead of two' },
      { system: 'A stream processor', stores: 'a bounded window',
        derives: 'aggregates from the window as they are asked for',
        why: 'the history does not fit and never will' },
      { system: 'A build system with content hashing', stores: 'hashes and a cache',
        derives: 'anything not cached, by rebuilding',
        why: 'the cache is a hint; correctness does not depend on it' },
      { system: 'Merkle proofs', stores: 'a root hash',
        derives: 'membership, from a supplied path',
        why: 'the verifier holds 32 bytes and checks a claim about gigabytes' },
      { system: 'A regex engine simulating an NFA', stores: 'the current state set',
        derives: 'the next set per character', why: 'linear time and no backtracking stack' },
      { system: 'Savitch reachability', stores: 'three indices per level',
        derives: 'everything else, every time',
        why: 'the theoretical extreme, and unusable in practice' }
    ];

    root.jQuery('#spa-practice tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.system + '</td><td>' + row.stores + '</td><td>' +
        row.derives + '</td><td>' + row.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('spa-practice-note',
      'Every row is the same dial at a different setting, and the last one is the theoretical ' +
      'limit that shows where the dial ends. What is worth taking from the middle rows is that ' +
      'the trade is usually made for a reason other than memory pressure: the build system ' +
      're-derives because a cache that is only a hint cannot be wrong, and the log-structured ' +
      'database re-derives because having one durable artefact is simpler than keeping two ' +
      'consistent. Space against time is the mechanism; the reason is often correctness.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
