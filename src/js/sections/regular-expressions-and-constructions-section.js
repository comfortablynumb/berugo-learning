/**
 * Section: regular expressions and their constructions.
 *
 * Three constructions run on the same pattern and their state counts are
 * compared — which is the measurement, because the textbook presents
 * Thompson's as THE construction and it is the largest of the three by a wide
 * margin. Every pair is then checked for language equivalence exhaustively, so
 * "these all recognise the same language" is a result rather than a claim, and
 * the round trip through state elimination closes the loop back to a pattern.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'regular-expressions-and-constructions';
  const ALPHABET = ['a', 'b', 'c'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — Thompson\'s fragments',
      caption: 'Every operator gets its own pair of fresh states and its own ε-edges, and ' +
        'nothing is ever shared between fragments. That is what makes the construction ' +
        'compositional and easy to prove correct — each fragment has exactly one entry and one ' +
        'exit, so any fragment can be dropped into any hole — and it is also why it is the ' +
        'largest of the three constructions: two states per literal, two more per star, and no ' +
        'opportunity taken to merge anything. Glushkov spends effort computing first, last and ' +
        'follow sets and gets one state per literal with no ε-edges at all.',
      definition: [
        'flowchart LR',
        '    subgraph "concatenation: ST"',
        '      c1["S"] -. "ε" .-> c2["T"]',
        '    end',
        '    subgraph "alternation: S|T"',
        '      a0(("start")) -. "ε" .-> a1["S"]',
        '      a0 -. "ε" .-> a2["T"]',
        '      a1 -. "ε" .-> a3(("end"))',
        '      a2 -. "ε" .-> a3',
        '    end',
        '    subgraph "star: S*"',
        '      s0(("start")) -. "ε" .-> s1["S"]',
        '      s0 -. "ε" .-> s2(("end"))',
        '      s1 -. "ε" .-> s1',
        '      s1 -. "ε" .-> s2',
        '    end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Kleene\'s theorem says regular expressions and finite automata describe exactly the same ' +
        'languages**, and it is constructive in both directions. Every construction in this ' +
        'section is one half of that proof, running.',
      '**Thompson\'s construction is compositional and wasteful.** One fragment per operator, two ' +
        'fresh states each, glued with ε-transitions — which makes it trivially correct and ' +
        'trivially large. The demo counts the states and they are typically two to three times ' +
        'Glushkov\'s.',
      '**Glushkov\'s position automaton has one state per literal and no ε-edges.** Number every ' +
        'literal in the pattern, compute which positions a match can start at, end at and follow ' +
        'each other, and the automaton reads straight off those sets. It is smaller, and it is ' +
        'the right machine for ambiguity analysis in section 24.9.',
      '**Brzozowski derivatives build a DFA with no graph at all.** The derivative of a pattern ' +
        'by a symbol is the pattern matching whatever must follow it, so the STATE IS A REGULAR ' +
        'EXPRESSION. The demo lists them, and they are readable — you can see what each state is ' +
        'still waiting for.',
      '**Derivatives terminate only because of the simplification rules.** Without treating ' +
        '`a*`, `ε·a*` and `ε·(ε·a*)` as one thing, the derivative set grows forever and the ' +
        'construction never ends. Associativity, commutativity and idempotence of alternation ' +
        'plus the identities for ∅ and ε are the minimum that closes it.',
      '**State elimination goes the other way, and the answer depends on the order.** Add a fresh ' +
        'start and accept, label every edge with an expression, then remove interior states one ' +
        'at a time. Every order is correct and they differ in size — the demo runs two and ' +
        'reports both lengths.',
      '**All of them are checked against each other exhaustively.** Every pair of machines is ' +
        'run over every string up to a length bound and the agreement is a metric. A construction ' +
        'that is subtly wrong produces a plausible machine; only the comparison catches it.',
      '**Backreferences and lookaround are not regular and remove every guarantee here.** A ' +
        'pattern with a backreference can require matching `ww`, which no finite automaton does, ' +
        'and matching it is NP-hard in general. The moment a pattern uses one, none of this ' +
        'section applies to it.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — three constructions in parallel, then the regex read back',
        markup: root.RegexTemplate.render()
      },
      diagram: diagram(),
      insight: '**Backreferences make matching NP-hard and remove every guarantee in this ' +
        'section. The moment a pattern uses one, it is no longer a regular expression in any ' +
        'sense the theory covers.** That is worth knowing precisely because the syntax hides it: ' +
        '`(a*)\\1` looks like a regular expression, sits in the same string, and is passed to ' +
        'the same function. But it can require the engine to remember an unbounded captured ' +
        'string, which no finite automaton does, so no linear-time simulation exists and every ' +
        'engine that supports it must backtrack. That single feature is why JavaScript, Python ' +
        'and PCRE cannot offer RE2\'s linear-time guarantee — not an implementation choice, a ' +
        'consequence of the language class.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RegexTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const buildFor = root.Helpers.memoise(function (pattern) {
    const alphabet = root.RegexCompile.alphabetOf(root.RegexCompile.parse(pattern));
    const thompson = root.RegexCompile.thompson(pattern, alphabet);
    const glushkov = root.RegexCompile.glushkov(pattern, alphabet);
    const derived = root.Derivatives.build(pattern, alphabet);
    const minimal = root.Automaton.relabel(
      root.Minimization.hopcroft(root.Automaton.toDfa(thompson).dfa).minimal).machine;

    return { pattern: pattern, alphabet: alphabet, thompson: thompson, glushkov: glushkov,
      derived: derived, minimal: minimal,
      agreeGlushkov: root.Automaton.agree(thompson, glushkov, 8),
      agreeDerived: root.Automaton.agree(thompson, derived.dfa, 8) };
  });

  /* The memoise key is joined with a newline rather than a pipe: a pattern
     contains pipes, and splitting on one cut `(a|b)*abb` into `(a` — which
     parsed as an unclosed group and took the whole section down. */
  const roundTripFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const state = buildFor(parts[0]);
    const order = parts[1] === 'reverse'
      ? state.minimal.states.slice().reverse() : state.minimal.states.slice();
    const back = root.RegexCompile.toRegex(state.minimal, order);
    const rebuilt = root.RegexCompile.thompson(back.pattern, state.alphabet);

    return { back: back, rebuilt: rebuilt,
      agree: root.Automaton.agree(state.minimal, rebuilt, 7) };
  });

  function update() {
    const values = panel.values();
    const state = buildFor(values['rex-pattern']);
    const trip = roundTripFor(values['rex-pattern'] + '\n' + values['rex-order']);

    paintMetrics(state, trip);
    paintBack(state, trip, values['rex-order']);
    paintCompare(state);
    paintDerivatives(state);
    paintEliminate(trip);
    paintExtensions();
  }

  function paintMetrics(state, trip) {
    root.MetricGrid.update({
      'rex-thompson': { value: root.Format.exact(state.thompson.states.length),
        note: root.Format.exact(root.Automaton.summary(state.thompson).transitions) +
          ' transitions, most of them ε' },
      'rex-glushkov': { value: root.Format.exact(state.glushkov.states.length),
        note: root.Format.fixed(state.thompson.states.length / state.glushkov.states.length, 2) +
          '× smaller than Thompson\'s, with no ε-edges at all' },
      'rex-deriv': { value: root.Format.exact(state.derived.dfa.states.length),
        note: 'already deterministic; the minimal DFA has ' +
          root.Format.exact(state.minimal.states.length) },
      'rex-round': { value: trip.agree.equivalent ? 'exact' : 'BROKEN',
        note: trip.agree.equivalent
          ? 'the regex read back off the machine accepts the same language'
          : 'the round trip disagrees on "' + trip.agree.counterExample + '"' }
    });
  }

  function paintBack(state, trip, order) {
    root.jQuery('#rex-back').html(
      '<div class="mono" style="font-size:.85rem;word-break:break-all">' +
      root.Helpers.escapeHtml(trip.back.pattern) + '</div>' +
      '<div class="mono" style="font-size:.8rem;margin-top:.4rem">' +
      root.Format.exact(trip.back.pattern.length) + ' characters, from a ' +
      root.Format.exact(state.minimal.states.length) + '-state machine</div>');

    root.Helpers.setText('rex-back-note',
      'That expression came out of the minimal automaton by state elimination, and it accepts ' +
      'the same language as the pattern you typed — checked over ' +
      root.Format.exact(trip.agree.tested) + ' strings. It is also ' +
      (trip.back.pattern.length > state.pattern.length ? 'longer' : 'shorter') + ' than the ' +
      'original, at ' + root.Format.exact(trip.back.pattern.length) + ' characters against ' +
      root.Format.exact(state.pattern.length) + '. Elimination order is currently "' + order +
      '"; switching it produces a different expression for the same language, because every ' +
      'order is correct and none is canonical. That is the asymmetry worth remembering: the ' +
      'minimal AUTOMATON is unique, and the minimal regular expression is not.');
  }

  function paintCompare(state) {
    const rows = [
      { name: 'Thompson', machine: state.thompson,
        agrees: 'the reference the others are checked against' },
      { name: 'Glushkov (positions)', machine: state.glushkov,
        agrees: state.agreeGlushkov.equivalent
          ? 'yes, over ' + root.Format.exact(state.agreeGlushkov.tested) + ' strings'
          : 'NO — "' + state.agreeGlushkov.counterExample + '"' },
      { name: 'Brzozowski derivatives', machine: state.derived.dfa,
        agrees: state.agreeDerived.equivalent
          ? 'yes, over ' + root.Format.exact(state.agreeDerived.tested) + ' strings'
          : 'NO — "' + state.agreeDerived.counterExample + '"' },
      { name: 'Minimal DFA', machine: state.minimal,
        agrees: 'unique for this language, up to state names' }
    ];

    root.jQuery('#rex-compare tbody').html(rows.map(function (row) {
      const summary = root.Automaton.summary(row.machine);

      return '<tr><td>' + row.name + '</td><td class="mono">' + summary.states +
        '</td><td class="mono">' + (summary.epsilon ? 'yes' : 'no') + '</td><td class="mono">' +
        (summary.deterministic ? 'yes' : 'no') + '</td><td>' + row.agrees + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rex-compare-note',
      'Four machines for one language, and the state counts are not close: ' +
      root.Format.exact(state.thompson.states.length) + ', ' +
      root.Format.exact(state.glushkov.states.length) + ', ' +
      root.Format.exact(state.derived.dfa.states.length) + ' and ' +
      root.Format.exact(state.minimal.states.length) + '. Thompson\'s is the largest and the ' +
      'easiest to prove correct; Glushkov\'s is ε-free, which is what ambiguity analysis needs; ' +
      'the derivative construction is already deterministic and lands close to minimal without a ' +
      'minimisation pass. The last column is the check that makes the comparison meaningful — ' +
      'each machine is run against Thompson\'s over every string up to length 8.');
  }

  function paintDerivatives(state) {
    const alphabet = state.alphabet;

    root.jQuery('#rex-derivatives tbody').html(state.derived.derivatives.slice(0, 10)
      .map(function (entry) {
        const row = state.derived.dfa.delta[entry.name] || {};

        return '<tr><td class="mono">' + root.Helpers.escapeHtml(short(entry.name)) +
          '</td><td class="mono">' + (entry.nullable ? 'yes' : '') + '</td><td class="mono">' +
          root.Helpers.escapeHtml(short((row[alphabet[0]] || ['—'])[0])) +
          '</td><td class="mono">' +
          root.Helpers.escapeHtml(short((row[alphabet[1]] || ['—'])[0])) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('rex-derivatives-note',
      'Each row is a DFA state, and its name is the pattern that still has to match. The second ' +
      'column is acceptance: a state accepts exactly when its derivative matches the empty ' +
      'string, so there is no separate accepting set to maintain. Reading down the first column ' +
      'shows what the machine is waiting for at each point, which no other construction gives ' +
      'you — a subset-construction state is named `{n1,n4,n7}` and tells you nothing. That ' +
      'readability is why derivatives are the construction of choice for verified matchers.');
  }

  function short(name) {
    return name.length > 20 ? name.slice(0, 19) + '…' : name;
  }

  function paintEliminate(trip) {
    root.jQuery('#rex-eliminate tbody').html(trip.back.steps.map(function (step) {
      return '<tr><td class="mono">' + step.removed + '</td><td class="mono">' +
        root.Format.exact(step.edges) + '</td><td class="mono">' +
        root.Format.exact(step.size) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rex-eliminate-note',
      'Each removal reroutes every path through the state being deleted, so the expressions on ' +
      'the surviving edges grow while the edge count falls — the two columns move in opposite ' +
      'directions and the last row is the answer. The final length is ' +
      root.Format.exact(trip.back.pattern.length) + ' characters. Removing states in a ' +
      'different order gives a different expression for the same language, which is why real ' +
      'tools that do this pick an order heuristically (fewest incoming times outgoing edges ' +
      'first) and still produce expressions nobody wants to read.');
  }

  function paintExtensions() {
    const rows = [
      { feature: 'Alternation, concatenation, star', regular: 'yes',
        cost: 'nothing — these ARE the regular operators',
        instead: 'use them freely' },
      { feature: '`+`, `?`, bounded repetition `{n,m}`', regular: 'yes',
        cost: 'bounded repetition expands to a copy per repeat, so the machine grows',
        instead: 'fine, but `{1,1000}` is a thousand copies' },
      { feature: 'Character classes and `.`', regular: 'yes',
        cost: 'nothing structurally — one edge per symbol in the class',
        instead: 'use them; they are the alphabet, spelled compactly' },
      { feature: 'Anchors `^` and `$`', regular: 'yes',
        cost: 'nothing — they constrain where the match starts and ends',
        instead: 'use them, and note that leaving them off changes the language' },
      { feature: 'Backreferences `\\1`', regular: 'NO',
        cost: 'matching becomes NP-hard; `(a*)\\1` needs unbounded memory',
        instead: 'capture and compare in code, where the comparison is one line' },
      { feature: 'Lookahead and lookbehind', regular: 'yes in principle, no in practice',
        cost: 'the language stays regular but every engine implements it by backtracking',
        instead: 'restructure the pattern, or split the check into two passes' },
      { feature: 'Recursive patterns `(?R)`', regular: 'NO',
        cost: 'this is a parser written in regex syntax',
        instead: 'a parser — M25 builds one' }
    ];

    root.jQuery('#rex-extensions tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.feature) + '</td><td>' +
        row.regular + '</td><td>' + row.cost + '</td><td>' + row.instead + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rex-extensions-note',
      'The first four rows are the regular operators and cost nothing beyond states. The fifth ' +
      'is the one that changes the class: a backreference can require the engine to remember an ' +
      'unbounded captured string, which no finite automaton does, so no linear-time simulation ' +
      'exists and every engine supporting it must backtrack. The sixth row is subtler and worth ' +
      'the care — lookaround keeps the language regular, so a linear-time engine COULD support ' +
      'it, and the ones people use do not. The practical rule is that a pattern using rows five ' +
      'or seven belongs in a parser, and one using row six belongs in two passes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
