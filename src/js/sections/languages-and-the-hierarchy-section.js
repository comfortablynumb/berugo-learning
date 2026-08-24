/**
 * Section: languages and the Chomsky hierarchy.
 *
 * The measurement is the agreement column. For each language the demo runs the
 * real recogniser over every string up to a bound, and where the language is
 * regular it ALSO runs a finite automaton and compares them string by string.
 * "This one is regular" then means "a finite automaton agreed on all 127
 * strings", which is a check rather than a claim; where no automaton is
 * offered, the section says which machine is needed and why.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'languages-and-the-hierarchy';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — four nested classes, one machine each',
      caption: 'Each class contains the one before it, and each step out adds exactly one kind ' +
        'of memory. A finite automaton has a fixed number of states and therefore a bounded ' +
        'amount of memory: it can count modulo k and cannot count to n. A stack lifts that and ' +
        'gives you matched pairs, which is why parsers and not tokenisers handle nesting. A tape ' +
        'bounded by the input length gives you two counts at once. An unbounded tape gives you ' +
        'everything computable — and with it, problems no machine decides at all. The names on ' +
        'the right are where each level shows up in tooling.',
      definition: [
        'flowchart TD',
        '    RE["recursively enumerable — Turing machine<br/>interpreters, type inference in some languages"]',
        '    CS["context-sensitive — linear-bounded automaton<br/>aⁿbⁿcⁿ, most type checkers"]',
        '    CF["context-free — pushdown automaton<br/>parsers, JSON, nesting"]',
        '    REG["regular — finite automaton<br/>regex, lexers, protocol state machines"]',
        '    RE --> CS --> CF --> REG',
        '    U["undecidable — no machine<br/>halting, equivalence of programs"] --> RE'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A language is a set of strings, and that is the whole definition.** Alphabets give the ' +
        'symbols, concatenation and Kleene star build longer strings from shorter ones, and a ' +
        'language is any set of them. The interesting question is never what a language *is*, it ' +
        'is which machine is strong enough to decide membership.',
      '**The hierarchy is about MEMORY, not about difficulty.** A finite automaton has a fixed ' +
        'number of states, so it remembers a bounded amount however long the input is. A ' +
        'pushdown automaton adds a stack. A linear-bounded automaton gets a tape as long as the ' +
        'input. A Turing machine gets an unbounded one. Each step is one new kind of memory.',
      '**"Can a regex do this" has a precise answer.** If the property needs to count to an ' +
        'unbounded n — matching brackets, equal runs, well-formed nesting — a finite automaton ' +
        'cannot, because n exceeds any fixed number of states. That is the boundary between a ' +
        'five-line tokeniser and a parser, and knowing where it sits ends the argument.',
      '**Regular is the level almost all your tools live at.** Every regex without ' +
        'backreferences, every lexer, every protocol state machine and every UI statechart is a ' +
        'finite automaton. That is why this milestone is the practical one: the theory is about ' +
        'the objects you already use daily under other names.',
      '**The demo checks the classification rather than asserting it.** For each language it ' +
        'runs a real recogniser over every string up to a bound, and for the regular ones it runs ' +
        'a finite automaton alongside and compares them string by string. Agreement is the ' +
        'evidence; a disagreement would mean the classification is wrong.',
      '**`aⁿbⁿ` and `a*b*` look almost the same and are on opposite sides of the line.** Both ' +
        'are a run of `a` followed by a run of `b`. Only one requires remembering how long the ' +
        'first run was, and that is the entire difference — a fixed number of states cannot hold ' +
        'an unbounded number.',
      '**Closure properties differ by level and that is practical.** Regular languages are ' +
        'closed under intersection and complement, which is why "does this rule allow anything ' +
        'the old one did not" is decidable for regexes. Context-free languages are not closed ' +
        'under intersection, which is why the same question about grammars is undecidable.',
      '**Undecidable is a fifth category and it is not "very hard".** No machine decides whether ' +
        'a program halts on its own source, at any budget. M26 proves it; here it is the last ' +
        'row of the catalogue, and the demo has no recogniser to offer for it because none ' +
        'exists.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — pick a language and see which machine is enough',
        markup: root.HierarchyTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Can a regex do this" has a precise answer, and it is the difference between a ' +
        'five-line tokeniser and a parser. Knowing where the boundary sits saves the argument.** ' +
        'The test is one question: does the property require remembering an unbounded count? ' +
        'Matching brackets does, so no regular expression matches balanced parentheses however ' +
        'clever it looks — and the ones that appear to are using backreferences or recursion, ' +
        'which are extensions that leave the class entirely. Recognising that in a design review ' +
        'turns a taste argument into a fact, and it points at the right tool: a parser, a ' +
        'counter, or a restructured input format that does not need either.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HierarchyTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return root.LanguageLab.study(parts[0], Number(parts[1]));
  });

  function update() {
    const values = panel.values();
    const study = studyFor(values['hier-language'] + '|' + values['hier-length']);

    paintMetrics(study);
    paintVerdict(study);
    paintRun(study);
    paintCatalogue();
    paintLevels();
  }

  function paintMetrics(study) {
    const agrees = study.machineAgrees;

    root.MetricGrid.update({
      'hier-class': { value: study.row.klass, note: study.row.description },
      'hier-machine': { value: study.row.machine.split(',')[0], note: study.row.why },
      'hier-accepted': { value: root.Format.exact(study.accepted.length) + ' of ' +
        root.Format.exact(study.tested),
      note: study.tested === 0
        ? 'no recogniser exists for this one, at any budget'
        : 'over the alphabet {' + study.alphabet.join(', ') + '}' },
      'hier-agrees': { value: agrees === null ? 'no automaton offered'
        : (agrees.agrees ? 'yes' : 'NO'),
      note: agrees === null
        ? 'a finite automaton cannot recognise this language, so none is run'
        : root.Format.exact(agrees.states) + '-state automaton, ' +
          root.Format.exact(agrees.disagreements) + ' disagreements' }
    });
  }

  function paintVerdict(study) {
    root.jQuery('#hier-verdict').html(
      '<div class="mono" style="font-size:.95rem">' +
      root.Helpers.escapeHtml(study.row.description) + '</div>' +
      '<div class="mono" style="font-size:.85rem;margin-top:.4rem">' +
      root.Helpers.escapeHtml(study.row.machine) + '</div>');

    root.Helpers.setText('hier-verdict-note',
      study.row.why.charAt(0).toUpperCase() + study.row.why.slice(1) + '. ' +
      (study.machineAgrees
        ? 'A finite automaton with ' + root.Format.exact(study.machineAgrees.states) +
          ' states was run over all ' + root.Format.exact(study.tested) +
          ' strings alongside the definition and disagreed on ' +
          root.Format.exact(study.machineAgrees.disagreements) + ' of them, which is what ' +
          '"this language is regular" means as a check rather than a claim.'
        : study.tested === 0
          ? 'There is no recogniser to run, and that is not a budget problem: no machine of any ' +
            'kind decides this, which M26 proves rather than asserts.'
          : 'No finite automaton is offered, because none exists. The recogniser run below is ' +
            'the definition evaluated directly, and the machine column says what a real ' +
            'implementation would need.'));
  }

  function paintRun(study) {
    const machine = study.machineAgrees
      ? root.RegexCompile.thompson(study.row.pattern, study.alphabet) : null;
    const words = root.Automaton.strings(study.alphabet, 3).slice(0, 14);

    root.jQuery('#hier-run tbody').html(words.map(function (word) {
      const inLanguage = study.row.accepts ? study.row.accepts(word) : null;
      const byMachine = machine ? root.Automaton.accepts(machine, word) : null;

      return '<tr><td class="mono">' + (word === '' ? 'ε' : word) + '</td><td class="mono">' +
        (inLanguage === null ? '—' : (inLanguage ? 'yes' : 'no')) + '</td><td class="mono">' +
        (byMachine === null ? '—' : (byMachine ? 'yes' : 'no')) + '</td><td class="mono">' +
        (byMachine === null ? '—' : (byMachine === inLanguage ? 'yes' : 'NO')) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hier-run-note',
      'The first ' + root.Format.exact(words.length) + ' strings in shortlex order, with the ' +
      'definition in one column and the machine in the next. The full run covers ' +
      root.Format.exact(study.tested) + ' strings and accepts ' +
      root.Format.exact(study.accepted.length) + ' of them. The last column is the whole point ' +
      'of the section: where it can be filled in at all, a finite automaton is enough, and where ' +
      'it is dashes, the language needs a machine with unbounded memory and no amount of state ' +
      'design will substitute.');
  }

  function paintCatalogue() {
    root.jQuery('#hier-catalogue tbody').html(root.LanguageLab.catalogue().map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.description) + '</td><td>' + row.klass +
        '</td><td>' + row.machine + '</td><td>' + row.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hier-catalogue-note',
      'Read the last column down the table and the hierarchy assembles itself. The first three ' +
      'rows need a bounded amount of memory — a parity bit, three characters, a remainder — and ' +
      'a fixed number of states holds any of those. The next two need a count that grows with ' +
      'the input, which is a stack. The two after that need two such counts at once, which one ' +
      'stack cannot give. And the last needs something that does not exist. Nothing in the ' +
      'column is about how complicated the language looks; it is about how much has to be ' +
      'carried.');
  }

  function paintLevels() {
    const rows = [
      { klass: 'Regular', machine: 'finite automaton',
        closed: 'union, intersection, complement, concatenation, star, reversal',
        wild: 'regexes, lexers, protocol state machines, UI statecharts, ReDoS analysis' },
      { klass: 'Context-free', machine: 'pushdown automaton',
        closed: 'union, concatenation, star — NOT intersection or complement',
        wild: 'parsers, JSON and XML, expression grammars, the whole of M25' },
      { klass: 'Context-sensitive', machine: 'linear-bounded automaton',
        closed: 'union, intersection, complement, concatenation, star',
        wild: 'most static type systems, and aⁿbⁿcⁿ-shaped agreement constraints' },
      { klass: 'Recursively enumerable', machine: 'Turing machine',
        closed: 'union, intersection, concatenation, star — NOT complement',
        wild: 'interpreters, and any property you can confirm but not refute' },
      { klass: 'Undecidable', machine: 'none',
        closed: 'not applicable — there is no decider to close anything under',
        wild: 'halting, program equivalence, and most questions about programs' }
    ];

    root.jQuery('#hier-levels tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.klass + '</td><td>' + row.machine + '</td><td>' + row.closed +
        '</td><td>' + row.wild + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hier-levels-note',
      'The third column is the one with practical consequences, and the difference between the ' +
      'first two rows is the largest of them. Regular languages are closed under intersection ' +
      'and complement, so "does regex A match anything regex B does not" is a construction you ' +
      'can run — which section 24.6 does. Context-free languages are not, and the same question ' +
      'about two grammars is undecidable. That is why a firewall rule set expressed as patterns ' +
      'can be checked for containment and one expressed as a grammar cannot.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
