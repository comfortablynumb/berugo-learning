/**
 * Section: Inline caches and object shapes.
 *
 * The measurement is the order study: the same fields, the same reads, and
 * one of the records built in the other order. Nothing about the program
 * changes and the site goes from monomorphic to polymorphic, which is the
 * cost the familiar advice is actually about.
 *
 * The second is the state sweep, and the point of it is the discontinuity.
 * Cost per access rises gently from one shape to four and then jumps, because
 * a cache that has given up does the dictionary lookup every time. "One more
 * type at this call site" is a cliff rather than a gradient, and that is only
 * visible with the states measured side by side.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'inline-caches';
  let panel = null;
  let chart = null;
  let application = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — hidden-class transitions as fields are added',
      caption: 'Every object starts at the empty shape and moves along a transition each time a '
        + 'field is added. Two objects built the same way follow the same path and share a '
        + 'shape; two built in different orders end at different shapes carrying the same '
        + 'fields. That is the whole mechanism, and the second branch of this tree is the cost '
        + 'of writing the same record two ways — the fields are identical, the layout is not, '
        + 'and no site that reads from both can stay monomorphic.',
      definition: [
        'graph TD',
        'E["{ } — the empty shape"] -->|"add x"| X["{ x }"]',
        'E -->|"add y"| Y["{ y }"]',
        'X -->|"add y"| XY["{ x, y } — offset of x is 0"]',
        'Y -->|"add x"| YX["{ y, x } — offset of x is 1"]',
        'XY --> S["a site reading .x from both is polymorphic"]',
        'YX --> S'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Reading a field of a dynamically-shaped object is a hash lookup, and that is too '
        + 'slow.** The name has to be found in a map, the map has to be probed, and the whole '
        + 'thing happens for every property access in the program. Every fast dynamic-language '
        + 'runtime is built around avoiding it, and the avoidance mechanism is the subject of '
        + 'this section.',
      '**A shape is the set of fields an object has, in the order they were added.** Give it an '
        + 'identity and every object with the same history shares it — and then a field\'s '
        + 'offset within the object is a property of the shape rather than of the object. '
        + 'Reading `.x` becomes: check the shape, then load at a fixed offset.',
      '**Shapes form a transition tree, which is what makes them cheap to create.** Adding a '
        + 'field to a shape follows an existing transition if one exists and makes a new one if '
        + 'not, so a thousand objects built the same way allocate one path and share every node '
        + 'on it. The tree is also why the ORDER matters: a different order is a different '
        + 'path.',
      '**An inline cache is the memo at the access site.** The first time through, the site '
        + 'does the slow lookup and remembers the shape it saw and the offset it found. Every '
        + 'later access checks one word — is the shape still that one — and loads at the '
        + 'remembered offset. That check is the guard, and it is the same idea as the JIT\'s '
        + 'type guard in 30.7.',
      '**Monomorphic, polymorphic, megamorphic: three states, and the third is a decision.** '
        + 'One shape is a single check. A few shapes are a short list checked in turn. Past a '
        + 'handful the list costs more to walk than the lookup it replaces, so the cache gives '
        + 'up and stops caching — and giving up is deliberate, not a failure.',
      '**"Initialise every field in the constructor, in the same order" is that mechanism, '
        + 'stated as advice.** Two construction orders make two shapes, so every site reading '
        + 'from both is at least polymorphic. The advice is not style: it is the difference '
        + 'between one guard and a list walk on every property access in the hot path.',
      '**Adding a field later is worse than it looks.** It does not modify the shape, it moves '
        + 'the object to a different one — so an object mutated after construction has a '
        + 'different shape from its siblings, and a site that has seen both is polymorphic '
        + 'again. Runtimes that give up entirely fall back to a per-object dictionary, which is '
        + 'the slow path forever.',
      '**Method dispatch is the same problem with a different name.** A call through an '
        + 'interface asks "which implementation" exactly the way a property read asks "which '
        + 'offset", and it is cached the same way, with the same three states. Hölzle\'s '
        + 'polymorphic inline caches were about method dispatch first and property access '
        + 'second.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — shapes, transitions and one call site',
        markup: root.ShapesTemplate.render() },
      diagram: diagram(),
      insight: '**"Initialise all fields in the constructor, in the same order" is not folklore '
        + '— it keeps the shape monomorphic, and the demo prices the alternative.** What makes '
        + 'this worth internalising is that the cost is invisible at the point where the '
        + 'mistake is made. Building one record `{x, y}` and another `{y, x}` is correct, '
        + 'reads identically, passes every test, and produces two shapes; the price is paid '
        + 'somewhere else entirely, at whatever site reads from both, and it is paid on every '
        + 'access forever. The same is true of adding a property after construction, of '
        + 'conditionally initialising a field, and of a factory that returns objects with '
        + 'slightly different sets depending on its arguments. None of those look like '
        + 'performance decisions and all of them are. And notice the shape of the cliff in the '
        + 'sweep: the difference between four shapes and five is not a fifth of the difference '
        + 'between one and five — it is a jump, because past the polymorphic limit the cache '
        + 'stops caching. Performance advice that sounds superstitious is usually a mechanism '
        + 'nobody explained; this is what that one was.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ShapesTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const programFor = root.Helpers.memoise(function (id) {
    const program = root.Berugo.IrLower.compile(root.ShapesTemplate.SAMPLES[id]).program;

    return root.Berugo.Shapes.fromProgram(program, root.Berugo.Ir);
  });

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const names = ['x', 'y', 'z', 'w', 'v'].slice(0, parts[0]);

    return root.Berugo.Shapes.orderStudy({ names: names, count: parts[1] });
  });

  const sweepFor = root.Helpers.memoise(function (accesses) {
    return root.Berugo.Shapes.stateSweep([1, 2, 3, 4, 5, 8], { accesses: accesses });
  });

  function update() {
    const values = panel.values();
    const accesses = Number(values['ic-accesses']);
    const study = studyFor(JSON.stringify([Number(values['ic-fields']), accesses]));
    const sweep = sweepFor(accesses);
    const program = programFor(values['ic-sample']);

    paintChart(sweep);
    paintMetrics(program, study, sweep);
    paintTree(program);
    paintSites(program);
    paintOrders(study);
    paintStates(sweep);
  }

  function paintChart(sweep) {
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.BytecodeView.bars(document.getElementById('ic-chart'), {
      lazyLib: application.lazyLib, series: ['perAccess'],
      rows: sweep.map(function (row) {
        return { label: row.shapes + ' shape' + (row.shapes === 1 ? '' : 's'),
          perAccess: row.perAccess };
      }),
      summary: 'Cost per property access as one site sees more and more shapes.' });

    root.Helpers.setText('ic-chart-caption', chartCaption(sweep));
  }

  function chartCaption(sweep) {
    const before = sweep.find(function (row) { return row.state === 'polymorphic'
      && row.shapes === root.Berugo.Shapes.POLYMORPHIC_LIMIT; });
    const after = sweep.find(function (row) { return row.state === 'megamorphic'; });

    return 'Cost per access against the number of shapes one site has seen. The interesting '
      + 'feature is the step, not the slope: '
      + (before && after ? before.perAccess + ' at ' + before.shapes + ' shapes and '
        + after.perAccess + ' at ' + after.shapes : 'the jump past the polymorphic limit')
      + '. Below the limit the cache checks a short list; above it, it has given up and does '
      + 'the dictionary lookup every time.';
  }

  function paintMetrics(program, study, sweep) {
    const one = study[0];
    const two = study[1];
    const megamorphic = sweep.find(function (row) { return row.state === 'megamorphic'; });

    root.MetricGrid.update({
      'ic-shapes': { value: program.shapes,
        note: program.transitions + ' transitions from ' + program.sites.length
          + ' record allocations' },
      'ic-state': { value: two.state,
        note: 'after ' + (two.hits + two.misses) + ' accesses at one site' },
      'ic-cost': { value: two.perAccess.toFixed(2),
        note: 'a hit costs 1; the megamorphic state costs '
          + (megamorphic ? megamorphic.perAccess.toFixed(2) : 'far more') },
      'ic-penalty': { value: (two.perAccess / one.perAccess).toFixed(2) + '×',
        note: 'the same fields and the same reads, with one record written the other way round' }
    });
  }

  function paintTree(program) {
    root.jQuery('#ic-tree tbody').html(root.Berugo.Shapes.rows(program.tree)
      .map(function (row) {
        return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.depth +
          '</td><td class="mono">' + row.fields + '</td><td class="mono">' + row.from +
          '</td><td class="mono">' + row.via + '</td><td class="mono">' + row.objects +
          '</td></tr>';
      }).join(''));

    root.Helpers.setText('ic-tree-caption',
      program.shapes + ' shapes and ' + program.transitions + ' transitions. Two rows at the '
      + 'same depth with the same fields in different orders are the whole problem: they carry '
      + 'identical data, they were written identically in the source, and they are different '
      + 'layouts that no site can read from without going polymorphic.');
  }

  function paintSites(program) {
    root.jQuery('#ic-sites tbody').html(program.sites.map(function (row) {
      return '<tr><td class="mono">' + row.fn + '</td><td class="mono">' + row.block +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.fields) +
        '</td><td class="mono">' + row.shape + '</td></tr>';
    }).join('') || '<tr><td colspan="4">this program allocates no records</td></tr>');

    root.Helpers.setText('ic-sites-caption',
      program.sites.length + ' record allocations, and the shape column is what the runtime '
      + 'sees. The field order here is the order the SOURCE wrote — the IR kept it, which is '
      + 'why a program that writes the same record two ways really does get two shapes rather '
      + 'than this being a story about a hypothetical runtime.');
  }

  function paintOrders(study) {
    root.jQuery('#ic-orders tbody').html(study.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.orders +
        '</td><td class="mono">' + row.shapes + '</td><td>' + row.state +
        '</td><td class="mono">' + row.hits + '</td><td class="mono">' + row.misses +
        '</td><td class="mono">' + row.perAccess.toFixed(2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ic-orders-caption', ordersCaption(study));
  }

  function ordersCaption(study) {
    return 'The same fields and the same reads, constructed one way, two ways and every way. '
      + 'Cost per access goes ' + study.map(function (row) {
        return row.perAccess.toFixed(2);
      }).join(' → ') + ', and the state goes ' + study.map(function (row) {
        return row.state;
      }).join(' → ') + '. Nothing about the program changed except the order fields were '
      + 'written in, which is exactly what the familiar advice is about — and why it sounds '
      + 'superstitious until you see this table.';
  }

  function paintStates(sweep) {
    root.jQuery('#ic-states tbody').html(sweep.map(function (row) {
      return '<tr><td class="mono">' + row.shapes + '</td><td>' + row.state +
        '</td><td class="mono">' + row.hits + '</td><td class="mono">' + row.misses +
        '</td><td class="mono">' + row.perAccess.toFixed(2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ic-states-caption',
      'One site, ' + (sweep[0].hits + sweep[0].misses) + ' accesses, and a growing number of '
      + 'shapes. The polymorphic limit here is ' + root.Berugo.Shapes.POLYMORPHIC_LIMIT
      + ', and crossing it is the only discontinuity in the table. That is what makes "one '
      + 'more implementation of this interface" a performance question rather than a design '
      + 'one — most of the time it costs a little, and once in a while it costs a lot.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
