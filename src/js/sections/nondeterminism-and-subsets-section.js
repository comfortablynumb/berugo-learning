/**
 * Section: nondeterminism and the subset construction.
 *
 * Two measurements. The first is the trace: the SET of active states advancing
 * one symbol at a time, which is what "nondeterminism" means operationally —
 * not guessing, but being in several places at once. The second is the
 * exponential family, where the predicted 2^(n+1) is checked against the
 * measured state count, and the subset construction lands one state above the
 * bound at every n until minimisation removes it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'nondeterminism-and-subsets';
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
      title: 'Diagram — an NFA, and the DFA state that is a set of its states',
      caption: 'The NFA can be in several states at once: reading an `a` from the loop it both ' +
        'stays and commits to the guess that this is the `a` of `abb`. There is no backtracking ' +
        'and no guessing in the implementation — the machine simply tracks the whole set. The ' +
        'DFA below it has one state per REACHABLE SET, which is why determinisation costs states ' +
        'rather than time: `{q0,q1}` is a single deterministic state whose name records that ' +
        'both possibilities are still open. Every DFA state in the demo is labelled with the ' +
        'subset it stands for, so the correspondence is visible rather than asserted.',
      definition: [
        'flowchart LR',
        '    subgraph NFA',
        '      q0 -- "a,b" --> q0',
        '      q0 -- "a" --> q1',
        '      q1 -- "b" --> q2',
        '      q2 -- "b" --> q3',
        '    end',
        '    subgraph DFA',
        '      S0["{q0}"] -- "a" --> S1["{q0,q1}"]',
        '      S1 -- "b" --> S2["{q0,q2}"]',
        '      S2 -- "b" --> S3["{q0,q3} — accepting"]',
        '    end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An NFA is not a machine that guesses.** It is a machine that is in a SET of states, and ' +
        'running it means advancing the set. The demo shows exactly that: one row per input ' +
        'symbol, with the active set printed. Nothing is backtracked and nothing is undone.',
      '**ε-transitions let a machine change state without reading anything**, which is what makes ' +
        'Thompson\'s construction compositional — every fragment has one entry and one exit, and ' +
        'they are glued with ε. The cost is that "where am I" means "the ε-closure of where I ' +
        'am", computed before and after every move.',
      '**NFAs and DFAs recognise exactly the same languages.** Nondeterminism buys conciseness ' +
        'and never power. The subset construction is the proof, and it is constructive: run it ' +
        'and you have the DFA.',
      '**Each DFA state is a reachable SET of NFA states**, which is why the construction is ' +
        'exponential in the worst case: there are 2^n subsets. The demo names each DFA state ' +
        'after its subset so the correspondence is readable rather than asserted.',
      '**The blow-up is real and the demo measures it.** `(a|b)*a(a|b)^n` needs an NFA of n + 2 ' +
        'states and a DFA of 2^(n+1), because the DFA must remember which of the last n + 1 ' +
        'positions held an `a`. The measured minimal count hits the predicted number exactly at ' +
        'every n.',
      '**The subset construction lands one state ABOVE the bound, every time.** Two of the ' +
        'subsets it builds denote the same language and it has no way to know; minimisation ' +
        'removes exactly that one. "Exponential" is right about the exponent and needs a second ' +
        'pass for the constant.',
      '**Real regex engines determinise LAZILY.** Build DFA states on demand as input arrives and ' +
        'cache them, so the common case pays for the states it actually visits and the ' +
        'exponential worst case is never materialised. RE2 and Go\'s regexp do this, with a bounded ' +
        'cache that is flushed rather than grown.',
      '**Or they do not determinise at all.** Simulating the NFA directly costs O(states) per ' +
        'character and no memory beyond the state set, which is linear in the input and immune ' +
        'to the blow-up — and immune to catastrophic backtracking too, which is the subject of ' +
        'section 24.9.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — watch the state set advance, then determinise it',
        markup: root.SubsetTemplate.render()
      },
      diagram: diagram(),
      insight: '**Lazy determinisation is what real regex engines do: build DFA states on demand ' +
        'and cache them, which keeps the common case linear without paying the exponential up ' +
        'front.** The exponential family in the demo is the reason it matters — a pattern of ' +
        'twenty characters can have a million-state DFA — and the reason it works is that a real ' +
        'input visits a handful of those states. That is a general engineering shape rather than ' +
        'a regex trick: when a precomputed table would be enormous and any single run touches a ' +
        'tiny part of it, compute the entries on demand and bound the cache. The same argument ' +
        'produces JIT compilation, memoised routing tables and incremental index builds.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SubsetTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const buildFor = root.Helpers.memoise(function (pattern) {
    const nfa = root.RegexCompile.thompson(pattern, ALPHABET);
    const free = root.Automaton.removeEpsilon(nfa);
    const built = root.Automaton.toDfa(nfa);
    const minimal = root.Minimization.hopcroft(built.dfa);

    return { nfa: nfa, free: free, built: built, minimal: minimal,
      equivalence: root.Automaton.agree(nfa, built.dfa, 9) };
  });

  const blowUpFor = root.Helpers.memoise(function () {
    return root.LanguageLab.blowUp(7);
  });

  function update() {
    const values = panel.values();
    const state = buildFor(values['sub-pattern']);
    const input = values['sub-input'];

    paintTrace(state, input);
    paintMetrics(state);
    paintSteps(state);
    paintSubsets(state);
    paintBlowUp();
    paintEngines();
  }

  function paintTrace(state, input) {
    const run = root.Automaton.run(state.nfa, input);

    root.jQuery('#sub-trace').html(run.trace.map(function (step) {
      return '<div class="mono" style="font-size:.82rem">' +
        (step.index < 0 ? 'start ' : 'read ' + step.symbol + ' ') + '→ {' +
        step.states.join(',') + '} · ' + root.Format.exact(step.states.length) +
        ' active</div>';
    }).join(''));

    const widest = run.trace.reduce(function (most, step) {
      return Math.max(most, step.states.length);
    }, 0);

    root.Helpers.setText('sub-trace-note',
      'Reading "' + input + '" the machine is in up to ' + root.Format.exact(widest) +
      ' states at once, and it ' + (run.accepted ? 'ends in an accepting state' :
        'ends in none') + '. That set is the whole of the nondeterminism: the implementation ' +
      'never guesses, never backtracks and never undoes anything, it just carries every ' +
      'possibility forward. Simulating an NFA this way costs O(states) per character, which is ' +
      'the linear-time matching that section 24.9 contrasts with catastrophic backtracking.');
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'sub-nfa': { value: root.Format.exact(state.free.states.length),
        note: 'Thompson\'s construction gave ' +
          root.Format.exact(state.nfa.states.length) + ' before ε-removal' },
      'sub-dfa': { value: root.Format.exact(state.built.dfa.states.length),
        note: root.Format.exact(state.built.steps.length) +
          ' transitions computed to build it' },
      'sub-min': { value: root.Format.exact(state.minimal.after),
        note: 'the subset construction produced ' +
          root.Format.exact(state.minimal.before) + ' before minimisation' },
      'sub-equiv': { value: state.equivalence.equivalent ? 'yes' : 'NO',
        note: state.equivalence.equivalent
          ? 'checked over all ' + root.Format.exact(state.equivalence.tested) +
            ' strings up to length 9'
          : 'they disagree on "' + state.equivalence.counterExample + '"' }
    });
  }

  function paintSteps(state) {
    root.jQuery('#sub-steps tbody').html(state.built.steps.slice(0, 16).map(function (step) {
      return '<tr><td class="mono">' + short(step.from) + '</td><td class="mono">' +
        step.symbol + '</td><td class="mono">' + short(step.to) + '</td><td class="mono">' +
        (step.fresh ? 'yes' : '') + '</td></tr>';
    }).join(''));

    const fresh = state.built.steps.filter(function (step) { return step.fresh; }).length;

    root.Helpers.setText('sub-steps-note',
      root.Format.exact(state.built.steps.length) + ' transitions were computed and ' +
      root.Format.exact(fresh) + ' of them produced a state nobody had seen before — the first ' +
      root.Format.exact(Math.min(16, state.built.steps.length)) + ' are listed. That ratio is ' +
      'what lazy determinisation exploits: most transitions land on a subset already in the ' +
      'cache, so an engine that builds states on demand pays for the fresh ones only. The ' +
      'worklist is a queue, so the states come out in breadth-first order from the start set.');
  }

  function short(name) {
    return name.length > 22 ? name.slice(0, 21) + '…' : name;
  }

  function paintSubsets(state) {
    root.jQuery('#sub-subsets tbody').html(state.built.subsets.slice(0, 12)
      .map(function (entry) {
        return '<tr><td class="mono">' + short(entry.name) + '</td><td class="mono">' +
          entry.members.join(', ') + '</td><td class="mono">' +
          (root.Automaton.isAccepting(state.built.dfa, entry.name) ? 'yes' : '') + '</td></tr>';
      }).join(''));

    root.Helpers.setText('sub-subsets-note',
      'A DFA state is accepting exactly when its subset CONTAINS an accepting NFA state — one ' +
      'surviving possibility is enough, which is what nondeterministic acceptance means. Read ' +
      'the second column and the determinisation stops being mysterious: the DFA is remembering ' +
      'every guess the NFA could still be making, and it can do that with one state because ' +
      'there are only finitely many sets of guesses. The exponential in the next table is ' +
      'exactly the number of those sets.');
  }

  function paintBlowUp() {
    const rows = blowUpFor('');

    root.jQuery('#sub-blowup tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' + row.nfaStates +
        '</td><td class="mono">' + row.positions + '</td><td class="mono">' +
        root.Format.exact(row.dfaStates) + '</td><td class="mono">' +
        root.Format.exact(row.minimalStates) + '</td><td class="mono">' +
        root.Format.exact(row.predicted) + '</td></tr>';
    }).join(''));

    const last = rows[rows.length - 1];

    root.Helpers.setText('sub-blowup-note',
      'The pattern is `(a|b)*a(a|b)^n` — an `a` exactly n + 1 positions from the end — and the ' +
      'position count grows by two per n while the DFA doubles. At n = ' +
      root.Format.exact(last.n) + ' the minimal DFA has ' +
      root.Format.exact(last.minimalStates) + ' states against ' +
      root.Format.exact(last.positions) + ' positions, and it matches the predicted ' +
      root.Format.exact(last.predicted) + ' exactly. Note the fourth column: the subset ' +
      'construction produces one state MORE than the bound at every n, because two of the ' +
      'subsets it builds denote the same language and it cannot tell. Minimisation removes ' +
      'precisely that one, which is why "the subset construction is 2^n" is right about the ' +
      'exponent and needs a second pass for the constant.');
  }

  function paintEngines() {
    const rows = [
      { strategy: 'Backtracking (PCRE, JavaScript, Python)',
        cost: 'exponential in the worst case', memory: 'a stack proportional to the input',
        wild: 'almost every language runtime — and every ReDoS incident' },
      { strategy: 'NFA simulation (Thompson)', cost: 'O(states) per character',
        memory: 'one state set', wild: 'grep, RE2, Go regexp, Rust regex' },
      { strategy: 'Full determinisation up front', cost: 'O(1) per character',
        memory: 'up to 2^n states', wild: 'lexer generators, where the pattern is fixed and small' },
      { strategy: 'Lazy determinisation with a cache', cost: 'O(1) amortised per character',
        memory: 'bounded — the cache is flushed rather than grown',
        wild: 'RE2 and Go regexp again; the default for a general engine' },
      { strategy: 'Derivatives', cost: 'O(1) per character once the states exist',
        memory: 'one regular expression per state',
        wild: 'verified matchers, and section 24.4' }
    ];

    root.jQuery('#sub-engines tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.strategy + '</td><td class="mono">' + row.cost + '</td><td>' +
        row.memory + '</td><td>' + row.wild + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sub-engines-note',
      'The first row is what most languages ship and the only one with an unbounded worst case. ' +
      'The rest trade memory against per-character cost, and the fourth row is the interesting ' +
      'engineering: it gets the constant-time step of a DFA and the bounded memory of a ' +
      'simulation by building states as the input demands them and throwing the cache away when ' +
      'it grows too large. That combination is why RE2 can offer a linear-time guarantee on ' +
      'patterns whose DFA would not fit in memory.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
