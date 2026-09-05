/**
 * Section: Queues, deques and ring buffers.
 *
 * A ring buffer driven by a producer and a consumer at rates you set, so the
 * full and empty states are reached deliberately rather than described.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'queues-and-rings';
  let panel = null;
  let ring = null;
  let history = [];
  let produced = 0;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A queue over a fixed array wraps: when the tail runs off the end it continues at the start. ' +
          'Making the capacity a power of two turns that wrap into a bitwise mask, which is why ' +
          'nearly every real ring buffer is sized that way.',
        'Head equals tail in two different situations — completely empty and completely full — so an ' +
          'implementation must distinguish them. Wasting one slot is the classic answer, and it is the ' +
          'choice that lets the single-producer/single-consumer version be lock-free (M47).',
        'A bounded queue also needs a policy for a full buffer: reject the newcomer, which pushes ' +
          'backpressure upstream, or overwrite the oldest, which loses data silently. Both are here.'
      ],
      demo: { title: 'Interactive demo — drive it into full and empty', markup: root.QueuesAndRingsTemplate.render() },
      diagram: {
        title: 'Diagram — the occupancy states',
        caption: 'The distinction between empty and full is the whole implementation difficulty.',
        definition: [
          'stateDiagram-v2',
          '    [*] --> Empty',
          '    Empty --> Partial: push',
          '    Partial --> Partial: push / shift',
          '    Partial --> Full: push fills the last<br/>usable slot',
          '    Full --> Partial: shift',
          '    Full --> Full: push (rejected, or<br/>overwrites the oldest)',
          '    Partial --> Empty: shift drains the last item'
        ].join('\n')
      },
      insight: 'The wasted slot is not a memory optimisation you missed. It is what makes the ' +
        'empty/full test a single comparison with no extra shared counter, and that is precisely ' +
        'what a lock-free producer and consumer need.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.QueuesAndRingsTemplate.controls,
      onChange: function (id) {
        if (id === 'ring-step') tick(20);
        else if (id === 'ring-reset' || id === 'ring-capacity' || id === 'ring-policy') reset();
        paint();
      }
    });

    reset();
    paint();
  }

  function reset() {
    const values = panel.values();
    ring = root.LinearStructures.createRingBuffer({
      capacity: values['ring-capacity'],
      policy: values['ring-policy']
    });
    history = [];
    produced = 0;
  }

  function tick(times) {
    const values = panel.values();
    for (let t = 0; t < times; t += 1) {
      for (let p = 0; p < values['ring-produce']; p += 1) {
        produced += 1;
        ring.push(produced);
      }
      for (let c = 0; c < values['ring-consume']; c += 1) ring.shift();
      history.push({ size: ring.size(), dropped: ring.dropped() });
    }
  }

  function paint() {
    const state = ring.state();
    const cells = state.slots.map(function (value, index) {
      const isHead = index === state.head;
      const isTail = index === state.tail;
      const filled = value !== null;
      const background = filled ? 'var(--hue-blue-soft)' : 'var(--surface-sunken)';
      const border = isHead ? 'var(--hue-green)' : (isTail ? 'var(--hue-orange)' : 'var(--border-color)');
      return '<span style="display:inline-block;min-width:2.2rem;text-align:center;margin:2px;' +
        'padding:.2rem .3rem;border-radius:4px;background:' + background + ';border:2px solid ' + border + '">' +
        (filled ? value : '·') + '</span>';
    }).join('');

    root.jQuery('#ring-slots').html(cells +
      '<p class="note" style="margin-top:.375rem">green border = head (next read) · ' +
      'orange border = tail (next write) · one slot is always left unused</p>');

    root.MetricGrid.update({
      'ring-size': {
        value: ring.size() + ' / ' + ring.usable,
        note: ring.isFull() ? 'full — the next push hits the policy' : (ring.isEmpty() ? 'empty' : 'partially filled')
      },
      'ring-dropped': {
        value: root.Format.exact(ring.dropped()),
        note: panel.values()['ring-policy'] === 'reject' ? 'rejected at push time' : 'overwritten before being read'
      },
      'ring-mask': {
        value: '& ' + (ring.capacity - 1),
        note: 'capacity rounded to ' + ring.capacity + ', so index & ' + (ring.capacity - 1) + ' wraps'
      },
      'ring-state': {
        value: state.head + ' / ' + state.tail,
        note: 'produced ' + root.Format.exact(produced) + ' items in total'
      }
    });

    paintHistory();
  }

  function paintHistory() {
    if (!history.length) {
      root.jQuery('#ring-history').html('<p class="note">Run some ticks to see occupancy over time.</p>');
      return;
    }

    const bars = history.slice(-60).map(function (entry) {
      const height = Math.max(2, Math.round((entry.size / Math.max(1, ring.usable)) * 40));
      return '<span style="display:inline-block;width:4px;height:' + height + 'px;margin-right:1px;' +
        'background:var(--hue-blue);vertical-align:bottom"></span>';
    }).join('');

    root.jQuery('#ring-history').html('<div style="height:44px">' + bars + '</div>' +
      '<p class="note">occupancy over the last ' + Math.min(60, history.length) + ' ticks</p>');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
