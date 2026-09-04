/**
 * Section: integer representation.
 *
 * The section exists to separate two flags that every ALU raises together and
 * every explanation runs together. Carry is about the unsigned range and
 * overflow about the signed one, and at eight bits 0xFF + 0x01 carries without
 * overflowing while 0x7F + 0x01 overflows without carrying. Which flag the
 * program should have looked at is decided by the types in the source, not by
 * the hardware - the hardware raised both.
 *
 * The second thing it exists for is the asymmetry. There is exactly one more
 * negative value than positive, so negation is not total: -INT_MIN is not
 * representable and wraps to itself, which means `Math.abs` of the smallest
 * value is negative and `INT_MIN / -1` traps on the same signal as division by
 * zero. Both are shown as values rather than described.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'integer-representation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two’s-complement wheel and its one discontinuity',
      caption: 'The bit patterns run 0 upwards all the way around the circle. The unsigned ' +
        'reading follows them directly; the signed reading cuts the circle at the halfway point ' +
        'and calls everything past it negative. Addition is the same walk clockwise under both ' +
        'readings — which is why one adder serves both — and the two flags are simply which ' +
        'boundary the walk crossed.',
      definition: [
        'flowchart LR',
        '    A["pattern 0000 0000<br/>unsigned 0 · signed 0"] --> B["pattern 0111 1111<br/>unsigned 127 · signed 127"]',
        '    B -- "+1: signed OVERFLOW" --> C["pattern 1000 0000<br/>unsigned 128 · signed −128"]',
        '    C --> D["pattern 1111 1111<br/>unsigned 255 · signed −1"]',
        '    D -- "+1: unsigned CARRY" --> A',
        '    C -. "negate −128" .-> C'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A fixed-width integer is a bit pattern plus an agreement about how to read it.** The same ' +
        'eight bits `1111 1111` are 255 to code that agreed unsigned and −1 to code that agreed ' +
        'signed, and nothing in the bits themselves settles it.',
      'Two’s complement is the agreement everybody uses, and it is chosen for one reason: **the ' +
        'same adder works for both readings**. The hardware does not need to know which one you ' +
        'meant.',
      '**Carry and overflow are different flags, and the difference is the whole section.** Carry ' +
        'says the result left the unsigned range; overflow says it left the signed one.',
      'They disagree constantly. At eight bits `0xFF + 0x01` carries and does not overflow, while ' +
        '`0x7F + 0x01` overflows and does not carry.',
      'The processor raises both on every addition, and the *types in your source code* decide ' +
        'which one was the error.',
      '**There is one more negative value than positive**, because zero takes a slot on the ' +
        'positive side.',
      'That asymmetry is not a curiosity. `−INT_MIN` is not representable, so negating the smallest ' +
        'value gives back the smallest value and `abs()` of it is negative. And `INT_MIN / −1` ' +
        'traps on x86 with the same signal as division by zero. The demo shows all three as values.',
      '**What happens on overflow is a policy, and there are four.** Wrapping keeps the low bits ' +
        'and is what JavaScript’s bitwise operators, Go and release-mode Rust do. Saturating clamps ' +
        'to the range and is what audio and fixed-point pipelines want. Checked refuses to answer.',
      'C picks the fourth: signed overflow is *undefined behaviour*, which means the compiler may ' +
        'assume it cannot happen and delete the check you wrote after the addition.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — one pattern, two readings, three policies',
        markup: root.IntegerRepresentationTemplate.render()
      },
      diagram: diagram(),
      insight: 'The bug this section prevents is not "my number wrapped". It is "my overflow ' +
        'check never ran". `if (a + b < a) return error;` is the classic unsigned check and it ' +
        'is correct. The same shape on signed integers in C is undefined behaviour, the compiler ' +
        'is entitled to conclude the condition is false, and the check disappears from the binary ' +
        'at −O2. Check *before* the operation using the range, or use the checked primitive your ' +
        'language gives you. In JavaScript the trap is different and quieter. Everything is a ' +
        'double until a bitwise operator turns it into int32, so `x | 0` is a truncating cast and ' +
        '`1 << 31` is negative. And plain arithmetic silently stops being exact above 2⁵³, with ' +
        'no operator involved at all.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.IntegerRepresentationTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const inspectFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.inspect(BigInt(parts[0]),
      { bits: Number(parts[1]), signed: parts[2] === 'true' });
  });

  const tableFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.arithmeticTable(BigInt(parts[0]), BigInt(parts[1]),
      { bits: Number(parts[2]), signed: parts[3] === 'true' });
  });

  function readValues() {
    const values = panel.values();
    return {
      a: BigInt(Math.trunc(Number(values['ir-a']) || 0)),
      b: BigInt(Math.trunc(Number(values['ir-b']) || 0)),
      bits: Number(values['ir-width']),
      signed: values['ir-signed'] !== false
    };
  }

  function update() {
    const settings = readValues();
    const key = settings.a + '|' + settings.bits + '|' + settings.signed;
    const inspection = inspectFor(key);
    const rows = tableFor(settings.a + '|' + settings.b + '|' + settings.bits + '|' + settings.signed);

    paintWord(inspection, settings);
    paintMetrics(inspection, settings);
    paintWheel(inspection, settings);
    paintEndian(inspection);
    paintOperations(rows, settings);
    paintCoercion();
  }

  /** The field groups colour the sign bit apart from the rest, because the
   *  sign bit is the only one whose meaning depends on the agreement. */
  function groupsFor(bits, signed) {
    if (!signed) return [{ label: 'magnitude', from: 0, to: bits - 1, hue: 'blue' }];
    return [
      { label: 'sign', from: 0, to: 0, hue: 'red' },
      { label: 'magnitude', from: 1, to: bits - 1, hue: 'blue' }
    ];
  }

  function paintWord(inspection, settings) {
    const host = root.jQuery('#ir-word')[0];
    if (!host) return;

    root.BitView.render(host, {
      value: inspection.bits,
      bits: settings.bits,
      groups: groupsFor(settings.bits, settings.signed),
      caption: 'a at ' + settings.bits + ' bits, ' + (settings.signed ? 'signed' : 'unsigned'),
      readings: [
        { label: 'hexadecimal', value: '0x' + inspection.hex },
        { label: 'read as unsigned', value: String(inspection.unsignedValue) },
        { label: 'read as signed', value: String(inspection.signedValue) }
      ]
    });

    root.Helpers.setText('ir-word-note',
      inspection.outOfRange
        ? 'The value you typed does not fit in ' + settings.bits + ' bits, so what is drawn is ' +
          'what the width stores: ' + inspection.stored + '. That is the wrap, and no error was ' +
          'raised anywhere.'
        : 'The same ' + settings.bits + ' bits, read two ways. Nothing in the pattern says which ' +
          'reading is meant — the type does, and it exists only in the source code.');
  }

  function paintMetrics(inspection, settings) {
    const table = tableFor(readValues().a + '|' + readValues().b + '|' + settings.bits +
      '|' + settings.signed);
    const addition = table[0];

    root.MetricGrid.update({
      'ir-stored': { value: String(inspection.stored),
        note: inspection.outOfRange ? 'the value you typed wrapped to this' : 'fits at this width' },
      'ir-flags': { value: flagText(addition),
        note: 'for a + b at ' + settings.bits + ' bits' },
      'ir-span': { value: String(inspection.width.min) + ' … ' + String(inspection.width.max),
        note: String(inspection.asymmetry.negatives) + ' negatives against ' +
          String(inspection.asymmetry.positives) + ' positives' },
      'ir-negmin': { value: String(inspection.asymmetry.negatedMin),
        note: inspection.asymmetry.negationIsIdentity
          ? 'negating the minimum returns the minimum'
          : 'no asymmetry at an unsigned width' }
    });
  }

  function flagText(addition) {
    if (!addition || addition.exact === null) return '—';
    if (addition.carry && addition.overflow) return 'carry + overflow';
    if (addition.carry) return 'carry only';
    if (addition.overflow) return 'overflow only';
    return 'neither';
  }

  function paintWheel(inspection, settings) {
    const host = root.jQuery('#ir-wheel')[0];
    if (!host) return;
    const bits = Math.min(settings.bits, 16);

    root.BitView.renderWheel(host, {
      bits: bits,
      ticks: 16,
      marks: root.NumberLab.wheelMarks(bits, inspection.stored),
      ariaLabel: 'the two’s complement wheel at ' + bits + ' bits'
    });

    root.Helpers.setText('ir-wheel-note',
      'Drawn at ' + bits + ' bits' + (settings.bits > 16 ? ' — a 32- or 64-bit wheel has too ' +
        'many positions to see, and the shape is identical' : '') + '. The dashed line is the ' +
      'only discontinuity in the signed reading: one step clockwise past ' +
      String(root.IntegerOps.width(bits, true).max) + ' lands on ' +
      String(root.IntegerOps.width(bits, true).min) + '. Every signed overflow in every program ' +
      'ever written happened at exactly that line.');
  }

  function paintEndian(inspection) {
    const endian = inspection.endian;
    const rows = [
      { name: 'little-endian (x86, ARM as configured)', bytes: endian.little,
        other: endian.littleReadAsBig },
      { name: 'big-endian (network order, older SPARC)', bytes: endian.big,
        other: endian.bigReadAsLittle }
    ];

    root.jQuery('#ir-endian tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        row.bytes.map(function (byte) {
          return byte.toString(16).toUpperCase().padStart(2, '0');
        }).join(' ') + '</td><td class="mono">' + String(row.other) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ir-endian-note',
      endian.agree
        ? 'At this width and value the two orders produce the same bytes, so the bug is invisible ' +
          'here. That is exactly why it survives testing: a one-byte value, a palindrome, or a ' +
          'zero all round-trip correctly whichever end you start from.'
        : 'The two orders are different bytes. Endianness is not a property of the number — it is ' +
          'a property of the mapping from a number to addresses, and it only becomes visible when ' +
          'something reads the bytes back with the opposite agreement.');
  }

  function paintOperations(rows, settings) {
    root.jQuery('#ir-ops tbody').html(rows.map(function (row) {
      if (row.exact === null) {
        return '<tr><td>' + row.label + '</td><td colspan="6">traps: ' + row.trap + '</td></tr>';
      }
      return '<tr><td>' + row.label + '</td><td class="mono">' + String(row.exact) +
        '</td><td class="mono">' + String(row.policies.wrapping) + '</td><td class="mono">' +
        String(row.policies.saturating) + '</td><td class="mono">' +
        (row.policies.checked === null ? 'refuses' : String(row.policies.checked)) +
        '</td><td>' + (row.carry ? 'yes' : '—') + '</td><td>' +
        (row.overflow ? 'yes' : '—') + '</td></tr>';
    }).join(''));

    const overflowed = rows.filter(function (row) {
      return row.exact !== null && row.policies.overflowed;
    }).length;

    root.Helpers.setText('ir-ops-note',
      overflowed === 0
        ? 'Nothing overflows at ' + settings.bits + ' bits with these operands, so all three ' +
          'policies agree. Raise a or b until one of them does — the policies are only ' +
          'distinguishable at the boundary, which is why the choice between them is so easy to ' +
          'defer and so expensive to get wrong.'
        : root.Format.exact(overflowed) + ' of these four operations leave the range. Read the ' +
          'three policy columns across: wrapping gives an answer that is wrong, saturating gives ' +
          'an answer that is wrong in a bounded direction, and checked gives no answer at all. ' +
          'Only the third can be handled by the caller.');
  }

  function paintCoercion() {
    const rows = root.NumberLab.coercionTable();

    root.jQuery('#ir-coerce tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.expression) +
        '</td><td class="mono">' + String(row.value) + '</td><td>' + row.note + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ir-coerce-note',
      'JavaScript has one number type and two integer widths hiding inside it. Every bitwise ' +
      'operator converts its operands to int32 first — a wrap, not a clamp and not an error — ' +
      'and `>>>` is the single operator that yields uint32. Above 2⁵³ the double itself stops ' +
      'holding integers exactly, with no operator involved, which is the subject of 17.4.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
