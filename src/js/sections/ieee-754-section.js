/**
 * Section: IEEE 754.
 *
 * The claim this section replaces is "floating point is imprecise". The useful
 * statement is that a finite double *is* a rational number, exactly - an
 * integer of at most 53 bits times a power of two - and that the representable
 * ones are not evenly spaced. They are evenly spaced within a binade and the
 * spacing doubles at every power of two, which is one sentence that explains
 * why 0.1 + 0.2 misses 0.3, why adding 1 to 10^16 does nothing, and why a
 * tolerance of 1e-9 is generous at 1.0 and meaningless at 1e9.
 *
 * `exactDecimal` prints the whole expansion rather than a readable prefix, on
 * purpose. 0.1 is 0.1000000000000000055511151231257827021181583404541015625
 * and seeing all fifty-five places is what converts "approximately 0.1" into
 * "a specific other number", which is the shift the section exists to cause.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'ieee-754';
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
      title: 'Diagram — the binary64 layout, and what each field means',
      caption: 'Sixty-four bits in three fields. The exponent is stored biased by 1023 so that ' +
        'the whole 64-bit pattern of a positive double increases monotonically with its value — ' +
        'which is what makes "the next representable double" an integer increment of the bit ' +
        'pattern. The leading one of the significand is not stored at all for a normal number, ' +
        'buying a free bit of precision; a stored exponent of zero is the signal that there is no ' +
        'implicit one, which is exactly what a subnormal is.',
      definition: [
        'flowchart TD',
        '    A["64 bits"] --> B["bit 63: sign<br/>0 positive, 1 negative"]',
        '    A --> C["bits 62-52: exponent<br/>11 bits, biased by 1023"]',
        '    A --> D["bits 51-0: fraction<br/>52 bits"]',
        '    C --> E{"stored exponent"}',
        '    E -- "1 to 2046" --> F["NORMAL<br/>value = ±1.fraction x 2^(e−1023)<br/>the leading 1 is implied"]',
        '    E -- "0" --> G["ZERO if fraction = 0<br/>SUBNORMAL otherwise<br/>value = ±0.fraction x 2^−1022"]',
        '    E -- "2047" --> H["INFINITY if fraction = 0<br/>NaN otherwise"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A finite double is not an approximation of a real number — it is a rational number, ' +
        'exactly.** Specifically it is an integer of at most 53 bits times a power of two.',
      '`0.1` is not "0.1 with a bit of error". It is exactly 3602879701896397 / 2⁵⁵, which written ' +
        'out in full is 0.1000000000000000055511151231257827021181583404541015625.',
      'The demo prints every one of those digits, because seeing them is what turns a vague unease ' +
        'into a specific fact.',
      '**Representable doubles are not evenly spaced.** They are evenly spaced *within a binade* — ' +
        'between one power of two and the next — and the spacing doubles at every power of two.',
      'At 1.0 the gap is 2.22e-16; at 2⁵² it is exactly 1; at 2⁵³ it is 2. From there upwards ' +
        '**half the integers do not exist** and `x + 1 === x` is true.',
      'That single fact is the useful version of everything people say about floating point.',
      '**Zero, infinity and NaN are values in the format, not error states.** A stored exponent of ' +
        'all ones means infinity when the fraction is zero and NaN when it is not.',
      'That leaves 2⁵³ − 2 distinct NaN bit patterns carrying payloads. And it is why ' +
        '`NaN !== NaN`: the standard requires every comparison with a NaN except `!=` to be false.',
      'There are two zeros as well, and `-0 === 0` while `1 / -0` is −Infinity.',
      '**Subnormals are what happens instead of a cliff at the bottom.** Below the smallest normal ' +
        'number the implicit leading one is dropped, so precision degrades gradually down to the ' +
        'last bit rather than the format jumping straight to zero.',
      'That is called gradual underflow, and it is what makes `a − b === 0` imply `a === b`, which ' +
        'would otherwise be false.',
      'The price is that some processors run subnormal arithmetic dramatically slower, which is why ' +
        'numerical code sometimes turns them off.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the dissector, the neighbours and the spacing ladder',
        markup: root.Ieee754Template.render()
      },
      diagram: diagram(),
      insight: 'The everyday consequence is not that arithmetic is wrong, it is that **equality ' +
        'and tolerance both need a scale**. An absolute epsilon is a statement about magnitude, ' +
        'so `Math.abs(a − b) < 1e-9` is a strict test near 1 and vacuous near 1e9. A relative ' +
        'epsilon fixes that and then breaks near zero, where the denominator vanishes. The ' +
        'comparison that behaves the same everywhere is the number of representable doubles ' +
        'between the two values, and almost nobody writes it. The other consequence is a hard ' +
        'boundary worth memorising. Integers are exact up to 2⁵³, which is why JavaScript has ' +
        '`Number.MAX_SAFE_INTEGER`. It is why database ids past that arrive in a browser subtly ' +
        'wrong, and why JSON carrying a 64-bit id has to carry it as a string.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.Ieee754Template.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const EXPONENTS = [-1022, -100, -20, -1, 0, 10, 20, 30, 40, 52, 53, 54, 60, 70];

  const dissectFor = root.Helpers.memoise(function (key) {
    return root.FloatLab.dissect(Number(key));
  });

  const ladderFor = root.Helpers.memoise(function () {
    return root.FloatLab.spacingLadder(EXPONENTS);
  });

  const auditFor = root.Helpers.memoise(function () {
    return root.FloatLab.nextAfterAudit();
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.FloatLab.comparisonTable(Number(key));
  });

  /** A free-text field can hold anything; a NaN from a typo would look like a
   *  deliberate NaN and teach the wrong lesson, so it is named as a typo. */
  function chosenValue() {
    const values = panel.values();
    if (values['ie-preset'] !== 'none') return { value: Number(values['ie-preset']), typed: false };
    const text = String(values['ie-value'] || '').trim();
    const parsed = Number(text);
    if (text.length === 0 || Number.isNaN(parsed)) {
      return { value: 0.1, typed: true, unparsed: text };
    }
    return { value: parsed, typed: true };
  }

  function update(app) {
    const chosen = chosenValue();
    const dissection = dissectFor(String(chosen.value));

    paintWord(dissection, chosen);
    paintMetrics(dissection);
    paintNeighbours(dissection);
    paintAudit(auditFor(''));
    paintLadder(app, ladderFor(''));
    paintComparison(compareFor(String(panel.values()['ie-epsilon'])));
  }

  function paintWord(dissection, chosen) {
    const host = root.jQuery('#ie-word')[0];
    if (!host) return;

    root.BitView.render(host, {
      value: dissection.bits,
      bits: 64,
      groups: root.FloatLab.FIELD_GROUPS,
      caption: 'the value ' + dissection.value,
      readings: [
        { label: 'hexadecimal', value: dissection.fields.hex },
        { label: 'stored exponent', value: String(dissection.biasedExponent) + ' − 1023 = ' +
          String(dissection.exponent) },
        { label: 'significand', value: String(dissection.significand) +
          (dissection.implicitOne ? ' (leading 1 restored)' : ' (no implicit 1 — subnormal)') },
        { label: 'the exact value, in full', value: dissection.exactDecimal }
      ]
    });

    root.Helpers.setText('ie-word-note',
      (chosen.unparsed ? '“' + chosen.unparsed + '” is not a number, so 0.1 is shown instead. ' : '') +
      (dissection.rational
        ? 'As an exact fraction this is ' + String(dissection.rational.numerator) + ' / ' +
          String(dissection.rational.denominator) + '. The denominator is a power of two, which ' +
          'is why the decimal expansion terminates and why it is so long: one decimal place for ' +
          'each factor of two.'
        : 'This value is not finite, so it has no rational form — the exponent field is all ones.'));
  }

  function paintMetrics(dissection) {
    root.MetricGrid.update({
      'ie-class': { value: dissection.kind,
        note: dissection.implicitOne ? 'the leading 1 is implied, not stored'
          : 'no implicit leading 1' },
      'ie-ulp': { value: root.Format.exponential(dissection.ulp, 4),
        note: 'the gap below is ' + root.Format.exponential(dissection.spacingBelow, 4) +
          (dissection.ulp === 2 * dissection.spacingBelow
            ? ' — half, so this is an exact power of two' : '') },
      'ie-exponent': { value: String(dissection.exponent),
        note: 'stored as ' + String(dissection.biasedExponent) + ', biased by 1023' },
      'ie-f32': { value: dissection.narrowed.ulps === null ? '—'
        : root.Format.exact(Number(dissection.narrowed.ulps)),
        note: 'binary32 stores ' + root.Format.exponential(dissection.narrowed.narrowed, 8) }
    });
  }

  function paintNeighbours(dissection) {
    const rows = [
      { name: 'the double below', value: dissection.neighbours.below },
      { name: 'this value', value: dissection.value },
      { name: 'the double above', value: dissection.neighbours.above }
    ];

    root.jQuery('#ie-neighbours tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.exponential(row.value, 17) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(root.FloatInspect.exactDecimal(row.value).slice(0, 48)) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ie-neighbours-note',
      'There is nothing between these three values — no double exists in either gap. The gap ' +
      'above is ' + root.Format.exponential(dissection.neighbours.gapAbove, 4) + ' and the gap ' +
      'below is ' + root.Format.exponential(dissection.neighbours.gapBelow, 4) + ' — ' +
      (dissection.neighbours.gapAbove === dissection.neighbours.gapBelow
        ? 'the same, because this value is not an exact power of two. Pick the 2⁵³ landmark — which is ' +
          'a power of two, because 2⁵³ + 1 is not representable and rounds down to it — and the ' +
          'two gaps differ by a factor of two, because the numbers just below a power of two are ' +
          'packed twice as densely as the numbers just above it.'
        : 'a factor of ' + root.Format.fixed(dissection.neighbours.gapAbove /
            dissection.neighbours.gapBelow, 0) + ' apart, because this value sits exactly on a ' +
          'power of two and the binade below it is twice as dense as the one above.'));
  }

  function paintAudit(rows) {
    root.jQuery('#ie-audit tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Helpers.escapeHtml(String(row.got)) + '</td><td>' +
        (row.holds ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const failures = rows.filter(function (row) { return !row.holds; }).length;
    root.Helpers.setText('ie-audit-note',
      failures === 0
        ? 'All ' + rows.length + ' hold. These are the cases a hand-written `nextAfter` gets ' +
          'wrong: stepping from zero has to land on a subnormal rather than on the smallest ' +
          'normal, and stepping down from the smallest normal has to enter the subnormals rather ' +
          'than jumping to zero. Walking the bit pattern gets both right for free, because the ' +
          'exponent field sits above the fraction field and a fraction that carries into it is ' +
          'exactly the step between binades.'
        : root.Format.exact(failures) + ' of these properties do not hold, which means the ' +
          'representation walk is wrong somewhere.');
  }

  function paintLadder(app, rows) {
    const host = root.jQuery('#ie-chart')[0];
    if (host) {
      if (chart) chart.destroy();
      chart = root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 220,
        logX: true,
        logY: true,
        xLabel: 'magnitude',
        yLabel: 'gap to the next representable double',
        series: [{ label: 'spacing', dots: true,
          points: rows.map(function (row) { return { x: row.value, y: row.gap }; }) }],
        markers: [{ x: Math.pow(2, 53), label: '2⁵³', anchor: 'end' }],
        legendHost: root.jQuery('#ie-legend')[0]
      });
    }

    root.jQuery('#ie-ladder tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">2^' + row.exponent + ' = ' +
        root.Format.exponential(row.value, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.gap, 4) + '</td><td>' +
        (row.integersExact ? 'yes' : 'no') + '</td><td>' +
        (row.incrementSurvives ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ie-ladder-note',
      'Both axes are logarithmic and the line is straight, which is the point: the gap is ' +
      'proportional to the magnitude, doubling at every power of two. Read the last two columns ' +
      'at 2⁵² and 2⁵³. At 2⁵² the gap is exactly 1 and every integer is representable; at 2⁵³ ' +
      'the gap is 2, half the integers are gone, and adding one to the value returns the value. ' +
      'That is the boundary `Number.MAX_SAFE_INTEGER` names.');
  }

  function paintComparison(rows) {
    root.jQuery('#ie-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + (row.absoluteEqual ? 'equal' : 'different') +
        '</td><td>' + (row.relativeEqual ? 'equal' : 'different') + '</td><td class="mono">' +
        root.Format.exact(Number(row.ulps)) + '</td><td>' +
        (row.ulpEqual ? 'equal' : 'different') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ie-compare-note',
      'Read the rows where the three columns disagree. `1e9 + 1` against `1e9` is 8 388 608 ' +
      'representable doubles apart and an absolute tolerance of 1e-9 calls them different while ' +
      'a relative one calls them equal; `1e-12` against `2e-12` is a factor of two apart, and the ' +
      'absolute tolerance calls them equal. Neither tolerance is wrong — each is a statement ' +
      'about a scale, and it stops being true at a different scale. The ULP distance is the same ' +
      'measure everywhere, and it is the one almost nobody writes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
