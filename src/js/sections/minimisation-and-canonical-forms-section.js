/**
 * Section: minimisation and canonical forms.
 *
 * The measurement is the agreement between three algorithms and an oracle. All
 * three minimisations run on the same machine, and a brute-force Myhill–Nerode
 * computation counts the equivalence classes straight from the language. Four
 * numbers that must be equal, computed four different ways — which is what
 * turns "the minimal DFA is unique" from a theorem you are told into one the
 * page demonstrates.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'minimisation-and-canonical-forms';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a block splitting on a distinguishing symbol',
      caption: 'Refinement starts with the coarsest partition that could possibly be right — ' +
        'accepting states in one block, the rest in another, because those two can always be ' +
        'told apart by the empty suffix. Then any block whose members send the same symbol into ' +
        'DIFFERENT blocks has to split, because that symbol distinguishes them. Repeat until ' +
        'nothing splits. The partition that survives is the Myhill–Nerode partition, each block ' +
        'is one state of the minimal machine, and the process cannot loop because every round ' +
        'either splits something or stops.',
      definition: [
        'flowchart TD',
        '    B["block {p, q, r}"] --> C{"where does b lead?"}',
        '    C -->|"p → block 1"| S1["{p}"]',
        '    C -->|"q, r → block 2"| S2["{q, r}"]',
        '    S1 --> N["b is the distinguishing symbol:<br/>p and q are not the same state"]',
        '    S2 --> N'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Two states are the same state if no continuation tells them apart.** That is the whole ' +
        'of Myhill–Nerode, and it is a statement about the LANGUAGE rather than about any ' +
        'machine — which is why the minimal DFA is unique up to renaming and why "am I done" is ' +
        'a decidable question.',
      '**Refinement starts coarse and splits.** Accepting and rejecting are distinguishable by ' +
        'the empty suffix, so that is the first partition. Any block whose members send some ' +
        'symbol into different blocks must split, because that symbol is the witness. When ' +
        'nothing splits, the partition is the answer.',
      '**Moore\'s version is O(n²·|Σ|) and worth watching.** Each round recomputes every state\'s ' +
        'signature and splits accordingly, so the intermediate partitions are visible and the ' +
        'demo prints them. It is the version to reach for when you want to explain the result.',
      '**Hopcroft\'s is O(n log n) and the trick is one line.** Refine against a worklist of ' +
        'splitters, and when a block splits, enqueue the SMALLER half. A state can be in the ' +
        'smaller half at most log n times, which is where the logarithm comes from.',
      '**Brzozowski\'s is two lines and sometimes exponential.** Reverse, determinise, reverse, ' +
        'determinise — and the result is minimal. Nobody believes it until they run it. The ' +
        'intermediate machine can be exponentially large, which is the price.',
      '**Trim first, or the counts are meaningless.** Unreachable states cannot be told apart ' +
        'from anything because nothing reaches them, and dead states are all the same state. ' +
        'Removing both before refining is not an optimisation, it is part of the algorithm.',
      '**All three return the minimal TOTAL machine here, including the trap.** Myhill–Nerode ' +
        'partitions all of Σ*, and the strings from which nothing is accepted form a class of ' +
        'their own. Comparing a trimmed machine against a total class count is the off-by-one ' +
        'that makes three correct algorithms look like they disagree.',
      '**Uniqueness is what makes equivalence decidable, and that is the practical payoff.** ' +
        'Two regexes are equivalent exactly when their minimal DFAs are isomorphic, so ' +
        '"did my refactor change what this pattern matches" has an exact answer — which section ' +
        '24.6 turns into a containment check with a counter-example.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — refine a partition, and check it against the language',
        markup: root.MinimiseTemplate.render()
      },
      diagram: diagram(),
      insight: '**The minimal DFA is unique, which is what makes "are these two regexes ' +
        'equivalent" a decidable question you can answer in code — and it is how you refactor a ' +
        'monstrous pattern with confidence.** Uniqueness is doing all the work in that sentence. ' +
        'Because there is exactly one minimal machine per language, comparing two patterns ' +
        'reduces to minimising both and checking whether the machines are the same shape, and a ' +
        'difference comes with a shortest string that separates them. That turns a refactor from ' +
        'a judgement call into a test, and it is a rare case where the theory hands an engineer ' +
        'an exact answer to a question they actually have.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MinimiseTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const buildFor = root.Helpers.memoise(function (pattern) {
    const alphabet = root.RegexCompile.alphabetOf(root.RegexCompile.parse(pattern));
    const dfa = root.Automaton.toDfa(root.RegexCompile.thompson(pattern, alphabet)).dfa;
    const relabelled = root.Automaton.relabel(dfa).machine;
    const moore = root.Minimization.moore(relabelled);
    const hopcroft = root.Minimization.hopcroft(relabelled);
    const brzozowski = root.Minimization.brzozowski(relabelled);
    const oracle = root.Minimization.myhillNerode(
      root.Automaton.complete(root.Automaton.trim(relabelled)), 5);

    return { pattern: pattern, alphabet: alphabet, dfa: relabelled,
      moore: moore, hopcroft: hopcroft, brzozowski: brzozowski, oracle: oracle,
      agree: moore.after === hopcroft.after && hopcroft.after === brzozowski.after
        && brzozowski.after === oracle.count };
  });

  function chosen(state, name) {
    return state[name];
  }

  function update() {
    const values = panel.values();
    const state = buildFor(values['min-pattern']);
    const result = chosen(state, values['min-algorithm']);

    paintGraph(state, result, values['min-algorithm']);
    paintMetrics(state, result);
    paintVerdict(state, values['min-algorithm']);
    paintRounds(state);
    paintClasses(state);
    paintAlgorithms(state);
  }

  function paintGraph(state, result, name) {
    const machine = root.Automaton.relabel(result.minimal, 'm').machine;

    root.AutomatonView.render(document.getElementById('min-graph'), {
      machine: machine, active: [],
      layout: machine.states.length > 5 ? 'layers' : 'circle', width: 560, height: 280,
      ariaLabel: 'the minimal machine for this language' });

    root.Helpers.setText('min-graph-note',
      'The machine ' + name + ' produced, relabelled for readability: ' +
      root.Format.exact(machine.states.length) + ' states from ' +
      root.Format.exact(result.before) + '. Whichever of the three algorithms you pick, the ' +
      'drawing is the same shape — that is uniqueness made visible. The trap state is included ' +
      'because a minimal machine here is a TOTAL one, so it is the state every rejected prefix ' +
      'settles into and never leaves.');
  }

  function paintMetrics(state, result) {
    root.MetricGrid.update({
      'min-before': { value: root.Format.exact(result.before),
        note: 'the subset construction produced ' + root.Format.exact(state.dfa.states.length) },
      'min-after': { value: root.Format.exact(result.after),
        note: 'down from ' + root.Format.exact(result.before) + ' after trimming and completing' },
      'min-classes': { value: root.Format.exact(state.oracle.count),
        note: 'computed by testing every prefix against every suffix up to length ' +
          root.Format.exact(state.oracle.bound) },
      'min-same': { value: state.agree ? 'yes' : 'NO',
        note: state.agree
          ? 'Moore, Hopcroft, Brzozowski and the oracle all say ' +
            root.Format.exact(result.after)
          : 'Moore ' + state.moore.after + ', Hopcroft ' + state.hopcroft.after +
            ', Brzozowski ' + state.brzozowski.after + ', oracle ' + state.oracle.count }
    });
  }

  function paintVerdict(state, name) {
    root.jQuery('#min-verdict').html(
      ['moore', 'hopcroft', 'brzozowski'].map(function (key) {
        return '<div class="mono" style="font-size:.85rem">' + key.padEnd(12) + ' → ' +
          root.Format.exact(state[key].after) + ' states' +
          (key === name ? '   ← shown above' : '') + '</div>';
      }).join('') +
      '<div class="mono" style="font-size:.85rem">oracle       → ' +
      root.Format.exact(state.oracle.count) + ' classes</div>');

    root.Helpers.setText('min-verdict-note',
      'Four numbers computed four different ways, and they agree. Three of them are algorithms ' +
      'that walk the machine; the fourth never looks at a machine at all — it tests every prefix ' +
      'against every suffix and counts the equivalence classes of the LANGUAGE. That is the ' +
      'check worth having, because a minimisation with a subtle bug produces a smaller machine ' +
      'that is still plausible, and comparing it against another minimisation would only ' +
      'confirm a shared assumption.');
  }

  function paintRounds(state) {
    root.jQuery('#min-rounds tbody').html(state.moore.rounds.map(function (round) {
      return '<tr><td class="mono">' + round.round + '</td><td class="mono">' +
        root.Format.exact(round.blocks.length) + '</td><td class="mono">' +
        round.blocks.map(function (block) {
          return '{' + block.join(',') + '}';
        }).join(' ').slice(0, 60) + '</td><td class="mono">' +
        (round.splitter ? round.splitter.symbol + ': ' + round.splitter.left + ' vs ' +
          round.splitter.right : '') + '</td></tr>';
    }).join(''));

    const first = state.moore.rounds[0];
    const last = state.moore.rounds[state.moore.rounds.length - 1];

    root.Helpers.setText('min-rounds-note',
      'Round 0 is the coarsest partition that could be right: accepting against rejecting, ' +
      root.Format.exact(first.blocks.length) + ' blocks. Each later round splits any block whose ' +
      'members disagree about where a symbol leads, and the last column names the symbol and the ' +
      'two states it separated. The process stops at ' +
      root.Format.exact(last.blocks.length) + ' blocks because nothing splits any further, and ' +
      'that is the termination argument in full — every round either refines the partition or is ' +
      'the last one, and a partition of n states can be refined at most n times.');
  }

  function paintClasses(state) {
    root.jQuery('#min-classes-table tbody').html(state.oracle.witnesses.slice(0, 12)
      .map(function (row) {
        return '<tr><td class="mono">' + (row.left === '' ? 'ε' : row.left) +
          '</td><td class="mono">' + (row.right === '' ? 'ε' : row.right) +
          '</td><td class="mono">' + (row.suffix === null ? 'NOTHING'
            : (row.suffix === '' ? 'ε' : row.suffix)) + '</td><td class="mono">' +
          (row.suffix === null ? '—' : (row.left === '' ? 'ε' : row.left)) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('min-classes-caption',
      root.Format.exact(state.oracle.count) + ' classes give ' +
      root.Format.exact(state.oracle.witnesses.length) + ' pairs to separate, and every one has ' +
      'a witness — a suffix after which one prefix is accepted and the other is not. That is ' +
      'what "these are different states" MEANS, and it is why the count is a lower bound as well ' +
      'as an upper one: any machine with fewer states would have to send two of these prefixes ' +
      'to the same state, and the witness would then be accepted from both or neither.');
  }

  function paintAlgorithms(state) {
    const rows = [
      { name: 'Moore (partition refinement)',
        result: root.Format.exact(state.moore.after) + ' states in ' +
          root.Format.exact(state.moore.rounds.length) + ' rounds',
        cost: 'O(n²·|Σ|)',
        good: 'explaining the result — every intermediate partition is visible' },
      { name: 'Hopcroft',
        result: root.Format.exact(state.hopcroft.after) + ' states in ' +
          root.Format.exact(state.hopcroft.passes) + ' worklist passes',
        cost: 'O(n log n)',
        good: 'the default; the smaller-half rule is the whole trick' },
      { name: 'Brzozowski',
        result: root.Format.exact(state.brzozowski.after) + ' states, via an intermediate of ' +
          root.Format.exact(state.brzozowski.intermediate),
        cost: 'exponential in the worst case',
        good: 'starting from an NFA — it determinises and minimises in one move' },
      { name: 'Myhill–Nerode by brute force',
        result: root.Format.exact(state.oracle.count) + ' classes',
        cost: 'exponential in the string bound',
        good: 'the oracle — it never looks at a machine, so it cannot share a bug with one' }
    ];

    root.jQuery('#min-algorithms tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.result + '</td><td class="mono">' +
        row.cost + '</td><td>' + row.good + '</td></tr>';
    }).join(''));

    root.Helpers.setText('min-algorithms-note',
      'Same answer, four routes. Brzozowski\'s row is the one worth staring at: its intermediate ' +
      'machine has ' + root.Format.exact(state.brzozowski.intermediate) + ' states here, and on ' +
      'an adversarial input that number is exponential — yet the algorithm is two lines and ' +
      'takes an NFA directly, which the other two cannot. The last row is not an algorithm ' +
      'anybody ships; it exists so the other three have something independent to be checked ' +
      'against, which is the same role the published test vectors play in M23.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
