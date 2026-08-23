/**
 * Section: arbitrary-precision arithmetic.
 *
 * The section is built around a claim that does not survive measurement.
 * "Karatsuba wins above eight limbs" is repeated everywhere, and it is true of
 * exactly one column: limb multiplications. Count the additions the recursion
 * pays for them and the crossing moves to 2 048 bits; time it and the crossing
 * has not arrived by 4 096 bits at all, because each level allocates four
 * arrays. All three columns are in the table, because choosing the flattering
 * one is how the folk version got established.
 *
 * The second measurement is about testing rather than speed. Knuth's algorithm
 * D has a correction step - the "add back" - that fires once in roughly half a
 * million quotient digits on random operands. An implementation that omits it
 * passes every test built from random inputs, which is why the fixtures that
 * force it are named constants in the module rather than something the search
 * hopes to stumble on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'arbitrary-precision';
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
      title: 'Diagram — schoolbook multiplication, limb by limb, with the carry chain',
      caption: 'Each limb of one operand multiplies every limb of the other, and each product ' +
        'lands in the column given by the sum of their positions. The base is chosen so that a ' +
        'product of two limbs plus the running column total still fits exactly in a double: at a ' +
        'base of 2¹⁶ the product is at most 2³², leaving twenty-one bits of headroom for the ' +
        'column, which is thousands of limbs deep.',
      definition: [
        'flowchart TD',
        '    A["a = [a0, a1, a2]<br/>little-endian limbs"] --> B["for i in 0..2"]',
        '    C["b = [b0, b1, b2]"] --> B',
        '    B --> D["for j in 0..2:<br/>out[i+j] += a[i] * b[j] + carry"]',
        '    D --> E["carry = floor(value / BASE)<br/>out[i+j] = value & (BASE − 1)"]',
        '    E --> F{"more j?"}',
        '    F -- yes --> D',
        '    F -- no --> G["out[i + 3] += carry"]',
        '    G --> H{"more i?"}',
        '    H -- yes --> B',
        '    H -- no --> I["strip leading zero limbs<br/>n x m limb multiplications in total"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A big integer is **an array of digits in a very large base**, and the base is chosen by ' +
          'arithmetic rather than by taste. Schoolbook multiplication forms a product of two ' +
          'limbs and adds a column of them into an accumulator, and a double holds integers ' +
          'exactly only to 2⁵³ — so a base of 2¹⁶ gives products of at most 2³² and twenty-one ' +
          'bits of headroom for the column. Get that wrong and the arithmetic is silently ' +
          'approximate in the one module that must not be.',
        '**Karatsuba is the classic asymptotic win and the classic misquotation.** Splitting each ' +
          'operand in half lets three multiplications of half-size operands do the work of four, ' +
          'so the exponent drops from 2 to log₂3 ≈ 1.585 — paid for with several extra additions ' +
          'and a temporary allocation at every level. The demo reports limb multiplications, ' +
          'total limb work and wall-clock time separately, and **they cross at three different ' +
          'sizes**. Only one of the three is what a caller pays.',
        '**Division is the operation that is genuinely hard.** Knuth’s algorithm D estimates each ' +
          'quotient digit from the top two limbs, and two things make that estimate safe: a ' +
          'normalising shift that puts the divisor’s leading limb at least halfway up the base, ' +
          'and a correction for the rare case where the estimate is still one too large. That ' +
          'correction fires roughly once in half a million quotient digits, so leaving it out ' +
          'passes every randomised test — which is exactly why it is the classic long-division bug.',
        '**Modular exponentiation is where the timing channel lives.** Square-and-multiply does ' +
          'one squaring per bit of the exponent and one multiplication per *set* bit, so the ' +
          'operation count leaks the exponent’s population count directly. That is harmless for a ' +
          'public exponent of 65 537 — everyone knows it — and fatal for a private one, which is ' +
          'the whole subject of constant-time programming in M23.'
      ],
      demo: {
        title: 'Interactive demo — the crossover, the limbs, the division audit and modPow',
        markup: root.ArbitraryPrecisionTemplate.render()
      },
      diagram: diagram(),
      insight: 'In production you will use the platform’s big integers rather than these, and the ' +
        'reason to have read this is to know what they are not. `BigInt` is not constant time — ' +
        'its work depends on the operand values, so an equality check on a secret leaks through ' +
        'timing. It is not cheap either: the wall-clock column shows the engine’s multiplication ' +
        'beating both implementations here by three to five times, because it is compiled code ' +
        'with a proper carry instruction, and even so a bignum operation is orders of magnitude ' +
        'more expensive than the machine word it looks like in the source. The judgement worth ' +
        'having is when a computation needs to leave 64 bits at all: hashes and ids usually do ' +
        'not, cryptography and exact rational arithmetic always do.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ArbitraryPrecisionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const SIZES = [64, 128, 256, 512, 1024, 2048, 4096];

  const crossoverFor = root.Helpers.memoise(function () {
    return root.BignumLab.crossoverSweep({ sizes: SIZES, runs: 7 });
  });

  const traceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.BignumLab.limbTrace(parts[0], parts[1]);
  });

  const auditFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.divisionAudit({ trials: Number(key) });
  });

  const addBackFor = root.Helpers.memoise(function () {
    return root.BignumLab.addBackSearch({ budget: 200000 });
  });

  const modPowFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.modPowRun({ exponent: Number(key), modulus: 1000000007, base: 3 });
  });

  function rowFor(bits) {
    const rows = crossoverFor('');
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].bits === bits) return rows[i];
    }
    return rows[rows.length - 1];
  }

  function update(app) {
    const values = panel.values();
    const bits = Number(values['ap-bits']);

    paintMetrics(rowFor(bits), auditFor(String(values['ap-trials'])));
    paintChart(app, crossoverFor(''));
    paintCrossover(crossoverFor(''), bits);
    paintLimbs(traceFor(Math.trunc(Number(values['ap-left'])) + '|' +
      Math.trunc(Number(values['ap-right']))));
    paintDivision(auditFor(String(values['ap-trials'])), addBackFor(''));
    paintModPow(modPowFor(String(values['ap-exponent'])));
  }

  function paintMetrics(row, audit) {
    root.MetricGrid.update({
      'ap-ops-ratio': { value: root.Format.fixed(row.opsRatio, 2) + '×',
        note: root.Format.exact(row.schoolbookOps) + ' against ' +
          root.Format.exact(row.karatsubaOps) + ' at ' + row.bits + ' bits' },
      'ap-total-ratio': { value: root.Format.fixed(row.totalRatio, 2) + '×',
        note: row.totalRatio > 1 ? 'Karatsuba is ahead on total work here'
          : 'Karatsuba is BEHIND on total work here' },
      'ap-time-ratio': { value: root.Format.fixed(row.timeRatio, 2) + '×',
        note: row.timeRatio > 1 ? 'Karatsuba is faster here'
          : 'schoolbook is faster here, despite doing more multiplications' },
      'ap-division': { value: root.Format.exact(audit.wrongQuotients + audit.wrongRemainders),
        note: 'over ' + root.Format.exact(audit.trials) + ' randomised divisions' }
    });
  }

  function paintChart(app, rows) {
    const host = root.jQuery('#ap-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      logY: true,
      xLabel: 'operand size in bits',
      yLabel: 'limb operations',
      series: [
        { label: 'schoolbook, multiplications', dots: true,
          points: rows.map(function (row) { return { x: row.bits, y: row.schoolbookOps }; }) },
        { label: 'Karatsuba, multiplications', dots: true,
          points: rows.map(function (row) { return { x: row.bits, y: row.karatsubaOps }; }) },
        { label: 'Karatsuba, all limb work', dashed: true, dots: true,
          points: rows.map(function (row) { return { x: row.bits, y: row.karatsubaTotal }; }) }
      ],
      legendHost: root.jQuery('#ap-legend')[0]
    });

    root.Helpers.setText('ap-chart-note',
      'Both axes are logarithmic, so the slope is the exponent: schoolbook climbs at 2 and ' +
      'Karatsuba’s multiplication count at about 1.585. The dashed line is the same Karatsuba ' +
      'run with its additions counted, and it sits above its own multiplication line by more ' +
      'than the saving — which is the whole reason the wall-clock column in the table below ' +
      'does not agree with either.');
  }

  function paintCrossover(rows, bits) {
    root.jQuery('#ap-crossover tbody').html(rows.map(function (row) {
      const mark = row.bits === bits ? ' class="matrix-row-lit"' : '';
      return '<tr' + mark + '><td>' + row.bits + '</td><td>' + row.limbs + '</td><td class="mono">' +
        root.Format.exact(row.schoolbookOps) + ' / ' + root.Format.exact(row.karatsubaOps) +
        '</td><td class="mono">' + root.Format.exact(row.schoolbookTotal) + ' / ' +
        root.Format.exact(row.karatsubaTotal) + '</td><td class="mono">' +
        root.Format.fixed(row.schoolbookMs, 4) + ' / ' + root.Format.fixed(row.karatsubaMs, 4) +
        '</td><td class="mono">' + root.Format.fixed(row.nativeMs, 5) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ap-crossover-note',
      'Three columns and three different answers to "where does Karatsuba win". Multiplications ' +
      'cross at ' + crossingOf(rows, 'opsRatio') + '; total limb work crosses at ' +
      crossingOf(rows, 'totalRatio') + '; wall-clock time crosses at ' +
      crossingOf(rows, 'timeRatio') + '. The engine’s own `BigInt` beats both throughout, which ' +
      'is the practical answer and also the reason this table exists — an implementation is not ' +
      'faster because its asymptotics are better, and the only way to know is to count all of ' +
      'the work and then time it anyway.');
  }

  /**
   * The first size from which a ratio column stays above one for every larger
   * size. Reporting the first row above one instead is wrong for the timing
   * column, where the smallest sizes are below the recursion floor - both
   * algorithms run the identical kernel there, so the ratio is pure
   * measurement noise and an earlier version of this reported a wall-clock
   * "crossover at 64 bits" that was nothing of the kind.
   */
  function crossingOf(rows, field) {
    for (let i = 0; i < rows.length; i += 1) {
      let holds = true;
      for (let j = i; j < rows.length && holds; j += 1) {
        if (!(rows[j][field] > 1)) holds = false;
      }
      if (holds) return rows[i].bits + ' bits';
    }
    return 'no size in this sweep';
  }

  function paintLimbs(trace) {
    root.jQuery('#ap-limbs tbody').html(trace.partials.map(function (partial) {
      return '<tr><td>' + partial.limb + '</td><td class="mono">' + partial.digit +
        '</td><td class="mono">' + partial.row.map(function (cell) {
          return 'col ' + cell.index + ': ' + cell.product;
        }).join(' · ') + '</td><td class="mono">' +
        partial.row.map(function (cell) { return cell.carry; }).join(' · ') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ap-limbs-note',
      'Base ' + root.Format.exact(trace.base) + ', so each limb is sixteen bits and the operands ' +
      'are ' + trace.left.length + ' and ' + trace.right.length + ' limbs long. The product is ' +
      String(trace.product) + ', which ' +
      (trace.product === trace.expected ? 'matches BigInt exactly'
        : 'DISAGREES with BigInt’s ' + String(trace.expected)) +
      '. Every column total stays inside a double because the base leaves twenty-one bits of ' +
      'headroom — that headroom is the reason for the base, and picking 2³² instead would make ' +
      'this table silently approximate.');
  }

  function paintDivision(audit, addBack) {
    const rows = [
      { name: 'randomised divisions checked', value: root.Format.exact(audit.trials) },
      { name: 'wrong quotients', value: root.Format.exact(audit.wrongQuotients) },
      { name: 'wrong remainders', value: root.Format.exact(audit.wrongRemainders) },
      { name: 'quotient digits in the add-back search',
        value: root.Format.exact(addBack.quotientDigits) },
      { name: 'add-backs found in that search', value: root.Format.exact(addBack.addBacks) },
      { name: 'measured rate per quotient digit',
        value: root.Format.exponential(addBack.ratePerDigit, 2) },
      { name: 'Knuth’s estimate, 2 / base',
        value: root.Format.exponential(addBack.knuthEstimate, 2) }
    ].concat(addBack.fixtures.map(function (fixture) {
      return { name: 'fixture: ' + fixture.label,
        value: fixture.addBacks + ' add-back' + (fixture.addBacks === 1 ? '' : 's') + ', ' +
          (fixture.quotientCorrect && fixture.remainderCorrect ? 'correct' : 'WRONG') };
    }));

    root.jQuery('#ap-div-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.value + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ap-div-note',
      'The correction fires ' + root.Format.exact(addBack.addBacks) + ' times in ' +
      root.Format.exact(addBack.quotientDigits) + ' quotient digits of random division — below ' +
      'even Knuth’s already tiny estimate. That is the point: an implementation that omits it ' +
      'passes every test built from random operands and fails on an input a user supplies later. ' +
      'The two fixtures at the bottom force the branch every time, which is the only way a ' +
      'branch this rare gets tested at all.');
  }

  function paintModPow(run) {
    const rows = [
      { name: 'exponent', value: String(run.exponent) },
      { name: 'bits in the exponent', value: String(run.exponentBits) },
      { name: 'set bits in the exponent', value: String(run.setBits) },
      { name: 'squarings performed', value: String(run.plain.squarings) },
      { name: 'multiplications performed', value: String(run.plain.multiplications) },
      { name: 'squarings equal the bit length', value: run.squaringsMatchBits ? 'yes' : 'no' },
      { name: 'multiplications equal the population count',
        value: run.multipliesMatchPopcount ? 'yes' : 'no' },
      { name: 'Montgomery form agrees', value: run.agree ? 'yes' : 'NO' },
      { name: 'Montgomery reductions', value: String(run.montgomery.reductions) }
    ];

    root.jQuery('#ap-modpow tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.value + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ap-modpow-note',
      'Compare 65 537 and 131 071 with the control above: both are 17 bits, so both cost 17 ' +
      'squarings, and they cost 2 multiplications against 17. An attacker who can time the ' +
      'operation ' +
      'reads the population count of the exponent straight off, which is why the standard public ' +
      'exponent is chosen to have two set bits and why a private exponent must never be used ' +
      'with this algorithm as written. Montgomery form replaces the modular reduction — a ' +
      'division — with a shift, which is why it is worth entering the form at all when many ' +
      'operations happen inside it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
