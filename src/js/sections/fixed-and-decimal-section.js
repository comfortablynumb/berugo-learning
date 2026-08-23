/**
 * Section: fixed point, decimal and rational arithmetic.
 *
 * The section corrects the claim it is usually used to support. "Never use
 * doubles for money because you will lose cents" is not what the measurement
 * says: a million transactions summed as doubles are out by 6.9e-5 of a cent,
 * they round to the correct cent every time, and no realistic ledger will ever
 * cross half a cent by addition alone.
 *
 * What doubles actually cost is two other things, and both are measured here.
 * The total stops comparing equal to itself - in 500 independent trials the
 * double total differed from the exact value 79% to 97% of the time while
 * formatting identically - so every `total === expected`, every cache key and
 * every JSON round trip is a coin flip. And the moment a *rate* is applied,
 * the product lands a fraction of an ulp on the wrong side of a half-cent
 * boundary and `Math.round` takes the whole cent the other way: at 8.75% that
 * is 996 line items in 200 000, and at 20% it is none at all. Which rates are
 * safe is not something a reader can reason out, and that is the argument.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'fixed-and-decimal';
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
      title: 'Diagram — choosing a numeric representation by what the domain promises',
      caption: 'The question is never "is this accurate enough". It is what the domain requires ' +
        'to be exact. Physical measurements are already approximate and binary floating point is ' +
        'the right answer for them; money is counted rather than measured, and the unit it is ' +
        'counted in — the cent, the satoshi, the basis point — is what should be in the integer.',
      definition: [
        'flowchart TD',
        '    A{"is the quantity<br/>counted or measured?"} -- measured --> B["binary floating point<br/>one instruction, huge range"]',
        '    A -- counted --> C{"is there a smallest<br/>indivisible unit?"}',
        '    C -- yes --> D["scaled integer in that unit<br/>cents, satoshis, basis points"]',
        '    C -- no --> E{"must decimal fractions<br/>be exact?"}',
        '    E -- yes --> F["decimal floating point<br/>software on most hardware"]',
        '    E -- no --> B',
        '    D --> G{"does anything<br/>DIVIDE?"}',
        '    G -- no --> H["addition is exact.<br/>no policy needed"]',
        '    G -- yes --> I["ONE rounding policy,<br/>in ONE function, with a test"]',
        '    B --> J["never compare with ==<br/>compare with a scale"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**The usual argument for not holding money in doubles is wrong, and the real one is ' +
          'worse.** Summing a million transactions as doubles is out by well under a thousandth ' +
          'of a cent and rounds to the correct total every time — addition simply is not where ' +
          'the damage is. What goes instead is *equality*: the double total does not compare ' +
          'equal to the exact value even though it formats identically, so every `total === ' +
          'expected`, every reconciliation and every cache key on a money value is a coin flip.',
        '**The cent is genuinely lost at multiplication.** Apply a rate and the product lands a ' +
          'fraction of a unit in the last place below a half-cent boundary; `Math.round` then ' +
          'takes the whole cent downwards. At 8.75% that is 996 line items in 200 000 — a real ' +
          'ten dollars on this batch — and at 20% it is exactly none, because that rate has no ' +
          'ties. Which rates are safe cannot be reasoned out from the rate, and that is the ' +
          'argument for not having to.',
        '**A scaled integer removes the question.** Ten cents is the integer 10; addition, ' +
          'subtraction and comparison are exact and total; the only place a decision is required ' +
          'is where a division or a percentage forces one — which is exactly where the business ' +
          'rule lives and where the test should be. That is the real payoff: not more accuracy, ' +
          'but **one** place in the system that rounds.',
        '**The rounding policy is a business rule with a measurable cost.** Half-up is biased ' +
          'upwards because every tie goes the same way; half-even exists to remove that bias and ' +
          'is what IEEE 754 and most accounting standards specify. Over one batch the six ' +
          'policies here spread by thousands of cents, and the gap between half-up and half-even ' +
          'is exactly half the number of exact ties — a number the demo counts rather than ' +
          'estimates.'
      ],
      demo: {
        title: 'Interactive demo — a ledger, a rate, six policies and the cost of being exact',
        markup: root.FixedAndDecimalTemplate.render()
      },
      diagram: diagram(),
      insight: 'Put the rounding in one function, give it a name from the domain rather than from ' +
        'arithmetic, and test it against a rational reference. The failure this prevents is not a ' +
        'lost cent in a total — it is a system where three different call sites round slightly ' +
        'differently and the discrepancy only appears in aggregate at the end of a quarter, by ' +
        'which point nobody can say which of them was right. And resist exact rationals as a ' +
        'production representation, however clean they look: the denominators grow without bound, ' +
        'and the demo shows a 200-term sum reaching a 293-bit denominator. They are the right ' +
        'tool for a test oracle and the wrong one for a ledger.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FixedAndDecimalTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const COUNTS = [1000, 10000, 100000, 1000000];

  function settingsFor() {
    const values = panel.values();
    return {
      count: Number(values['fd-count']),
      rate: Number(values['fd-rate']),
      policy: values['fd-policy'],
      seed: Number(values['fd-seed'])
    };
  }

  const divergenceFor = root.Helpers.memoise(function (key) {
    return root.FloatLab.ledgerDivergence({ counts: COUNTS, seed: Number(key) });
  });

  const ledgerFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.FloatLab.ledgerRun({ count: Number(parts[0]), seed: Number(parts[1]),
      policy: parts[2] });
  });

  const rateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.FloatLab.rateApplication({ count: Number(parts[0]), seed: Number(parts[1]),
      rate: { numerator: Number(parts[2]), denominator: 10000 } });
  });

  const policiesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.FloatLab.policyRun({ count: Number(parts[0]), seed: Number(parts[1]),
      rate: { numerator: Number(parts[2]), denominator: 10000 } });
  });

  const failuresFor = root.Helpers.memoise(function (key) {
    return root.FloatLab.centRoundingFailures({ trials: 500, count: 500, seed: Number(key) });
  });

  const rationalFor = root.Helpers.memoise(function () {
    return root.FloatLab.representationCost({ steps: 200 });
  });

  function update(app) {
    const settings = settingsFor();
    const rateKey = settings.count + '|' + settings.seed + '|' + settings.rate;

    paintDivergence(divergenceFor(String(settings.seed)), failuresFor(String(settings.seed)));
    paintMetrics(settings, rateKey);
    paintRate(rateFor(rateKey), settings.rate, policiesFor(rateKey).ties);
    paintPolicies(policiesFor(rateKey));
    paintRational(app, rationalFor(''));
    paintChoice();
  }

  function paintDivergence(rows, failures) {
    root.jQuery('#fd-divergence tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Format.exact(row.count) + '</td><td class="mono">' +
        root.Format.exponential(row.errorCents, 3) + '</td><td>' +
        (row.crossesHalfCent ? 'YES' : 'no') + '</td><td>' +
        (row.formatsCorrectly ? 'yes' : 'NO') + '</td><td>' +
        (row.comparesEqual ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fd-divergence-note',
      'Read the last three columns together, because they refute the usual version of this ' +
      'lesson. Even at a million transactions the double total is out by ' +
      root.Format.exponential(rows[rows.length - 1].errorCents, 2) + ' of a cent, nowhere near ' +
      'half a cent, and it formats to the right value every time. What it never does is compare ' +
      'equal: across ' + root.Format.exact(failures.trials) + ' independent ledgers of ' +
      root.Format.exact(failures.count) + ' transactions, the double total differed from the ' +
      'exact value ' + root.Format.exact(failures.unequal) + ' times (' +
      root.Format.fixed(100 * failures.unequalRate, 1) + '%) and formatted differently ' +
      root.Format.exact(failures.mismatches) + ' times. Addition is not the problem. Equality is.');
  }

  function paintMetrics(settings, rateKey) {
    const ledger = ledgerFor(settings.count + '|' + settings.seed + '|' + settings.policy);
    const rate = rateFor(rateKey);
    const policies = policiesFor(rateKey);
    const totals = policies.rows.map(function (row) { return Number(row.total); });

    root.MetricGrid.update({
      'fd-error': { value: root.Format.exponential(ledger.doubleErrorCents, 3),
        note: 'over ' + root.Format.exact(ledger.count) + ' additions' },
      'fd-equal': { value: ledger.double === ledger.exact ? 'yes' : 'no',
        note: ledger.double === ledger.exact ? 'this seed happens to land exactly'
          : 'formats the same, is not the same value' },
      'fd-rate-wrong': { value: root.Format.exact(rate.disagreements),
        note: root.Format.fixed(100 * rate.rateOfError, 3) + '% of lines, ' +
          root.Format.exact(Math.abs(rate.centsApart)) + ' cents in total' },
      'fd-drift': { value: root.Format.exact(Math.max.apply(null, totals) -
        Math.min.apply(null, totals)),
        note: root.Format.exact(policies.ties) + ' exact ties in the batch' }
    });
  }

  function paintRate(rate, numerator, ties) {
    const rows = rate.examples;

    root.jQuery('#fd-rate-table tbody').html(rows.length === 0
      ? '<tr><td colspan="4">No line item rounds differently at this rate — it produces no exact ' +
        'ties, so the double never has a boundary to fall on the wrong side of.</td></tr>'
      : rows.map(function (row) {
        return '<tr><td class="mono">' + root.Format.fixed(row.cents / 100, 2) +
          '</td><td class="mono">' + root.Format.exponential(row.product, 17) +
          '</td><td class="mono">' + row.asDouble + '</td><td class="mono">' +
          row.asExact + '</td></tr>';
      }).join(''));

    root.Helpers.setText('fd-rate-note',
      'At ' + root.Format.fixed(numerator / 100, 2) + '% the exact product is a half-cent tie ' +
      'for ' + root.Format.exact(ties) + ' of ' + root.Format.exact(rate.count) +
      ' lines, and on ' + root.Format.exact(rate.disagreements) + ' of those the double lands a ' +
      'fraction of a unit in the last place BELOW the tie — look at the product column — so ' +
      '`Math.round` takes the cent downwards while the exact half-up rule takes it upwards. On ' +
      'the rest the double happens to land above and agrees, which is the part that makes this ' +
      'so hard to catch by inspection. The batch ends ' +
      root.Format.exact(Math.abs(rate.centsApart)) + ' cents apart. Change the rate: some rates ' +
      'produce no ties at all and disagree nowhere, and there is no way to tell which from the ' +
      'rate itself.');
  }

  function paintPolicies(policies) {
    root.jQuery('#fd-policies tbody').html(policies.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' + String(row.total) +
        '</td><td class="mono">' + root.Format.fixed(row.drift, 2) + '</td><td>' +
        root.Format.exact(row.ties) + '</td></tr>';
    }).join(''));

    const half = policies.rows.filter(function (row) { return row.id.indexOf('half') === 0; });
    const gap = half.length >= 2 ? Number(half[1].total) - Number(half[0].total) : 0;

    root.Helpers.setText('fd-policies-note',
      'The drift column is the rounded total minus the unrounded one, so it measures the bias ' +
      'each policy introduces. Floor and truncate are identical here because every amount is ' +
      'positive — they differ only on negatives, which is why a refund is where that choice ' +
      'first shows. Half-up sits ' + root.Format.exact(gap) + ' cents above half-even against ' +
      root.Format.exact(policies.ties) + ' ties — close to half of them, and not exactly half, ' +
      'because half-even sends a tie up only when the digit below it is odd and the ties do not ' +
      'split evenly on that. Half-up sends every one of them up, which is why its drift is ' +
      'roughly eight times half-even’s. That bias is the entire reason bankers’ rounding exists.');
  }

  function paintRational(app, cost) {
    const host = root.jQuery('#fd-chart')[0];
    if (host) {
      if (chart) chart.destroy();
      chart = root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 200,
        xLabel: 'terms added',
        yLabel: 'bits in the denominator',
        series: [{ label: 'exact rational', dots: true,
          points: cost.widths.map(function (row) { return { x: row.step, y: row.bits }; }) }],
        legendHost: root.jQuery('#fd-legend')[0]
      });
    }

    root.Helpers.setText('fd-chart-note',
      'Adding 1/1 + 1/2 + … + 1/' + cost.steps + ' as exact rationals. The value is ' +
      root.Format.fixed(cost.asDouble, 6) + ' and the denominator has reached ' +
      root.Format.exact(cost.finalDenominatorBits) + ' bits — every operation is a gcd over ' +
      'numbers that keep growing. Rationals are exact and they do not scale, and both halves of ' +
      'that sentence are on this chart. They are the right tool for a test oracle, which is ' +
      'exactly how this milestone uses them.');
  }

  function paintChoice() {
    const rows = root.FloatLab.REPRESENTATIONS;

    root.jQuery('#fd-choice tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + (row.exactDecimals ? 'yes' : 'no') +
        '</td><td>' + (row.exactHalving ? 'yes' : 'no') + '</td><td>' +
        (row.unbounded ? 'yes' : 'no') + '</td><td>' + row.cost + '</td></tr>';
    }).join(''));

    root.Helpers.setText('fd-choice-note',
      'The two exactness columns pull in opposite directions and that is why no single ' +
      'representation wins. Binary floating point halves exactly and cannot hold 0.1; a scaled ' +
      'decimal integer holds 0.1 exactly and cannot halve 0.05 without a policy. Neither is more ' +
      'accurate than the other — they are exact about different things, and the domain decides ' +
      'which set of exactness it is actually promising.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
