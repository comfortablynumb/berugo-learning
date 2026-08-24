/**
 * Section: online algorithms and competitive analysis.
 *
 * The demo measures a theorem rather than restating it. The break-even rule —
 * rent until you have spent what buying costs, then buy — attains 2 − 1/B
 * EXACTLY at every purchase price, and the season length that produces it is
 * always the day of the purchase. Reading that column is the difference
 * between "the bound is 2" and understanding what the adversary does.
 *
 * The randomised half carries the second lesson and it is the one people
 * skip. A randomised strategy is 1.58-competitive against an adversary that
 * fixes the season before seeing the coin, and 3.14 against one that watches
 * it. Randomisation is not a free improvement; it is a payment for an
 * assumption about the opponent.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'competitive-analysis';
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
      title: 'Diagram — the decision timeline, with the optimum revealed after the fact',
      caption: 'The online algorithm walks left to right making irrevocable choices; the offline ' +
        'optimum is computed at the end, when the season length is known. The competitive ratio ' +
        'is the quotient of the two, maximised over every input the adversary could have chosen ' +
        '— so it is a promise rather than an average. The adversary model is the part that is ' +
        'easy to leave unstated: an OBLIVIOUS adversary fixes the input before the algorithm ' +
        'runs, and an ADAPTIVE one watches each decision and picks the next request in response. ' +
        'A deterministic algorithm cannot tell the two apart, because there is nothing to watch; ' +
        'a randomised one can be far better against the first and no better against the second.',
      definition: [
        'flowchart LR',
        '    D1["day 1<br/>rent or buy?"] --> D2["day 2<br/>rent or buy?"]',
        '    D2 --> D3["day 3<br/>…"] --> DK["day B<br/>rent or buy?"]',
        '    DK --> END["the season ends<br/>(the adversary chose when)"]',
        '    END --> OPT["offline optimum:<br/>min(days, B)"]',
        '    END --> ALG["what the algorithm spent"]',
        '    ALG --> R["ratio = ALG / OPT"]',
        '    OPT --> R',
        '    R --> C["competitive ratio =<br/>the MAXIMUM over every season length"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An online algorithm makes irrevocable decisions without the future, and is scored ' +
        'against an offline optimum that had it.** The competitive ratio is the worst that ' +
        'quotient can be over every input. It is not an average and not a typical case: an ' +
        'algorithm is c-competitive when NO adversary can push it past c, which makes the number ' +
        'a promise you can rely on rather than a summary of one experiment.',
      '**Ski rental is the smallest problem where anything happens.** Renting costs 1 a day, ' +
        'buying costs B once, and the season ends on a day the adversary chooses. Rent too long ' +
        'and you have paid more than B; buy too early and the season ends tomorrow. Every ' +
        '"should I keep this connection open or reconnect later" decision is this problem.',
      '**The optimal deterministic rule is one line and its bound is exactly 2 − 1/B.** Rent ' +
        'until you have spent what buying costs, then buy. The adversary’s worst case is the ' +
        'season ending the day you buy: you pay B − 1 in rent plus B, against an optimum of B. ' +
        'The demo measures that ratio at five purchase prices and it is attained exactly at ' +
        'every one.',
      '**Nothing deterministic does better, and that is a theorem rather than an absence of ' +
        'ideas.** For any deterministic rule the adversary knows the buy day in advance and ends ' +
        'the season there. The lower bound and the upper bound meet at 2 − 1/B, so the problem is ' +
        'closed — which is worth knowing before spending a week on a cleverer heuristic.',
      '**Randomisation genuinely helps, against one kind of opponent.** Drawing the buy day from ' +
        'the distribution proportional to ((B − 1)/B)^(B − i) gives an expected ratio of ' +
        'e/(e − 1) ≈ 1.582 against an OBLIVIOUS adversary — one that fixes the season before the ' +
        'coin is flipped. The demo measures 1.5625 at B = 10, inside the bound.',
      '**Against an ADAPTIVE adversary it is worth nothing at all.** An opponent that watches the ' +
        'coin ends the season the day the buy happens, and the measured ratio is worse than the ' +
        'deterministic rule’s. Which adversary you face is a modelling decision about your ' +
        'own system, and it decides whether randomisation is an improvement or a regression.',
      '**List update is the second classic and it makes a different point.** Requests arrive for ' +
        'items in a list, accessing position i costs i, and moving the item forward afterwards is ' +
        'free. Move-to-front is 2-competitive against the best offline reordering — but that ' +
        'offline optimum is NP-hard, so the demo scores against the best STATIC order and says ' +
        'so rather than calling a convenient reference OPT.',
      '**An online algorithm can beat the best static offline order, and the demo shows it.** On ' +
        'a bursty trace whose working set moves, move-to-front costs 0.31 times what the best ' +
        'static order costs — it is adapting to something a static order cannot express. On a ' +
        'stationary Zipf trace it is worse than doing nothing. Adaptation is a purchase, and what ' +
        'it buys depends entirely on whether the distribution moves.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the ratio at every season length, two adversaries, three traces',
        markup: root.CompetitiveAnalysisTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Spend until you have spent what committing would cost, then commit" is a ' +
        'genuinely useful default, and it is 2-competitive.** Keep the connection open until the ' +
        'idle cost equals a reconnect; keep the cache warm until the refresh cost equals a cold ' +
        'start; keep the VM running until the idle bill equals a boot. In every case the rule ' +
        'costs at most twice the best decision you could have made knowing the future, no ' +
        'workload can do worse than that, and it needs no tuning, no prediction and no history. ' +
        'The times it is wrong to use are the times you genuinely can predict the future — and ' +
        'the honest version of that claim is a measurement, not a feeling.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CompetitiveAnalysisTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const skiFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.OnlineLab.skiStudy({ buyPrice: Number(parts[0]), trials: Number(parts[1]) });
  });

  const pricesFor = root.Helpers.memoise(function () {
    return root.OnlineLab.skiPriceSweep({});
  });

  const listsFor = root.Helpers.memoise(function (key) {
    return root.OnlineLab.listStudy({ size: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const ski = skiFor(values['cmp-price'] + '|' + values['cmp-trials']);

    paintMetrics(ski);
    paintChart(app, ski);
    paintStrategies(ski);
    paintPrices(pricesFor(''));
    paintLists(listsFor(values['cmp-list']));
  }

  function paintMetrics(ski) {
    const random = ski.randomised;

    root.MetricGrid.update({
      'cmp-worst': { value: root.Format.fixed(ski.attained.worst, 4),
        note: 'the season ending on day ' + root.Format.exact(ski.attained.worstAt) +
          ' is the adversary’s answer' },
      'cmp-bound': { value: root.Format.fixed(ski.deterministic.bound, 4),
        note: Math.abs(ski.attained.worst - ski.deterministic.bound) < 1e-9
          ? 'attained exactly — the bound is tight, not conservative'
          : 'NOT attained, which means the sweep missed the worst case' },
      'cmp-random': { value: root.Format.fixed(random.obliviousWorst, 4),
        note: 'worst over every season length, against a bound of ' +
          root.Format.fixed(random.bound, 4) },
      'cmp-adaptive': { value: root.Format.fixed(random.adaptiveMean, 4),
        note: 'worse than the deterministic ' + root.Format.fixed(random.deterministicBound, 2) +
          ' — the coin is being watched' }
    });
  }

  function paintChart(app, ski) {
    const host = root.jQuery('#cmp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250,
      xLabel: 'season length in days', yLabel: 'total cost',
      markers: [{ x: ski.buyPrice, label: 'day B' }],
      series: ski.deterministic.rows.map(function (row) {
        return { label: row.strategy.name, points: row.ratios.map(function (point) {
          return { x: point.days, y: point.cost };
        }) };
      }).concat([{ label: 'offline optimum', dashed: true,
        points: ski.deterministic.rows[0].ratios.map(function (point) {
          return { x: point.days, y: point.optimum };
        }) }])
    });

    root.Helpers.setText('cmp-chart-note',
      'The dashed line is the offline optimum: rent the whole season, or buy at once, whichever ' +
      'is cheaper — it bends at day ' + root.Format.exact(ski.buyPrice) + ' and is flat after. ' +
      '"Never buy" tracks it exactly up to that day and then rises without bound. "Buy ' +
      'immediately" is flat at ' + root.Format.exact(ski.buyPrice) + ' and is ' +
      root.Format.exact(ski.buyPrice) + '× the optimum on a one-day season. The break-even rule ' +
      'is the lower envelope of the two mistakes: it never pays more than ' +
      root.Format.fixed(ski.deterministic.bound, 2) + ' times the optimum, and the gap is widest ' +
      'exactly at day ' + root.Format.exact(ski.attained.worstAt) + '.');
  }

  function paintStrategies(ski) {
    root.jQuery('#cmp-strategies tbody').html(ski.deterministic.rows.map(function (row) {
      return '<tr><td>' + row.strategy.name + '</td><td class="mono">' +
        root.Format.fixed(row.worst, 4) + '</td><td class="mono">' +
        root.Format.exact(row.worstAt) + '</td><td class="mono">' +
        root.Format.fixed(row.mean, 4) + '</td><td>' + row.strategy.note + '</td></tr>';
    }).join(''));

    const rent = ski.deterministic.rows[0];
    const buy = ski.deterministic.rows[1];
    root.Helpers.setText('cmp-strategies-note',
      'Read the second and fourth columns against each other. "Buy immediately" has a MEAN ratio ' +
      'of ' + root.Format.fixed(buy.mean, 4) + ' — better than the break-even rule’s ' +
      root.Format.fixed(ski.attained.mean, 4) + ' — and a worst case of ' +
      root.Format.fixed(buy.worst, 2) + '. That is the whole reason competitive analysis reports ' +
      'the maximum: averaged over season lengths nobody chose, a strategy that is catastrophic on ' +
      'the short season looks excellent. "Never buy" is worse still: its worst case grows without ' +
      'bound with the horizon, and at this one it already reads ' +
      root.Format.fixed(rent.worst, 2) + '.');
  }

  function paintPrices(sweep) {
    root.jQuery('#cmp-prices tbody').html(sweep.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.buyPrice) + '</td><td class="mono">' +
        root.Format.fixed(row.worst, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.bound, 4) + '</td><td class="mono">' +
        (row.matchesBound ? 'yes' : 'NO') + '</td><td class="mono">' +
        root.Format.exact(row.worstAt) + '</td><td class="mono">' +
        root.Format.fixed(row.mean, 4) + '</td></tr>';
    }).join(''));

    const first = sweep.rows[0];
    const last = sweep.rows[sweep.rows.length - 1];
    root.Helpers.setText('cmp-prices-note',
      'Every row attains its bound exactly, and the fifth column says how: the worst season is ' +
      'always the day the purchase happens. The bound rises from ' +
      root.Format.fixed(first.bound, 2) + ' at a purchase price of ' +
      root.Format.exact(first.buyPrice) + ' towards 2 as the price grows — a cheap commitment ' +
      'makes the online rule nearly optimal, because there is little to lose by making it early. ' +
      'At a price of ' + root.Format.exact(last.buyPrice) + ' the bound is ' +
      root.Format.fixed(last.bound, 4) + ' and the rule is within a per cent of the worst it can ' +
      'ever be.');
  }

  function paintLists(study) {
    const order = ['none', 'transpose', 'move-to-front', 'frequency-count', 'best static order'];

    root.jQuery('#cmp-lists tbody').html(study.families.map(function (family) {
      const byPolicy = new Map(family.study.rows.map(function (row) {
        return [row.policy, row];
      }));
      return '<tr><td>' + family.name + '</td>' + order.map(function (name) {
        const row = byPolicy.get(name);
        return '<td class="mono">' + (row ? root.Format.fixed(row.ratio, 4) : '—') + '</td>';
      }).join('') + '</tr>';
    }).join(''));

    root.Helpers.setText('cmp-lists-note', listNote(study));
  }

  function listNote(study) {
    const bursty = study.families[1].study.rows.filter(function (row) {
      return row.policy === 'move-to-front';
    })[0];
    const reverse = study.families[2].study.rows.filter(function (row) {
      return row.policy === 'move-to-front';
    })[0];
    const zipf = study.families[0].study.rows.filter(function (row) {
      return row.policy === 'move-to-front';
    })[0];

    return 'Every number is a ratio against the best STATIC order — the items sorted by how often ' +
      'they were asked for — which is a reference rather than the offline optimum, because ' +
      'optimal offline list update with free moves is NP-hard. Move-to-front reads ' +
      root.Format.fixed(zipf.ratio, 4) + ' on the stationary trace, ' +
      root.Format.fixed(bursty.ratio, 4) + ' on the bursty one and ' +
      root.Format.fixed(reverse.ratio, 4) + ' on the sequence built to defeat it. The middle ' +
      'number is below one: an online policy BEATING the best static offline order, because the ' +
      'working set moves and no single static order can follow it. The last is the ' +
      '2-competitive bound being approached, on a sequence that walks the list backwards so ' +
      'every move puts the next request further away.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
