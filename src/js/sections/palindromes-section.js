/**
 * Section: palindromes, Manacher and the palindromic tree.
 *
 * The mirror argument is the Z-window from 15.3 wearing different clothes, and
 * saying so is most of the value: keep the palindrome that reaches furthest
 * right, answer a position inside it from its mirror, and extend only past the
 * edge. Because the edge never moves left, the extensions total at most n.
 *
 * The eertree is the other half and it answers a question Manacher does not:
 * how many DISTINCT palindromic substrings there are. On a string of one
 * repeated character those two counts are n(n+1)/2 and n, which is the
 * clearest possible demonstration that "how many" and "how many different" are
 * separate questions.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'palindromes';
  const LENGTHS = [20, 50, 100, 200, 400, 800];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the mirror inside the current palindrome',
      caption: 'If position i lies inside the palindrome centred at c and reaching to r, then the ' +
        'characters around i mirror the characters around 2c − i, whose radius is already known. When ' +
        'that radius is strictly smaller than the distance to r the answer is exact and free; when it ' +
        'reaches the edge the answer is at least that far and the rest has to be measured.',
      definition: [
        'flowchart LR',
        '    C["centre c, reaching to r"] --> M["mirror of i is 2c − i"]',
        '    M --> S{"radius[mirror] < r − i?"}',
        '    S -->|"yes"| E["radius[i] = radius[mirror]<br/>exact, zero comparisons"]',
        '    S -->|"no"| X["radius[i] = r − i, then extend past r"]',
        '    X --> R["r moves right, and never moves left"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The odd/even problem is what makes palindromes awkward.** `aba` has a centre and `abba` has ' +
        'a gap, so a naive implementation needs two of everything.',
      '**Interleaving a separator** turns every even-length palindrome of the original into an ' +
        'odd-length one of the transformed string. `abc` becomes `#a#b#c#`, at a cost of a factor ' +
        'of two in memory and one duplicate implementation removed.',
      '**Manacher is the Z-window again.** Keep the palindrome that reaches furthest right; a ' +
        'position inside it has a mirror whose radius is already known, so the only work is ' +
        'extending past the right edge.',
      'Because that edge never moves left, the total extension over the whole run is at most `n`. ' +
        'The demo counts the mirror reuses and the extensions separately, because the ratio between ' +
        'them is the algorithm.',
      '**The eertree answers a different question.** Manacher gives every maximal palindrome and ' +
        'therefore the *count* of palindromic substrings. The palindromic tree has one node per ' +
        '*distinct* palindromic substring, and is built online in linear time.',
      'On a string of one repeated character those two numbers are `n(n+1)/2` and `n`, and no amount ' +
        'of squinting at the radius array recovers the second from the first.',
      '**The eertree has two roots**, one of length 0 and one of length −1.',
      'The imaginary node is not a trick to be tidied away. It is what makes "extend this palindrome ' +
        'by one character on each side" work uniformly for the first character of an odd palindrome. ' +
        'Removing it means special-casing every odd length by hand.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the radius array, the growth, and the tree',
        markup: root.PalindromesTemplate.render()
      },
      diagram: diagram(),
      insight: 'The mirror argument transfers and the palindromes mostly do not. Very few production ' +
        'systems care about palindromic substrings. A great many care about "never re-examine what ' +
        'an earlier structure already proved". That is the same amortisation as the Z-window, as ' +
        'the two-pointer sliding window, and as the furthest-reaching path in 15.9\'s diff. If you ' +
        'take one thing from this section, take the shape of the argument rather than the problem it ' +
        'is applied to here.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PalindromesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  function stringOf(values) {
    const typed = String(values['pal-string'] || '').trim();

    return typed.length > 0 ? typed : 'abacabadabacaba';
  }

  const runFor = root.Helpers.memoise(function (text) {
    const report = root.Manacher.emptyReport();
    const run = root.Manacher.radii(text, { report: report, trace: true });
    const list = root.Manacher.palindromes(text, {});

    return { text: text, run: run, report: report, list: list,
      count: root.Manacher.countSubstrings(text),
      tree: root.Manacher.eertree(text, {}),
      truth: root.Manacher.countByBruteForce(text),
      distinctTruth: root.Manacher.distinctByBruteForce(text) };
  });

  function familyString(family, size, seed) {
    if (family === 'repeated') return 'a'.repeat(size);

    if (family === 'distinct') {
      let out = '';

      for (let i = 0; i < size; i += 1) out += String.fromCharCode(33 + (i % 90));
      return out;
    }

    if (family === 'nested') {
      let out = 'a';

      while (out.length < size) out = out + out[0] + out;
      return out.slice(0, size);
    }
    const random = root.Random.seeded(seed);
    let out = '';

    for (let i = 0; i < size; i += 1) out += 'ab'[random.int(2)];
    return out;
  }

  const growthFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return LENGTHS.map(function (size) {
      const text = familyString(parts[0], size, Number(parts[1]));
      const report = root.Manacher.emptyReport();

      root.Manacher.radii(text, { report: report });
      let naive = 0;

      root.Manacher.palindromesByBruteForce(text).forEach(function (entry) {
        naive += entry.length + 1;
      });
      return { size: size, text: text, report: report, naive: naive,
        count: root.Manacher.countSubstrings(text),
        distinct: root.Manacher.eertree(text, {}).distinct };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const state = runFor(stringOf(values));

    paintMetrics(state);
    paintRadii(state);
    paintAlignment(state);
    paintGrowth(growthFor(values['pal-family'] + '|' + values['pal-seed']), app);
    paintTree(state);
  }

  function paintMetrics(state) {
    const longest = state.list.longest;

    root.MetricGrid.update({
      'pal-longest': { value: root.Format.plural(longest.length, 'character'),
        note: longest.length === 0 ? 'no palindrome longer than one character'
          : '"' + state.text.substr(longest.start, longest.length) + '" starting at ' +
            root.Format.exact(longest.start) },
      'pal-reuse': { value: root.Format.exact(state.report.mirrorReuse),
        note: 'of ' + root.Format.exact(state.report.positions) + ' positions; ' +
          root.Format.exact(state.report.extensions) + ' characters were actually compared' },
      'pal-count': { value: root.Format.exact(state.count),
        note: state.count === state.truth ? 'matching a brute-force O(n²) expansion exactly'
          : 'DISAGREES with the brute-force count of ' + root.Format.exact(state.truth) },
      'pal-distinct': { value: root.Format.exact(state.tree.distinct),
        note: state.tree.distinct === state.distinctTruth
          ? 'one eertree node per distinct palindrome, checked exhaustively'
          : 'DISAGREES with the exhaustive count of ' + root.Format.exact(state.distinctTruth) }
    });
  }

  function paintRadii(state) {
    const transformed = state.run.transformed;
    const limit = Math.min(transformed.length, 26);
    const rows = [];

    for (let i = 0; i < limit; i += 1) {
      /* `radii` traces from position 0, unlike `zArray` which starts at 1 -
         indexing this by i-1 shifts every row against its character. */
      const step = state.run.trace[i];

      rows.push({ cells: [String(i), root.AlignmentView.display(transformed[i]),
        String(state.run.radius[i]),
        String(step.reused), String(step.extended),
        '[' + (step.centre - (step.right - step.centre)) + ', ' + step.right + ']'] });
    }
    root.MatrixView.render(root.jQuery('#pal-radii')[0], {
      columns: ['i', 'character', 'radius', 'reused from the mirror', 'characters compared',
        'palindrome in force'],
      rows: rows
    });
    root.jQuery('#pal-radii-note').text('The separator characters are the interleaving: a radius at ' +
      'a separator is an even-length palindrome of the original string and a radius at a real ' +
      'character is an odd-length one, so one array covers both. The "reused" column is what the ' +
      'mirror gave for free — ' + root.Format.exact(state.report.mirrorReuse) + ' of ' +
      root.Format.exact(state.report.positions) + ' positions got something — and the "compared" ' +
      'column is the only work, totalling ' + root.Format.exact(state.report.extensions) +
      ' against a string of ' + root.Format.exact(transformed.length) + ' transformed characters.');
  }

  function paintAlignment(state) {
    const host = root.jQuery('#pal-align')[0];

    if (!host) return;
    const longest = state.list.longest;
    const text = state.text.slice(0, 60);
    const marks = text.split('').map(function (unused, i) {
      if (i < longest.start || i >= longest.start + longest.length) return null;
      return 'match';
    });

    root.AlignmentView.render(host, {
      rows: [
        { label: 'string', characters: text.split(''), marks: marks },
        { label: 'reversed', offset: longest.start,
          characters: state.text.substr(longest.start, longest.length).split('').reverse(),
          marks: new Array(longest.length).fill('window') }
      ],
      caption: 'the longest palindrome, and the same characters reversed underneath it'
    });
    root.jQuery('#pal-align-note').text(longest.length <= 1
      ? 'The longest palindrome here is a single character, which is what "all distinct" means and ' +
        'the case that makes the eertree node count equal the alphabet size.'
      : 'The two rows are identical, which is the definition. Manacher found this run without ever ' +
        'reversing anything: the radius at its centre is ' +
        root.Format.exact(longest.length) + ' in the transformed string, and a radius in the ' +
        'transformed string is a LENGTH in the original — which is the second thing the interleaving ' +
        'buys and the reason nobody divides by two at the end.');
  }

  function paintGrowth(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.size) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.naive) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.naive / Math.max(1, row.report.comparisons), 1) +
          '×</td>' +
        '<td class="mono">' + root.Format.exact(row.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.distinct) + '</td></tr>';
    }).join('');

    root.jQuery('#pal-growth tbody').html(html);
    drawGrowthChart(rows, app);
    const last = rows[rows.length - 1];

    root.jQuery('#pal-growth-note').text('Manacher does ' +
      root.Format.exact(last.report.comparisons) + ' comparisons on a string of ' +
      root.Format.exact(last.size) + ' against ' + root.Format.exact(last.naive) +
      ' for expanding around every centre — ' +
      root.Format.fixed(last.naive / Math.max(1, last.report.comparisons), 1) +
      '×. The last two columns are the pair worth staring at: on the repeated family they are ' +
      'n(n+1)/2 and n, and on the all-distinct family they are n and the alphabet size. "How many ' +
      'palindromic substrings" and "how many different ones" are different questions with answers ' +
      'that differ by a factor of n, and only the eertree answers the second.');
  }

  function drawGrowthChart(rows, app) {
    const host = root.jQuery('#pal-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      logX: true,
      logY: true,
      height: 220,
      series: [
        { label: 'Manacher', points: rows.map(function (row) {
          return { x: row.size, y: Math.max(1, row.report.comparisons) }; }) },
        { label: 'expand around every centre', points: rows.map(function (row) {
          return { x: row.size, y: Math.max(1, row.naive) }; }) }
      ],
      xLabel: 'string length',
      yLabel: 'character comparisons',
      legendHost: root.jQuery('#pal-legend')[0],
      summary: function () { return 'Comparisons against string length, both axes logarithmic.'; }
    });
  }

  function paintTree(state) {
    const nodes = state.tree.nodes;
    const rows = [];

    for (let id = 0; id < Math.min(nodes.length, 14); id += 1) {
      const node = nodes[id];

      rows.push({ cells: [String(id), String(node.length),
        id === 0 ? 'the imaginary root' : (id === 1 ? 'the empty root' : 'a palindrome'),
        String(node.link),
        Object.keys(node.next).map(root.AlignmentView.display).join(' ') || '—',
        String(node.count)] });
    }
    root.MatrixView.render(root.jQuery('#pal-tree')[0], {
      columns: ['node', 'length', 'what it is', 'suffix link', 'extends on', 'occurrences'],
      rows: rows
    });
    root.jQuery('#pal-tree-note').text('Node 0 has length −1 and node 1 has length 0. The negative ' +
      'length is not a bug: extending a palindrome means adding the same character on both sides, ' +
      'and starting from a length of −1 makes that produce a single character, which is exactly the ' +
      'odd-length base case. Without the imaginary root every odd palindrome needs a special case. ' +
      'The tree has ' + root.Format.plural(state.tree.distinct, 'real node') + ' for a string of ' +
      root.Format.plural(state.text.length, 'character') + ', which is the distinct count and is ' +
      'always at most n — a fact that is not obvious and is the reason the structure is linear.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
