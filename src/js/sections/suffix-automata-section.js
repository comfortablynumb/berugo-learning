/**
 * Section: Suffix automata and factor oracles.
 *
 * The clone case is the section, so the demo is built around making it
 * visible: the construction table labels every extension as root, link or
 * clone, and the metric counts them. The factor oracle sits underneath as the
 * control — it is literally the same construction with the clone step removed,
 * it is smaller, and it accepts strings that never occurred. Running the two
 * against brute force is the only way to show that "it accepted every
 * substring I tried" is not evidence of correctness.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'suffix-automata';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  /** What a clone is, drawn as the split it performs. Concrete states rather
   *  than a whole automaton: the whole automaton for a text long enough to
   *  need a clone is unreadable, and the split is the part that matters. */
  function diagram() {
    return {
      title: 'Diagram — where a clone comes from',
      caption: 'Reading one more b splits a class in two. The clone takes the shorter half; the original keeps the longer.',
      definition: [
        'flowchart TD',
        '    Q["state q reached by the new character<br/>len(q) &gt; len(p) + 1<br/>it mixes two endpos classes"]',
        '    Q -->|"copy with len = len(p) + 1"| C["clone<br/>same transitions<br/>the larger endpos set"]',
        '    Q -->|"keep, endpos shrinks"| O["original q<br/>len unchanged<br/>the smaller endpos set"]',
        '    O -.->|"suffix link"| C',
        '    N["the new state"] -.->|"suffix link"| C'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A suffix automaton is the smallest DFA that accepts exactly the substrings of a string. ' +
          'Every state stands for a set of substrings sharing the same set of end positions — its ' +
          'endpos class — and the state\'s `len` is the longest of them. The suffix links point at ' +
          'the state holding the next shorter class, and they form a tree whose parent-child ' +
          'relation is set containment.',
        'Construction is online and takes two branches. The easy one appends a state and walks the ' +
          'links adding transitions. The hard one is the clone: a state reached by the new ' +
          'character already exists but is *too long*, meaning it mixes substrings the new ' +
          'character has just split into different endpos classes. A copy is made with the shorter ' +
          'length, the transitions that should now reach the shorter class are repointed at it, and ' +
          'both the old state and the new one link to it.',
        'Skip the clone and the automaton still accepts every substring — it just also accepts ' +
          'strings that never occurred, which no amount of spot-checking will reveal. The factor ' +
          'oracle is exactly that structure, kept deliberately, and the invariant that catches the ' +
          'difference is the endpos identity: a state\'s occurrence count must equal the sum of its ' +
          'link children\'s, plus one if it is a prefix state.'
      ],
      demo: {
        title: 'Interactive demo — clones, growth and the oracle that skips them',
        markup: root.SuffixAutomataTemplate.render()
      },
      diagram: diagram(),
      insight: 'The endpos identity is the invariant to assert in a test, not "does it accept the ' +
        'substrings". Accepting all of them is the easy half; accepting *only* them is what the ' +
        'clone case buys, and only a check against brute force or against the link-children sum ' +
        'will tell you whether you have it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SuffixAutomataTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function textFor(values) {
    const raw = String(values['sm-text'] || '').trim();
    return raw.length ? raw : 'abbbaab';
  }

  function corpusFor(values) {
    const kind = values['sm-corpus'];
    if (kind === 'binary') return root.TextCorpus.randomText(2000, 2, 4);
    if (kind === 'english') return root.TextCorpus.words().join(' ').slice(0, 2000);
    if (kind === 'repeat') return root.TextCorpus.repeated('a', 2000);
    if (kind === 'fibonacci') return root.TextCorpus.fibonacciWord(17).slice(0, 2000);
    return root.TextCorpus.dna(2000, 1);
  }

  function update(app) {
    const values = panel.values();
    const text = textFor(values);
    const automaton = root.SuffixAutomaton.build(text, { trace: true });
    const pattern = String(values['sm-pattern'] || '');

    const truth = pattern.length ? text.indexOf(pattern) !== -1 : null;
    const answer = pattern.length ? automaton.has(pattern) : null;
    const bound = Math.max(1, 2 * text.length - 1);

    root.MetricGrid.update({
      'sm-states': {
        value: root.Format.exact(automaton.stateCount()),
        note: '2n − 1 = ' + bound + ' for n = ' + text.length + '; transitions ' +
          root.Format.exact(automaton.transitions()) + ' against 3n − 4 = ' + Math.max(1, 3 * text.length - 4)
      },
      'sm-clones': {
        value: root.Format.exact(automaton.clones()),
        note: automaton.clones() ? 'each one split an endpos class in two' : 'this text never forced one'
      },
      'sm-distinct': {
        value: root.Format.exact(automaton.distinctSubstrings()),
        note: 'the suffix array computes ' +
          root.Format.exact(root.SuffixArray.build(text).distinctSubstrings()) + ' — they must match'
      },
      'sm-accepts': {
        value: pattern.length ? (answer ? 'yes' : 'no') : '—',
        note: pattern.length
          ? 'brute force says ' + (truth ? 'yes' : 'no') + (answer === truth ? ' — agreed' : ' — DISAGREEMENT')
          : 'type a string above'
      }
    });

    paintTrace(automaton);
    paintOracle(text);
    paintSizes(values);
    draw(app, values);
  }

  function paintTrace(automaton) {
    const rows = automaton.trace.map(function (step, at) {
      return {
        highlight: step.kind === 'clone',
        cells: [
          { value: at + 1 },
          { value: step.symbol },
          { value: step.kind },
          { value: step.state },
          { value: step.kind === 'clone' ? step.clone + ' from ' + step.from : (step.link === undefined ? '—' : step.link) },
          { value: step.states }
        ]
      };
    });

    root.MatrixView.render(root.jQuery('#sm-trace')[0], {
      columns: ['step', 'character', 'branch taken', 'new state', 'clone / link', 'states'],
      rows: rows,
      maxRows: 42
    });

    root.jQuery('#sm-trace-note').text('Highlighted rows are clones. A clone adds a state without ' +
      'adding a character, which is why the state count can exceed the text length — and why the ' +
      'bound is 2n − 1 rather than n + 1.');
  }

  function paintOracle(text) {
    const oracle = root.SuffixAutomaton.factorOracle(text);
    const automaton = root.SuffixAutomaton.build(text);
    const real = root.TextCorpus.distinctSubstrings(text);

    /* Every string over the text's alphabet up to length 4: small enough to
       enumerate, long enough to catch the oracle over-accepting. */
    const alphabet = root.TextCorpus.alphabetOf(text);
    const probes = [];
    const extend = function (prefix) {
      if (prefix.length >= Math.min(4, text.length + 1)) return;
      alphabet.forEach(function (symbol) {
        probes.push(prefix + symbol);
        extend(prefix + symbol);
      });
    };
    extend('');

    const oracleWrong = probes.filter(function (probe) { return oracle.has(probe) !== real.has(probe); });
    const automatonWrong = probes.filter(function (probe) { return automaton.has(probe) !== real.has(probe); });

    const lines = [
      'suffix automaton: ' + automaton.stateCount() + ' states, ' + automaton.transitions() + ' transitions',
      'factor oracle:    ' + oracle.states + ' states, ' + oracle.transitions + ' transitions',
      '',
      'strings tested (every one up to length 4 over this alphabet): ' + probes.length,
      'suffix automaton wrong on: ' + automatonWrong.length,
      'factor oracle wrong on:    ' + oracleWrong.length +
        (oracleWrong.length ? '  → ' + oracleWrong.slice(0, 8).join(', ') : ''),
      '',
      'every one of those is accepted by the oracle and does not occur in the text.'
    ];

    root.jQuery('#sm-oracle').text(lines.join('\n'));
    root.jQuery('#sm-oracle-note').text('The oracle is smaller — exactly n + 1 states, always — and ' +
      'it is wrong. It is used deliberately in some string-matching algorithms, where a false ' +
      'accept costs a verification step and nothing else. Using it where correctness matters is the ' +
      'failure this comparison exists to prevent.');
  }

  function paintSizes(values) {
    const corpus = corpusFor(values);
    const comparison = root.TextLab.compareSubstringIndexes({ text: corpus, probes: 60, seed: 6 });

    const rows = comparison.rows.map(function (row) {
      return '<tr' + (row.id === 'suffix-automaton' ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.units) + ' ' + row.unitLabel + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.units / corpus.length, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytesPerChar, 1) + '</td>' +
        '<td class="mono">' + (row.ok ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#sm-size tbody').html(rows);
    root.jQuery('#sm-size-note').text('All four agreed on ' + comparison.patterns +
      ' membership questions, and the automaton and the suffix array agreed on the distinct-substring ' +
      'count (' + root.Format.exact(comparison.distinctSubstrings.array) + '). Two independent ' +
      'computations of the same quantity is a stronger check than either one passing its own tests.');
  }

  function draw(app, values) {
    const corpus = corpusFor(values).slice(0, 600);
    const states = [];
    const transitions = [];
    const every = Math.max(1, Math.floor(corpus.length / 60));

    for (let at = every; at <= corpus.length; at += every) {
      const built = root.SuffixAutomaton.build(corpus.slice(0, at));
      states.push({ x: at, y: built.stateCount() });
      transitions.push({ x: at, y: built.transitions() });
    }

    chart = root.GrowthPlot.render(root.jQuery('#sm-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'states', points: states },
        { label: 'transitions', points: transitions, dashed: true },
        { label: '2n − 1 bound', points: states.map(function (p) { return { x: p.x, y: 2 * p.x - 1 }; }), dashed: true }
      ],
      xLabel: 'characters read',
      yLabel: 'states / transitions',
      legendHost: root.jQuery('#sm-legend')[0],
      summary: function () {
        return 'Suffix-automaton growth over the first 600 characters of the ' +
          values['sm-corpus'] + ' corpus, against the 2n − 1 bound.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
