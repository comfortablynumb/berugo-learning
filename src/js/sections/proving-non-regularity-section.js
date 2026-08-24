/**
 * Section: proving a language is not regular.
 *
 * The pumping lemma is implemented as the game it is, because the quantifier
 * alternation is the part people get wrong: the adversary picks the pumping
 * length, the challenger picks a word, the adversary picks the decomposition,
 * and the challenger picks the exponent. The demo enumerates EVERY
 * decomposition the adversary may choose and reports how many survive, so
 * "every split fails" is a count rather than a hand-wave — and one survivor is
 * enough to lose the round, which the metric says plainly.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'proving-non-regularity';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the pumping lemma as a two-player game',
      caption: 'The lemma is a chain of alternating quantifiers, and reading it as a game is the ' +
        'only way most people keep them straight. The adversary moves first and picks the ' +
        'pumping length p, which you do not get to see before choosing. You then pick a word in ' +
        'the language of length at least p. The adversary decomposes it as xyz with |xy| ≤ p and ' +
        '|y| ≥ 1 — and they will pick the decomposition that is hardest for you. Finally you ' +
        'pick an exponent i, and you win if xy^i z is outside the language. You must beat EVERY ' +
        'decomposition; the adversary needs only one that survives.',
      definition: [
        'flowchart TD',
        '    A["adversary: picks p, the pumping length"] --> C["you: pick w in L with |w| ≥ p"]',
        '    C --> D["adversary: splits w = xyz, |xy| ≤ p, |y| ≥ 1"]',
        '    D --> E["you: pick i"]',
        '    E --> F{"is xy^i z outside L?"}',
        '    F -->|"yes, for EVERY split"| W["L is not regular"]',
        '    F -->|"no, for even ONE split"| N["the lemma proves nothing here"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The pumping lemma is a necessary condition, never a sufficient one.** Every regular ' +
        'language can be pumped; a language that can be pumped need not be regular. So it proves ' +
        'NO and never yes, and a failed pumping argument tells you nothing about the language.',
      '**The quantifiers alternate, and that is the whole difficulty.** For all p, there exists ' +
        'w, for all splits xyz, there exists i. You choose the word and the exponent; the ' +
        'adversary chooses the length and the split, and will choose the hardest one. The demo ' +
        'enumerates every split so "all of them" is a count.',
      '**One surviving split loses the round.** The demo reports survivors explicitly, because ' +
        'the common bad proof checks a convenient decomposition, finds it fails, and stops. That ' +
        'is not the statement; the statement quantifies over every decomposition the adversary ' +
        'may choose.',
      '**Choosing the word is where the skill is.** For `aⁿbⁿ` picking `aᵖbᵖ` forces the ' +
        'adversary to put y inside the run of a, because |xy| ≤ p — so pumping changes the count ' +
        'of a and not of b. A worse choice hands the adversary a split that survives.',
      '**Myhill–Nerode is the stronger tool and usually the easier one.** Exhibit an infinite ' +
        'family of prefixes no two of which can be followed by the same set of suffixes. Each ' +
        'would need its own state, and a finite automaton has finitely many, so the language is ' +
        'not regular.',
      '**And Myhill–Nerode works in the positive direction too.** When the family is finite, the ' +
        'classes ARE the states of the minimal automaton — the same computation that refuses the ' +
        'language also builds the machine. The pumping lemma only ever says no.',
      '**The demo runs both on a language that IS regular, and both correctly fail to refute ' +
        'it.** That is the control: a proof technique that "proves" a regular language ' +
        'non-regular is being misapplied, and seeing the tools decline is what makes the ' +
        'distinction concrete.',
      '**The classic non-regular languages all fail for the same reason.** `aⁿbⁿ`, palindromes, ' +
        'balanced brackets and square lengths each require remembering an unbounded quantity, ' +
        'and a finite state set cannot. Recognising the shape is faster than running either ' +
        'proof.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — play the pumping game, then build a distinguishing family',
        markup: root.NonRegularTemplate.render()
      },
      diagram: diagram(),
      insight: '**Myhill–Nerode also BUILDS the minimal automaton when the language is regular, ' +
        'so it is one tool that answers both questions. The pumping lemma only ever says no.** ' +
        'That asymmetry is the practical reason to reach for Myhill–Nerode first. Computing the ' +
        'equivalence classes of a language tells you immediately which case you are in: finitely ' +
        'many and you have the machine, with its states enumerated and its transitions implied; ' +
        'infinitely many and you have a proof of non-regularity, with the family as the witness. ' +
        'The pumping lemma has no positive branch at all, and a failed pumping argument leaves ' +
        'you exactly where you started.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.NonRegularTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const WORDS = {
    anbn: function (p) { return 'a'.repeat(p) + 'b'.repeat(p); },
    palindrome: function (p) { return 'a'.repeat(p) + 'b' + 'a'.repeat(p); },
    squares: function (p) { return 'a'.repeat(p * p); },
    'even-a': function (p) { return 'a'.repeat(2 * p); }
  };

  const FAMILIES = {
    anbn: function (i) { return { prefix: 'a'.repeat(i), suffix: 'b'.repeat(i) }; },
    palindrome: function (i) { return { prefix: 'a'.repeat(i) + 'b', suffix: 'a'.repeat(i) }; },
    squares: function (i) { return { prefix: 'a'.repeat(i * i), suffix: '' }; },
    'even-a': function (i) { return { prefix: 'a'.repeat(i), suffix: 'a'.repeat(i) }; }
  };

  const roundFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const entry = root.LanguageLab.entry(parts[0]);
    const pumpingLength = Number(parts[1]);
    const word = WORDS[parts[0]](pumpingLength);

    return { entry: entry, word: word, pumpingLength: pumpingLength,
      round: root.LanguageLab.pumpingRound({ word: word, pumpingLength: pumpingLength,
        accepts: entry.accepts, maxExponent: 3 }) };
  });

  const familyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const entry = root.LanguageLab.entry(parts[0]);
    const size = Number(parts[1]);
    const prefixes = [];
    const suffixes = [];

    for (let i = 1; i <= size; i += 1) {
      const pair = FAMILIES[parts[0]](i);

      prefixes.push(pair.prefix);
      if (suffixes.indexOf(pair.suffix) === -1) suffixes.push(pair.suffix);
    }
    return root.LanguageLab.distinguishingFamily({ prefixes: prefixes, suffixes: suffixes,
      accepts: entry.accepts });
  });

  function update() {
    const values = panel.values();
    const game = roundFor(values['nrg-language'] + '|' + values['nrg-pump']);
    const family = familyFor(values['nrg-language'] + '|' + values['nrg-family']);

    paintMetrics(game, family);
    paintRound(game, family);
    paintSplits(game);
    paintFamily(family);
    paintTools();
  }

  function paintMetrics(game, family) {
    const told = family.pairs.filter(function (row) { return row.suffix !== null; }).length;

    root.MetricGrid.update({
      'nrg-splits': { value: root.Format.exact(game.round.splits.length),
        note: 'for the word "' + game.word + '" with |xy| ≤ ' +
          root.Format.exact(game.pumpingLength) },
      'nrg-survivors': { value: root.Format.exact(game.round.survivors.length),
        note: game.round.everySplitLoses
          ? 'none — every decomposition can be pumped out of the language'
          : 'the lemma proves nothing here, because the adversary has a move' },
      'nrg-pairs': { value: root.Format.exact(told) + ' of ' +
        root.Format.exact(family.pairs.length),
      note: family.allDistinguished
        ? 'each pair needs its own state, and there are as many as you like'
        : 'some prefixes are interchangeable, so the family does not grow' },
      'nrg-verdict': { value: game.round.everySplitLoses && family.allDistinguished
        ? 'not regular' : 'no proof',
      note: game.round.everySplitLoses && family.allDistinguished
        ? 'both tools agree, and the second one also says how many states would be needed'
        : 'at least one tool declines, which is what should happen for a regular language' }
    });
  }

  function paintRound(game, family) {
    root.jQuery('#nrg-round').html(
      '<div class="mono" style="font-size:.85rem">adversary picks p = ' +
      root.Format.exact(game.pumpingLength) + '</div>' +
      '<div class="mono" style="font-size:.85rem">you pick w = "' + game.word + '", |w| = ' +
      root.Format.exact(game.word.length) + '</div>' +
      '<div class="mono" style="font-size:.85rem">adversary has ' +
      root.Format.exact(game.round.splits.length) + ' decompositions</div>' +
      '<div class="mono" style="font-size:.9rem;margin-top:.4rem">' +
      (game.round.everySplitLoses ? 'every one of them can be pumped out — you win'
        : root.Format.exact(game.round.survivors.length) +
          ' survive pumping — the lemma proves nothing') + '</div>');

    root.Helpers.setText('nrg-round-note',
      'The word is chosen for you here, and the choice is the skill the lemma actually requires: ' +
      '"' + game.word + '" pins the adversary down because |xy| ≤ ' +
      root.Format.exact(game.pumpingLength) + ' forces y into the opening run, so pumping it ' +
      'changes one count and not the other. ' +
      (family.allDistinguished
        ? 'The Myhill–Nerode family below reaches the same conclusion with no case analysis at ' +
          'all — it exhibits ' + root.Format.exact(family.prefixes.length) +
          ' prefixes that pairwise need different states, and the family extends as far as you ' +
          'like.'
        : 'The Myhill–Nerode family below finds prefixes that are interchangeable, which is what ' +
          'happens when the language is regular: the family stops growing at the number of ' +
          'states.'));
  }

  function paintSplits(game) {
    root.jQuery('#nrg-splits-table tbody').html(game.round.splits.slice(0, 12)
      .map(function (entry) {
        return '<tr><td class="mono">' + (entry.split.x === '' ? 'ε' : entry.split.x) +
          '</td><td class="mono">' + entry.split.y + '</td><td class="mono">' +
          (entry.split.z === '' ? 'ε' : entry.split.z) + '</td><td class="mono">' +
          (entry.escape === null ? '—' : 'i = ' + entry.escape.exponent + ': "' +
            (entry.escape.word === '' ? 'ε' : entry.escape.word) + '"') +
          '</td><td class="mono">' + (entry.escape === null ? 'NO — survives' : 'yes') +
          '</td></tr>';
      }).join(''));

    root.Helpers.setText('nrg-splits-caption',
      'All ' + root.Format.exact(game.round.splits.length) + ' decompositions with |xy| ≤ ' +
      root.Format.exact(game.pumpingLength) + ' and |y| ≥ 1, and the exponent that defeats each ' +
      'one. This table is the part a written proof compresses into "without loss of generality", ' +
      'and compressing it is where bad proofs come from — the claim is about EVERY row, and ' +
      'checking one convenient row is the most common error in the whole subject. Note that ' +
      'i = 0 works as often as i = 2: deleting y is pumping too, and it is frequently the easier ' +
      'move.');
  }

  function paintFamily(family) {
    root.jQuery('#nrg-family-table tbody').html(family.pairs.slice(0, 12).map(function (row) {
      return '<tr><td class="mono">' + (row.left === '' ? 'ε' : row.left) +
        '</td><td class="mono">' + (row.right === '' ? 'ε' : row.right) +
        '</td><td class="mono">' + (row.suffix === null ? 'NOTHING — same state'
          : (row.suffix === '' ? 'ε' : row.suffix)) + '</td><td class="mono">' +
        (row.suffix === null ? '—' : (row.leftAccepts ? row.left : row.right)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('nrg-family-caption',
      root.Format.exact(family.prefixes.length) + ' prefixes give ' +
      root.Format.exact(family.pairs.length) + ' pairs, and ' +
      (family.allDistinguished
        ? 'every one has a witness suffix that one prefix survives and the other does not. Any ' +
          'machine recognising this language must therefore have at least ' +
          root.Format.exact(family.prefixes.length) + ' states — and the family extends to any ' +
          'size, so no finite number is enough. That is the proof, and it needed no case ' +
          'analysis and no adversary.'
        : 'some pairs have none, which means those prefixes are the SAME state. That is exactly ' +
          'what happens when the language is regular: the family stops growing at the number of ' +
          'states in the minimal machine, and the classes it found are that machine.'));
  }

  function paintTools() {
    const rows = [
      { tool: 'Pumping lemma', proves: 'that a language is NOT regular',
        cannot: 'that a language IS regular — every regular language pumps, and so do some ' +
          'others', mistake: 'checking one convenient decomposition instead of all of them' },
      { tool: 'Myhill–Nerode (infinite family)', proves: 'that a language is NOT regular',
        cannot: 'nothing it is asked — it is complete in both directions',
        mistake: 'picking a family whose members are not actually distinguishable' },
      { tool: 'Myhill–Nerode (finite classes)', proves: 'that a language IS regular, AND builds ' +
        'the minimal machine', cannot: 'be run to completion when the classes are infinite',
      mistake: 'testing suffixes only up to a bound and concluding from a sample' },
      { tool: 'Closure properties', proves: 'non-regularity by reduction — if L ∩ a*b* is not ' +
        'regular then neither is L', cannot: 'be applied without a known non-regular language ' +
        'to reduce to', mistake: 'using an operation the class is not closed under' },
      { tool: 'Exhibiting a DFA', proves: 'that a language IS regular, constructively',
        cannot: 'say anything when you fail to find one',
        mistake: 'concluding non-regularity from "I could not build a machine"' }
    ];

    root.jQuery('#nrg-tools tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.tool + '</td><td>' + row.proves + '</td><td>' + row.cannot +
        '</td><td>' + row.mistake + '</td></tr>';
    }).join(''));

    root.Helpers.setText('nrg-tools-note',
      'The second column has two entries that say IS and three that say NOT, and mixing them up ' +
      'is the recurring error. The last row is the one worth stating plainly: failing to find a ' +
      'DFA proves nothing at all, and yet "I tried and could not" is how most people conclude a ' +
      'language is not regular. The middle rows are the honest alternatives — one of them ' +
      'answers both questions and is the tool to reach for first.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
