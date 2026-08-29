/**
 * Section: Combinational logic design and minimisation.
 *
 * The pipeline on this page is the real one: a truth table becomes prime
 * implicants, the prime implicants become a cover, the cover becomes a netlist,
 * and the netlist is simulated. Every stage is checked against the stage before
 * it — the cover is evaluated back against the original minterms, and the
 * greedy answer is checked against an exhaustive search rather than asserted to
 * be minimal.
 *
 * The hazard table is the reason this section runs the simulator at all. A
 * cover can agree with the truth table on every row and still glitch during a
 * transition between two of them, and the only way to show that honestly is to
 * simulate the transition with per-gate delays and report what came out.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'logic-minimisation';
  const Min = root.BooleanMin;
  const Sim = root.LogicSim;
  const TwoLevel = root.Blocks.TwoLevel;
  const GRAY = [0, 1, 3, 2];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the path from a table to gates, and what each step may lose',
      caption: 'Two-level minimisation is four mechanical steps, and each one has a failure '
        + 'mode worth naming. Combining pairs of minterms produces prime implicants — terms '
        + 'that cannot be grown further — and that step is exact. Choosing which of them to '
        + 'keep is a set-cover problem, which is NP-hard, so every production tool is greedy '
        + 'and every greedy answer can be beaten. Turning the chosen terms into gates is exact '
        + 'again. And the last arrow is the one people forget: the netlist is correct on every '
        + 'row of the table and can still glitch between two of them, because minimisation '
        + 'removed the redundant term that held the output up during the switch.',
      definition: [
        'flowchart TD',
        'T["truth table<br/>the specification"] --> P["prime implicants<br/>exact, by repeated merging"]',
        'P --> C["cover selection<br/>set cover: NP-hard, so greedy in practice"]',
        'C --> N["two-level netlist<br/>AND array, then OR"]',
        'N --> S["simulation with delays"]',
        'C -.->|"drops redundant terms"| H["static hazards"]',
        'H -.->|"add the term back"| N',
        'S -.->|"checks the netlist against the table"| T'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A prime implicant is a product term that cannot be made any larger.** Start from the '
        + 'rows where the output is 1, merge any two that differ in exactly one variable — '
        + 'replacing that variable with a dash — and repeat until nothing merges. What is left '
        + 'unmerged is prime. This step is exact and cheap, and it is the half of minimisation '
        + 'that has no judgement in it.',
      '**Choosing which primes to keep is set cover, and set cover is NP-hard.** Every row that '
        + 'must be 1 has to be covered by at least one chosen term, and you want the fewest '
        + 'terms and the fewest literals. The demo runs both answers: the greedy one everybody '
        + 'ships and an exhaustive search over every subset of the primes, so "minimal" is a '
        + 'measurement rather than a claim.',
      '**An essential prime implicant is forced, and it is what makes greedy usually fine.** If '
        + 'a row is covered by exactly one prime, that prime is in every cover, so it can be '
        + 'taken without thought. On most real functions the essentials cover almost everything '
        + 'and greedy has little left to get wrong — the `trap` function in the demo has no '
        + 'essentials at all, which is exactly when it loses.',
      '**Don\'t-cares are free minimisation, and they are why specifications should be partial.** '
        + 'A row the specification does not constrain can be included in a term when that makes '
        + 'the term bigger and excluded when it does not. The demo\'s `dontCares` function has '
        + 'three such rows; they cost nothing and they shrink the cover, which is the argument '
        + 'for writing a specification that says only what it means.',
      '**A Karnaugh map is a truth table laid out so that adjacency is visible.** The rows and '
        + 'columns are in Gray-code order, so neighbouring cells differ in exactly one variable '
        + 'and a mergeable pair is literally next to each other. It is a human interface to the '
        + 'same merging the algorithm does, it stops working past four or five variables, and '
        + 'the algorithm does not.',
      '**Quine–McCluskey is the algorithm, espresso is what runs in production.** The exact '
        + 'method is exponential in the number of variables and the number of primes; real '
        + 'synthesis uses heuristics (expand, irredundant, reduce) that do not guarantee the '
        + 'minimum and finish on functions with a hundred inputs. The demo shows the exact '
        + 'answer because it can, and reports when it refuses.',
      '**A static hazard is a correct circuit with a wrong waveform.** When two adjacent rows '
        + 'are covered by different terms and no single term covers both, the variable that '
        + 'changes turns one term off before the other turns on, and the output dips for a few '
        + 'gate delays. The fix is to add back the redundant term that covers the pair — the '
        + 'term minimisation just removed.',
      '**Whether that glitch matters depends on what is downstream.** Into a flip-flop that '
        + 'samples once per clock, a dip that settles before the edge is invisible, which is why '
        + 'synchronous design tolerates hazards. Into an asynchronous latch, a clock line or a '
        + 'reset, the same dip is a fault — so hazard-free covers are a real requirement in '
        + 'exactly the places where the clock is not there to save you.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — minimise, build, and then simulate the result',
        markup: root.LogicMinTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Minimisation is a set-cover problem wearing a hardware costume, and the reason it '
      + 'is worth understanding is that the same shape turns up everywhere you are choosing a '
      + 'small set of things to cover a large set of requirements.** Test selection, index '
      + 'selection in a database, cache-line packing, choosing which feature flags to keep — '
      + 'all of them are "cover every requirement with the fewest items", all of them are '
      + 'NP-hard, and all of them are solved in practice by taking the forced choices first and '
      + 'then being greedy. The `trap` function in the demo is the miniature version of why '
      + 'that occasionally goes wrong: when nothing is forced, greedy picks a large term early '
      + 'and then needs extra terms to mop up what it left, and the cheapest answer uses no '
      + 'large term at all. The second lesson is the hazard, and it generalises further. A '
      + 'transformation that preserves the specified behaviour can still change unspecified '
      + 'behaviour, and somebody downstream may depend on it. That is the same failure as a '
      + 'compiler optimisation that preserves single-threaded semantics and breaks a lock-free '
      + 'algorithm, or a refactor that preserves the return value and changes the timing. The '
      + 'specification said what the answer is; it did not say what happens on the way there.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.LogicMinTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  /* ------------------------------------------------------- building gates */

  function netFor(terms, names) {
    return TwoLevel.netFor(terms, names);
  }

  function valuesOf(mask, names) {
    return TwoLevel.valuesOf(mask, names);
  }

  /* ---------------------------------------------------------- the measure */

  const studyFor = root.Helpers.memoise(function (key) {
    const spec = root.LogicMinTemplate.FUNCTIONS[key];
    const greedy = Min.greedyCover(spec.minterms, spec.dontCares, spec.bits);
    const exact = Min.minimumCover(spec.minterms, spec.dontCares, spec.bits);
    const canonical = spec.minterms.map(function (mask) {
      return Min.termOf(mask, spec.bits);
    });

    return { spec: spec, greedy: greedy, exact: exact, canonical: canonical,
      hazards: Min.hazards(greedy.terms, spec.minterms, spec.bits) };
  });

  /** Every cover on this page is measured the same way, so the comparison
   *  table and the metrics cannot disagree about what a cover costs. */
  const costOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const spec = root.LogicMinTemplate.FUNCTIONS[parts.fn];
    const net = netFor(parts.terms, spec.names);
    const check = Min.agrees(parts.terms, spec.minterms, spec.dontCares, spec.bits);

    return { terms: parts.terms.length, literals: literalsOf(parts.terms),
      gates: Sim.gateCount(net), depth: Sim.criticalPath(net).delay,
      transistors: Sim.transistorCount(net), ok: check.ok, net: net,
      glitches: glitchesOf(net, spec) };
  });

  function literalsOf(terms) {
    return TwoLevel.literalsOf(terms);
  }

  /** Simulate every adjacent pair of ones and report which transitions make
   *  the output leave and return — which is what a static hazard IS. */
  function glitchesOf(net, spec) {
    return Min.hazards(canonicalTerms(spec), spec.minterms, spec.bits)
      .map(function (pair) { return bothWays(net, spec, pair); });
  }

  /** Both directions, because a static hazard is not symmetric: the term
   *  switching on may be the slower one in one direction and the faster one in
   *  the other, and measuring only the rising edge finds nothing. */
  function bothWays(net, spec, pair) {
    const low = valuesOf(pair.from, spec.names);
    const high = valuesOf(pair.to, spec.names);
    const up = Sim.transition(net, low, high, {});
    const down = Sim.transition(net, high, low, {});
    const which = [];

    if (up.outputGlitches.length) which.push('rising');
    if (down.outputGlitches.length) which.push('falling');
    return { pair: pair, glitched: which.length > 0, which: which.join(' and '),
      settleTime: Math.max(up.settleTime, down.settleTime) };
  }

  /** The canonical cover has one term per minterm, so `hazards` on it lists
   *  every adjacent pair of ones — the complete set of places a cover COULD
   *  glitch, independent of which cover is on screen. */
  function canonicalTerms(spec) {
    return spec.minterms.map(function (mask) { return Min.termOf(mask, spec.bits); });
  }

  function chosenTerms(key, method, redundant) {
    const study = studyFor(key);
    const base = method === 'exact' && study.exact.terms
      ? study.exact.terms : study.greedy.terms;

    if (!redundant) return base;
    const extra = Min.hazards(base, study.spec.minterms, study.spec.bits)
      .map(function (row) { return row.fix; })
      .filter(function (term) { return base.indexOf(term) === -1; });

    return base.concat(unique(extra)).sort();
  }

  function unique(list) {
    return list.filter(function (item, at) { return list.indexOf(item) === at; });
  }

  function reading() {
    const values = panel.values();
    const key = values['qmc-function'];
    const terms = chosenTerms(key, values['qmc-cover'], values['qmc-redundant']);

    return { key: key, study: studyFor(key), terms: terms,
      cost: costOf(JSON.stringify({ fn: key, terms: terms })) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    setMetrics(view);
    paintKmap(view);
    paintChartTable(view);
    paintCompare(view);
    paintHazards(view);
    paintFlow(view);
    paintChart(app);
  }

  function setMetrics(view) {
    const spec = view.study.spec;

    root.Helpers.setText('qmc-minterms', spec.minterms.length + ' of ' +
      Math.pow(2, spec.bits) + (spec.dontCares.length
      ? ' · ' + spec.dontCares.length + " don't-care" : ' · no don\'t-cares'));
    root.Helpers.setText('qmc-primes', String(view.study.greedy.primes.length));
    root.Helpers.setText('qmc-essential', view.study.greedy.essential.length + ' of ' +
      view.study.greedy.primes.length);
    root.Helpers.setText('qmc-terms', view.cost.terms + ' · ' + view.cost.literals +
      ' literals');
    root.Helpers.setText('qmc-gates', view.cost.gates + ' · depth ' + view.cost.depth);
    root.Helpers.setText('qmc-glitch', view.cost.glitches.filter(function (row) {
      return row.glitched;
    }).length + ' of ' + view.cost.glitches.length + ' adjacent pairs');
  }

  function kmapSplit(bits) {
    return bits <= 3 ? { high: bits - 2, low: 2 } : { high: 2, low: bits - 2 };
  }

  function grayOf(width) {
    if (width === 1) return [0, 1];
    if (width === 2) return GRAY;
    return [0, 1, 3, 2, 6, 7, 5, 4];
  }

  function cellText(mask, spec, terms) {
    const isOne = spec.minterms.indexOf(mask) !== -1;
    const isFree = spec.dontCares.indexOf(mask) !== -1;
    const covered = terms.filter(function (term) {
      return Min.covers(term, mask, spec.bits);
    }).length;

    if (isFree) return 'x' + (covered ? ' (in ' + covered + ')' : '');
    if (!isOne) return '0';
    return '1 (in ' + covered + ')';
  }

  function paintKmap(view) {
    const spec = view.study.spec;
    const split = kmapSplit(spec.bits);
    const rows = grayOf(split.high);
    const cols = grayOf(split.low);
    const head = spec.names.slice(0, split.high).join('') + ' \\ ' +
      spec.names.slice(split.high).join('');

    root.jQuery('#qmc-kmap thead tr').html('<th>' + head + '</th>' + cols.map(function (col) {
      return '<th>' + bin(col, split.low) + '</th>';
    }).join(''));
    fill('qmc-kmap', rows.map(function (row) {
      return [bin(row, split.high)].concat(cols.map(function (col) {
        return cellText((row << split.low) | col, spec, view.terms);
      }));
    }));
    root.Helpers.setText('qmc-kmap-caption', kmapCaption(view, rows.length, cols.length));
  }

  function bin(value, width) {
    let text = '';

    for (let at = width - 1; at >= 0; at -= 1) text += (value >> at) & 1;
    return text;
  }

  function kmapCaption(view, rows, cols) {
    return 'The same truth table, in Gray-code order so that any two neighbouring cells — '
      + 'including across the edges, which wrap — differ in exactly one variable. Each 1 says '
      + 'how many of the ' + view.cost.terms + ' chosen terms cover it; a cell covered by two '
      + 'terms is where the cover overlaps, and a pair of adjacent ones covered by no common '
      + 'term is a static hazard. This map is ' + rows + ' by ' + cols + ', which is why the '
      + 'technique stops at four variables and the algorithm does not.';
  }

  function paintChartTable(view) {
    const spec = view.study.spec;

    fill('qmc-chart-table', view.study.greedy.chart.map(function (row) {
      return [row.term, Min.expression([row.term], spec.names),
        row.covers.join(', ') || '—',
        view.study.greedy.essential.indexOf(row.term) !== -1 ? 'yes — forced' : 'no',
        view.terms.indexOf(row.term) !== -1 ? 'yes' : 'no'];
    }));
    root.Helpers.setText('qmc-chart-table-caption', 'Every prime implicant, what it covers, '
      + 'and whether it is forced. A row is essential when some minterm is covered by it and '
      + 'by nothing else, so it appears in every possible cover — ' +
      view.study.greedy.essential.length + ' of these ' + view.study.greedy.primes.length +
      ' are. Selection only has real work to do on what the essentials leave behind.');
  }

  function comparisonRows(view) {
    const key = view.key;
    const study = view.study;
    const rows = [row('canonical sum of products', study.canonical, key),
      row('essentials, then greedy', study.greedy.terms, key)];

    if (study.exact.terms) rows.push(row('exhaustive minimum', study.exact.terms, key));
    else rows.push(['exhaustive minimum', 'skipped', study.exact.primes + ' primes is past the '
      + 'search limit', '—', '—', '—']);
    return rows;
  }

  function row(label, terms, key) {
    const cost = costOf(JSON.stringify({ fn: key, terms: terms }));

    return [label, String(cost.terms), String(cost.literals), String(cost.gates),
      String(cost.depth), cost.ok ? 'yes, on every row' : 'NO — cover disagrees'];
  }

  function paintCompare(view) {
    fill('qmc-compare', comparisonRows(view));
    root.Helpers.setText('qmc-compare-caption', compareCaption(view));
  }

  function compareCaption(view) {
    const study = view.study;
    const key = view.key;

    if (!study.exact.terms) {
      return 'The exhaustive search refused this one: it walks every subset of the primes, '
        + 'which is 2 to the power of ' + study.exact.primes + ' here.';
    }
    const greedy = costOf(JSON.stringify({ fn: key, terms: study.greedy.terms }));
    const exact = costOf(JSON.stringify({ fn: key, terms: study.exact.terms }));
    const verdict = greedy.literals === exact.literals
      ? 'the greedy answer is the minimum here, which is the usual outcome'
      : 'greedy loses by ' + (greedy.literals - exact.literals) + ' literals and ' +
        (greedy.terms - exact.terms) + ' term(s), which is why "minimal" needs a search';

    return 'Three covers of the same function, each rebuilt as gates and each checked back '
      + 'against the truth table. The exhaustive row searched ' + study.exact.searched +
      ' subsets of ' + study.exact.primes + ' primes: ' + verdict + '.';
  }

  function paintHazards(view) {
    const spec = view.study.spec;
    const rows = view.cost.glitches.map(function (entry) {
      return [spec.names.join('') + '=' + bin(entry.pair.from, spec.bits) + ' → ' +
        bin(entry.pair.to, spec.bits), spec.names[entry.pair.variable],
      Min.expression([entry.pair.fix], spec.names),
      entry.glitched ? 'yes, on the ' + entry.which + ' edge — settles at ' + entry.settleTime
        : 'no'];
    });

    fill('qmc-hazards', rows.length ? rows
      : [['no two ones are adjacent', '—', '—', 'nothing to glitch']]);
    root.Helpers.setText('qmc-hazards-caption', hazardCaption(view));
  }

  function hazardCaption(view) {
    const bad = view.cost.glitches.filter(function (entry) { return entry.glitched; }).length;

    if (!view.cost.glitches.length) {
      return 'This function has no two adjacent rows that are both 1 — which is exactly why '
        + 'nothing merged in the minimisation either. No adjacency means no merging and no '
        + 'static hazard: the two facts have the same cause.';
    }
    return 'Every pair of adjacent rows where the output is 1 in both, simulated as a real '
      + 'transition with per-gate delays. ' + bad + ' of ' + view.cost.glitches.length +
      ' of them make this netlist dip, and the fix column is the redundant term that covers '
      + 'the pair — the term minimisation removed because it was not needed for correctness. '
      + 'Tick the redundant-terms box and the same simulation reports no glitch, at the price '
      + 'of the extra gates in the metrics above.';
  }

  function paintFlow(view) {
    fill('qmc-flow', [
      ['merge into prime implicants', 'the minterms and don\'t-cares',
        view.study.greedy.primes.length + ' primes',
        'nothing: the merge is exact and terminates'],
      ['find the essentials', 'the prime implicant chart',
        view.study.greedy.essential.length + ' forced terms',
        'nothing, but there may be none of them — see the trap function'],
      ['cover the rest', 'the rows the essentials missed', view.cost.terms + ' terms total',
        'greedy can overshoot; this is the NP-hard step'],
      ['build the netlist', 'the chosen terms',
        view.cost.gates + ' gates at depth ' + view.cost.depth,
        'nothing, but fan-in limits turn wide ANDs into trees'],
      ['simulate the transitions', 'the netlist and a pair of input vectors',
        view.cost.glitches.filter(function (e) { return e.glitched; }).length + ' glitching',
        'this is where minimisation\'s cost shows up, and it is invisible in the table']
    ]);
    root.Helpers.setText('qmc-flow-caption', 'The whole flow as the demo runs it, with the '
      + 'numbers for the function currently selected. Only one of these five steps is hard, '
      + 'and only one of them can produce a circuit that is right on paper and wrong on a '
      + 'scope.');
  }

  function paintChart(app) {
    const host = root.jQuery('#qmc-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, yLabel: 'literals in the cover',
      values: chartValues()
    });
    root.Helpers.setText('qmc-chart-note', chartNote());
  }

  function chartValues() {
    const out = [];

    Object.keys(root.LogicMinTemplate.FUNCTIONS).forEach(function (key) {
      const study = studyFor(key);

      out.push({ label: key + ' · canonical', value: literalsOf(study.canonical), series: 0 });
      out.push({ label: key + ' · greedy', value: literalsOf(study.greedy.terms), series: 1 });
      if (study.exact.terms) {
        out.push({ label: key + ' · minimum', value: literalsOf(study.exact.terms), series: 2 });
      }
    });
    return out;
  }

  function chartNote() {
    const parity = studyFor('parity');
    const trap = studyFor('trap');

    return 'Three bars per function: the canonical sum of products, the greedy cover and the '
      + 'exhaustive minimum. Parity is the one to read twice — ' +
      literalsOf(parity.canonical) + ' literals canonically and ' +
      literalsOf(parity.greedy.terms) + ' after minimisation, because no two of its minterms '
      + 'are adjacent and nothing merges. The trap function is the other end: greedy gets ' +
      literalsOf(trap.greedy.terms) + ' literals where the minimum is ' +
      literalsOf(trap.exact.terms) + '.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
