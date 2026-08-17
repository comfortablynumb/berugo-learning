/**
 * Section: Stacks and the call stack.
 *
 * The recursive traversal and its explicit-stack twin, with the depth drawn
 * over time and the engine's real recursion limit measured on demand.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'stacks-and-frames';
  let panel = null;
  let chart = null;
  let measuredLimit = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A stack is the simplest structure there is, and the most load-bearing: every function call ' +
          'pushes a frame holding the return address, the saved registers and the locals, and every ' +
          'return pops one. Recursion depth is therefore memory, allocated on a fixed-size region ' +
          'you did not choose the size of.',
        'A balanced tree recurses to depth log n and a degenerate one to depth n. The same traversal ' +
          'code is fine on the first and overflows on the second, which is why "it worked on the test ' +
          'data" is such a common preface to a stack overflow.',
        'Converting recursion into an explicit stack moves the frames to the heap, where the bound is ' +
          'yours. The visit order must not change, and the demo checks that it does not.'
      ],
      demo: { title: 'Interactive demo — depth over time', markup: root.StacksAndFramesTemplate.render() },
      diagram: {
        title: 'Diagram — one frame, and the chain of them',
        caption: 'The saved frame pointer is what makes a stack trace reconstructible (M39).',
        definition: [
          'flowchart TD',
          '    A["caller frame<br/>locals · saved regs · return address"] --> B["callee frame<br/>locals · saved regs · return address"]',
          '    B --> C["callee frame<br/>…"]',
          '    C --> D["stack pointer<br/>grows towards the guard page"]',
          '    D --> E["guard page hit ⇒ stack overflow"]'
        ].join('\n')
      },
      insight: '"Recursion is elegant" ends where the frame budget does. The engine limit measured ' +
        'here is a few tens of thousands of frames — fine for a balanced tree of a billion nodes, ' +
        'and fatal for a linked list of a hundred thousand.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.StacksAndFramesTemplate.controls,
      onChange: function (id) {
        if (id === 'stack-measure') { measuredLimit = root.CallStack.measureStackLimit(); }
        update(app);
      }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const comparison = root.CallStack.compare({
      count: values['stack-nodes'],
      shape: values['stack-shape'],
      maxDepth: 20000
    });

    const frameBytes = root.CallStack.FRAME_BYTES;
    const headroom = measuredLimit
      ? (values['stack-shape'] === 'degenerate'
        ? measuredLimit.depth
        : Math.pow(2, Math.min(50, measuredLimit.depth)))
      : null;

    root.MetricGrid.update({
      'stack-depth': {
        value: root.Format.exact(comparison.recursive.peakDepth),
        note: values['stack-shape'] === 'balanced' ? 'about log2(n) for a balanced tree' : 'exactly n for a degenerate one'
      },
      'stack-bytes': {
        value: root.Format.bytes(comparison.recursive.peakBytes),
        note: 'at ' + frameBytes + ' bytes per frame'
      },
      'stack-iter': {
        value: root.Format.bytes(comparison.iterative.peakBytes),
        note: comparison.iterative.peakDepth + ' entries of 8 bytes on the heap'
      },
      'stack-same': {
        value: comparison.sameOrder ? 'identical' : 'DIFFERENT',
        note: comparison.sameOrder ? 'the conversion preserved the in-order traversal' : 'the conversion is wrong'
      },
      'stack-limit': {
        value: measuredLimit ? root.Format.exact(measuredLimit.depth) + ' frames' : 'not measured',
        note: measuredLimit ? 'ended with ' + measuredLimit.error : 'press the button — it really does overflow'
      },
      'stack-headroom': {
        value: headroom === null ? '—' : root.Format.count(headroom) + ' nodes',
        note: values['stack-shape'] === 'degenerate'
          ? 'one frame per node, so the limit is the node count'
          : 'a balanced tree of this depth holds 2^depth nodes'
      }
    });

    draw(app, comparison);
  }

  function draw(app, comparison) {
    const recursive = comparison.recursive.timeline.map(function (entry, index) {
      return { x: index, y: entry.depth };
    });
    const iterative = comparison.iterative.timeline.map(function (entry, index) {
      return { x: index, y: entry.depth };
    });

    chart = root.GrowthPlot.render(root.jQuery('#stack-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      yMin: 0,
      series: [
        { label: 'recursion depth (frames)', points: recursive },
        { label: 'explicit stack size', points: iterative, dashed: true }
      ],
      xLabel: 'traversal step',
      yLabel: 'depth',
      legendHost: root.jQuery('#stack-legend')[0],
      summary: function () {
        return 'Stack depth over the first ' + recursive.length + ' steps of the traversal, peaking at ' +
          comparison.recursive.peakDepth + ' frames.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
