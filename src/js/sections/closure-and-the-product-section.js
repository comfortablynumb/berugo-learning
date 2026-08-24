/**
 * Section: closure properties and the product construction.
 *
 * The measurement is the counter-example. Containment and equivalence are
 * decided by construction — `A ∩ complement(B)` and a breadth-first search for
 * the shortest accepted word — so a "no" arrives with the shortest string that
 * proves it, and the demo runs both machines on that string to confirm. An
 * answer without a witness is an assertion; an answer with one is a test case.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'closure-and-the-product';
  const ALPHABET = ['a', 'b'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the product state (p, q) advancing on one symbol',
      caption: 'Run both machines at once on the same input and the state is the PAIR. On a ' +
        'symbol, each component moves independently, so the pair moves to the pair of ' +
        'destinations — that is the entire construction, and it is the same for all four ' +
        'operations. What changes is only which pairs are accepting: both for intersection, ' +
        'either for union, first-and-not-second for difference, exactly-one for symmetric ' +
        'difference. The number of states is at most the product of the two counts, and usually ' +
        'far fewer, because most pairs are not reachable.',
      definition: [
        'flowchart LR',
        '    P["(p, q)"] -- "a" --> Q["(p′, q′)"]',
        '    subgraph "component moves"',
        '      A["p --a--> p′ in the first machine"]',
        '      B["q --a--> q′ in the second machine"]',
        '    end',
        '    Q --> R{"accepting?"}',
        '    R -->|"∩"| I["p′ and q′ both accepting"]',
        '    R -->|"∪"| U["either accepting"]',
        '    R -->|"∖"| D["p′ accepting, q′ not"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Regular languages are closed under every Boolean operation**, and the closure is ' +
        'constructive: there is an algorithm producing the machine, not merely a proof that one ' +
        'exists. That constructiveness is what makes the section practical.',
      '**The product construction runs both machines at once.** The state is a pair, each ' +
        'component moves independently on the input symbol, and only the ACCEPTING RULE changes ' +
        'between operations. The demo builds all four from the same pairs and shows the rule ' +
        'per row.',
      '**At most m × n states, and usually far fewer.** Only reachable pairs are built, which for ' +
        'most language pairs is a small fraction of the grid. The demo reports both numbers so ' +
        'the gap between the bound and the reality is visible.',
      '**Complement needs a TOTAL machine.** Flip the accepting set of a partial DFA and every ' +
        'string that used to fall off the end is now accepted, which is wrong in the other ' +
        'direction. Determinise, add the trap, then flip — in that order.',
      '**Emptiness is reachability.** A machine accepts something exactly when some accepting ' +
        'state is reachable from the start, so a breadth-first search decides it — and the path ' +
        'it finds is the SHORTEST accepted word.',
      '**Containment is emptiness of `A ∩ complement(B)`.** That composition is the whole ' +
        'algorithm, and when it is not empty the shortest word in it is a string A accepts and B ' +
        'does not. The demo prints it and runs both machines on it.',
      '**"Does this new rule allow anything the old one did not" is exactly that question.** ' +
        'Firewall rules, route matchers, permission patterns and URL filters are regular ' +
        'languages, so containment between two versions is decidable — a rare case where a real ' +
        'policy question has an exact algorithmic answer, with a witness.',
      '**Context-free languages are NOT closed under intersection**, which is why the same ' +
        'question about two grammars is undecidable. The closure properties are not a footnote: ' +
        'they are exactly what separates the questions you can answer from the ones you cannot.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — combine two languages and get a counter-example',
        markup: root.ClosureTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Does this new firewall rule allow anything the old one did not" is ' +
        'regular-language containment, and it is decidable — a rare case where a real policy ' +
        'question has an exact algorithmic answer.** Most questions engineers ask about their ' +
        'systems are undecidable or merely testable, so it is worth recognising the ones that ' +
        'are neither. A rule set built from patterns without backreferences is a regular ' +
        'language; two versions of it can be compared exactly; and when they differ, the ' +
        'algorithm hands back the shortest URL, path or address that one admits and the other ' +
        'does not. That is a code review comment with a test case attached, generated rather ' +
        'than argued.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ClosureTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const machineFor = root.Helpers.memoise(function (pattern) {
    return root.Automaton.relabel(
      root.Minimization.hopcroft(
        root.Automaton.toDfa(root.RegexCompile.thompson(pattern, ALPHABET)).dfa
      ).minimal).machine;
  });

  const combineFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const first = machineFor(parts[0]);
    const second = machineFor(parts[1]);
    const built = root.AutomatonOps.product(first, second, parts[2]);

    return { first: first, second: second, built: built,
      shortest: root.AutomatonOps.shortestWord(built.machine),
      contains: root.AutomatonOps.contains(first, second),
      equivalent: root.AutomatonOps.equivalent(first, second),
      grid: first.states.length * second.states.length };
  });

  function update() {
    const values = panel.values();
    const key = values['clo-first'] + '\n' + values['clo-second'] + '\n' +
      values['clo-operation'];
    const state = combineFor(key);

    paintMetrics(state);
    paintAnswer(state, values);
    paintPairs(state);
    paintRules(values);
    paintProperties();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'clo-states': { value: root.Format.exact(state.built.machine.states.length) + ' of ' +
        root.Format.exact(state.grid),
      note: 'only reachable pairs are built; the bound is the product of the two counts' },
      'clo-shortest': { value: state.shortest === null ? 'the language is empty'
        : '"' + (state.shortest === '' ? 'ε' : state.shortest) + '"',
      note: state.shortest === null
        ? 'no accepting state is reachable, so the result accepts nothing at all'
        : root.Format.exact(state.shortest.length) + ' symbols — the shortest there is' },
      'clo-contains': { value: state.contains.contained ? 'yes' : 'no',
        note: state.contains.contained
          ? 'the first language accepts nothing the second rejects'
          : 'counter-example: "' + (state.contains.counterExample === ''
            ? 'ε' : state.contains.counterExample) + '"' },
      'clo-equivalent': { value: state.equivalent.equivalent ? 'yes' : 'no',
        note: state.equivalent.equivalent
          ? 'containment holds in both directions'
          : '"' + (state.equivalent.counterExample === ''
            ? 'ε' : state.equivalent.counterExample) + '" is accepted only by the ' +
            state.equivalent.acceptedBy }
    });
  }

  function paintAnswer(state, values) {
    const word = state.equivalent.counterExample;
    const confirmed = word === null ? null : {
      first: root.Automaton.accepts(state.first, word),
      second: root.Automaton.accepts(state.second, word)
    };

    root.jQuery('#clo-answer').html(
      '<div class="mono" style="font-size:.85rem">' +
      root.Helpers.escapeHtml(values['clo-first']) + '  ' + symbolFor(values['clo-operation']) +
      '  ' + root.Helpers.escapeHtml(values['clo-second']) + '</div>' +
      '<div class="mono" style="font-size:.9rem;margin-top:.4rem">shortest accepted: ' +
      (state.shortest === null ? '(none — empty language)'
        : '"' + (state.shortest === '' ? 'ε' : state.shortest) + '"') + '</div>' +
      (confirmed === null ? ''
        : '<div class="mono" style="font-size:.85rem;margin-top:.4rem">witness "' +
          (word === '' ? 'ε' : word) + '": first ' + (confirmed.first ? 'accepts' : 'rejects') +
          ', second ' + (confirmed.second ? 'accepts' : 'rejects') + '</div>'));

    root.Helpers.setText('clo-answer-note', confirmed === null
      ? 'The two languages are equivalent, which means the containment construction found no ' +
        'string in either direction — every one of the ' +
        root.Format.exact(state.built.machine.states.length) + ' reachable pairs either accepts ' +
        'in both components or rejects in both. That is a proof rather than a sample: the ' +
        'search is exhaustive over the product, not over strings.'
      : 'The witness was produced by the construction, not searched for by hand: build ' +
        'first ∩ complement(second), then take the shortest word a breadth-first search reaches ' +
        'an accepting state with. The line above then runs BOTH original machines on it, so the ' +
        'counter-example is confirmed rather than trusted. That last step matters — a bug in the ' +
        'complement or the product would produce a confident wrong witness, and running the ' +
        'originals catches it.');
  }

  function symbolFor(operation) {
    return { intersection: '∩', union: '∪', difference: '∖', symmetric: '△' }[operation];
  }

  function paintPairs(state) {
    root.jQuery('#clo-pairs tbody').html(state.built.pairs.slice(0, 12).map(function (pair) {
      return '<tr><td class="mono">' + pair.name + '</td><td class="mono">' +
        (pair.leftAccepts ? 'yes' : '') + '</td><td class="mono">' +
        (pair.rightAccepts ? 'yes' : '') + '</td><td class="mono">' +
        (pair.accepts ? 'yes' : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('clo-pairs-note',
      root.Format.exact(state.built.pairs.length) + ' reachable pairs out of a possible ' +
      root.Format.exact(state.grid) + ', and the fourth column is the only thing the operation ' +
      'changes. The two middle columns are properties of the components and are computed once; ' +
      'switching between intersection, union and difference re-reads them under a different ' +
      'rule and rebuilds nothing. That is why a library exposes one product function and four ' +
      'wrappers rather than four constructions.');
  }

  function paintRules(values) {
    const rows = ['intersection', 'union', 'difference', 'symmetric'].map(function (operation) {
      const state = combineFor(values['clo-first'] + '\n' + values['clo-second'] + '\n' +
        operation);

      return { operation: operation, states: state.built.machine.states.length,
        shortest: state.shortest };
    });
    const rules = {
      intersection: 'both components accept', union: 'either component accepts',
      difference: 'the first accepts and the second does not',
      symmetric: 'exactly one of them accepts'
    };

    root.jQuery('#clo-rules tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.operation + ' ' + symbolFor(row.operation) + '</td><td>' +
        rules[row.operation] + '</td><td class="mono">' + root.Format.exact(row.states) +
        '</td><td class="mono">' + (row.shortest === null ? '(empty)'
          : '"' + (row.shortest === '' ? 'ε' : row.shortest) + '"') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('clo-rules-note',
      'Four operations, identical state counts. The construction is the same graph every time ' +
      'and only the accepting set differs, which is worth noticing because it means the ' +
      'expensive part — building the reachable pairs — is shared. It also explains why ' +
      'difference and symmetric difference come free once intersection exists, and why the ' +
      'containment check in the metrics above costs one product rather than a search over ' +
      'strings.');
  }

  function paintProperties() {
    const rows = [
      { operation: 'Union, intersection, difference', construction: 'product, four accepting rules',
        cost: 'at most m × n states, usually far fewer',
        catch: 'both machines must be deterministic and total first' },
      { operation: 'Complement', construction: 'determinise, total, flip the accepting set',
        cost: 'up to 2^n from the determinisation',
        catch: 'flipping a PARTIAL machine accepts everything that fell off the end' },
      { operation: 'Concatenation', construction: 'ε-edges from the first accepting set to the second start',
        cost: 'm + n states, and the result is an NFA',
        catch: 'determinising afterwards can be exponential' },
      { operation: 'Kleene star', construction: 'a fresh accepting start with ε back-edges',
        cost: 'n + 1 states, again an NFA',
        catch: 'reusing the old start as accepting is the classic off-by-one' },
      { operation: 'Reversal', construction: 'reverse every edge, swap start and accepting',
        cost: 'n states, and the result is an NFA',
        catch: 'the reverse of a DFA is rarely deterministic' },
      { operation: 'Emptiness and containment', construction: 'breadth-first search over the product',
        cost: 'linear in the product',
        catch: 'the product is what may be large; the search itself is cheap' }
    ];

    root.jQuery('#clo-properties tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.operation + '</td><td>' + row.construction + '</td><td>' +
        row.cost + '</td><td>' + row.catch + '</td></tr>';
    }).join(''));

    root.Helpers.setText('clo-properties-note',
      'The last column is where the implementations go wrong, and the second row is the one to ' +
      'remember: complement is where a missing trap state turns into a machine that accepts the ' +
      'wrong half of everything. Note also which constructions return an NFA — concatenation, ' +
      'star and reversal all do — because a pipeline that concatenates, stars and then ' +
      'complements pays for a determinisation it did not obviously ask for. That is the ' +
      'practical reason to minimise between steps rather than at the end.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
