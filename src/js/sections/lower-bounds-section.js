/**
 * Section: Lower bounds and adversary arguments.
 *
 * The adversary answers every comparison so as to keep as many orders alive as
 * possible. Watching the count of consistent permutations fall — and refuse to
 * fall faster than a factor of two per question — is the information-theoretic
 * bound happening rather than being asserted.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'lower-bounds';
  let panel = null;
  let tracker = null;

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
        'A comparison sort learns only from yes/no answers, so after k comparisons it can ' +
          'distinguish at most 2^k orders. There are n! orders to distinguish, so any correct ' +
          'comparison sort needs at least ⌈log₂ n!⌉ comparisons — about n log₂ n − 1.44n.',
        'The demo makes that concrete. Ask a comparison and an adversary answers with whichever ' +
          'reply keeps more permutations alive; the count on the right is what you still cannot ' +
          'distinguish. It can never fall by more than half per question, which is the proof.',
        'The same technique bounds other problems. Finding the maximum needs n − 1 comparisons, ' +
          'because every element except the answer must lose at least once — run it below and the ' +
          'adversary will tell you whether your claim was earned.'
      ],
      demo: { title: 'Interactive demo — play the adversary', markup: root.LowerBoundsTemplate.render() },
      diagram: {
        title: 'Diagram — the decision tree for three elements',
        caption: 'Six leaves, so the tree has height at least ⌈log₂ 6⌉ = 3.',
        definition: [
          'flowchart TD',
          '    R{"a[0] < a[1]?"} -->|yes| L{"a[1] < a[2]?"}',
          '    R -->|no| Rr{"a[1] < a[2]?"}',
          '    L -->|yes| L1["0 1 2"]',
          '    L -->|no| L2{"a[0] < a[2]?"}',
          '    L2 -->|yes| L3["0 2 1"]',
          '    L2 -->|no| L4["2 0 1"]',
          '    Rr -->|yes| R1{"a[0] < a[2]?"}',
          '    R1 -->|yes| R2["1 0 2"]',
          '    R1 -->|no| R3["1 2 0"]',
          '    Rr -->|no| R4["2 1 0"]'
        ].join('\n')
      },
      insight: 'A lower bound tells you when to stop tuning and start changing the model: radix ' +
        'sort beats ⌈log₂ n!⌉ by not being a comparison sort at all. Knowing the floor is what ' +
        'distinguishes "this is as good as it gets" from "we have not found the trick yet".'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LowerBoundsTemplate.controls(),
      onChange: function (id) { handle(id); }
    });

    reset();
  }

  function handle(id) {
    if (id === 'lb-n' || id === 'lb-reset') reset();
    if (id === 'lb-ask') ask();
    if (id === 'lb-adversary') runMaxFinding();
  }

  function currentN() {
    return Number(panel.values()['lb-n']);
  }

  function reset() {
    tracker = root.LowerBounds.createDecisionTracker(currentN());
    paint();
    root.MetricGrid.update({ 'lb-max': { value: '—', note: 'run the max-finding algorithm below' } });
  }

  function ask() {
    const values = panel.values();
    const i = Number(values['lb-i']);
    const j = Number(values['lb-j']);
    const n = currentN();

    if (i === j || i >= n || j >= n) {
      root.MetricGrid.update({ 'lb-remaining': { note: 'pick two different indices below n' } });
      return;
    }

    tracker.ask(i, j, tracker.adversarialAnswer(i, j));
    paint();
  }

  function paint() {
    const remaining = tracker.remaining();
    const asked = tracker.history().length;

    root.MetricGrid.update({
      'lb-remaining': {
        value: String(remaining),
        note: remaining === 1 ? 'the order is now determined' : 'still indistinguishable'
      },
      'lb-asked': {
        value: String(asked),
        note: asked >= tracker.bound ? 'at or past the floor' : (tracker.bound - asked) + ' more are unavoidable'
      },
      'lb-bound': { value: String(tracker.bound), note: '⌈log₂ ' + currentN() + '!⌉ = ⌈' + root.LowerBounds.logFactorial(currentN()).toFixed(2) + '⌉' }
    });

    root.jQuery('#lb-live').html(tracker.live().map(function (order) {
      return '<span class="chip" style="margin:.125rem">' + order.join(' ') + '</span>';
    }).join('') + (tracker.remaining() > 24 ? '<span class="note"> …and ' + (tracker.remaining() - 24) + ' more</span>' : ''));

    root.jQuery('#lb-history').html(tracker.history().map(function (entry, index) {
      return '<div class="note">' + (index + 1) + '. a[' + entry.i + '] ' +
        (entry.answerLess ? '&lt;' : '&gt;') + ' a[' + entry.j + '] → ' + entry.remaining + ' left</div>';
    }).join(''));
  }

  /** A textbook linear scan, played against the adversary. */
  function runMaxFinding() {
    const n = currentN();
    const adversary = root.LowerBounds.createMaxAdversary(n);
    let best = 0;

    for (let i = 1; i < n; i += 1) {
      if (adversary.compare(i, best) > 0) best = i;
    }

    const verdict = adversary.verdict(best);
    root.MetricGrid.update({
      'lb-max': {
        value: verdict.comparisons + ' comparisons',
        note: verdict.sound
          ? 'sound, and exactly the n − 1 = ' + verdict.bound + ' the adversary forces'
          : 'unsound: ' + verdict.reason
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
