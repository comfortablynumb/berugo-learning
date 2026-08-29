/** Markup for "Model checking". */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ModelCheckTemplate = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function on(state, name) { return Boolean(state[name]); }

  function act(name, guard, changes) {
    return { name: name, guard: guard,
      effect: function (state) { return Object.assign({}, state, changes); } };
  }

  /**
   * Check-then-set: each process first observes that no flag is up, then
   * raises its own. Between those two steps another process can do the same,
   * which is the oldest concurrency bug there is.
   */
  function lockSpec(processes) {
    const vars = [];
    const init = {};
    const actions = [];

    for (let at = 1; at <= processes; at += 1) {
      ['ok', 'f', 'in'].forEach(function (prefix) {
        vars.push(prefix + at);
        init[prefix + at] = false;
      });
      actions.push.apply(actions, actionsFor(at, processes));
    }
    return { name: 'check-then-set with ' + processes + ' processes', vars: vars, init: init,
      actions: actions, invariant: atMostOneInside(processes),
      invariantName: 'at most one process inside' };
  }

  function actionsFor(me, processes) {
    const others = [];

    for (let at = 1; at <= processes; at += 1) if (at !== me) others.push('f' + at);
    return [
      act('p' + me + ' sees no flag up', function (state) {
        return !on(state, 'ok' + me) && others.every(function (name) {
          return !on(state, name);
        });
      }, changesFor(['ok' + me], [])),
      act('p' + me + ' raises its flag', function (state) {
        return on(state, 'ok' + me) && !on(state, 'f' + me);
      }, changesFor(['f' + me], [])),
      act('p' + me + ' enters', function (state) {
        return on(state, 'f' + me) && on(state, 'ok' + me) && !on(state, 'in' + me);
      }, changesFor(['in' + me], [])),
      act('p' + me + ' leaves', function (state) { return on(state, 'in' + me); },
        changesFor([], ['in' + me, 'f' + me, 'ok' + me]))
    ];
  }

  function changesFor(up, down) {
    const changes = {};

    up.forEach(function (name) { changes[name] = true; });
    down.forEach(function (name) { changes[name] = false; });
    return changes;
  }

  function atMostOneInside(processes) {
    return function (state) {
      let inside = 0;

      for (let at = 1; at <= processes; at += 1) if (on(state, 'in' + at)) inside += 1;
      return inside <= 1;
    };
  }

  /** Peterson's algorithm: flag, then hand the turn away, then wait. */
  function petersonSpec() {
    return {
      name: 'peterson',
      vars: ['f1', 'f2', 'turn', 'y1', 'y2', 'in1', 'in2'],
      init: { f1: false, f2: false, turn: false, y1: false, y2: false, in1: false, in2: false },
      actions: [
        act('p1 raises its flag', function (s) { return !on(s, 'f1'); }, { f1: true }),
        act('p2 raises its flag', function (s) { return !on(s, 'f2'); }, { f2: true }),
        act('p1 gives the turn to p2', function (s) { return on(s, 'f1') && !on(s, 'y1'); },
          { turn: true, y1: true }),
        act('p2 gives the turn to p1', function (s) { return on(s, 'f2') && !on(s, 'y2'); },
          { turn: false, y2: true }),
        act('p1 enters', function (s) {
          return on(s, 'f1') && on(s, 'y1') && !on(s, 'in1') &&
            (!on(s, 'f2') || !on(s, 'turn'));
        }, { in1: true }),
        act('p2 enters', function (s) {
          return on(s, 'f2') && on(s, 'y2') && !on(s, 'in2') &&
            (!on(s, 'f1') || on(s, 'turn'));
        }, { in2: true }),
        act('p1 leaves', function (s) { return on(s, 'in1'); },
          { in1: false, f1: false, y1: false }),
        act('p2 leaves', function (s) { return on(s, 'in2'); },
          { in2: false, f2: false, y2: false })
      ],
      invariant: atMostOneInside(2), invariantName: 'mutual exclusion'
    };
  }

  const CONTROLS = [
    { id: 'mck-model', kind: 'select', label: 'protocol', value: 'broken',
      options: [
        { value: 'broken', label: 'check the flags, then set your own — the classic race' },
        { value: 'peterson', label: 'Peterson: flag, hand over the turn, then wait' }
      ] },
    { id: 'mck-processes', kind: 'range', label: 'processes in the racing protocol', value: 2,
      min: 2, max: 6, step: 1 },
    { id: 'mck-depth', kind: 'range', label: 'bound for the SAT unrolling', value: 8,
      min: 1, max: 10, step: 1 }
  ];

  const METRICS = [
    { id: 'mck-verdict', label: 'Safety', note: 'the invariant over every reachable state' },
    { id: 'mck-states', label: 'States explored', note: 'before the search stopped' },
    { id: 'mck-depth-found', label: 'Depth of the first violation',
      note: 'breadth-first, so this is the shortest one' },
    { id: 'mck-bmc', label: 'Depth the SAT unrolling reports',
      note: 'a second method that must agree' },
    { id: 'mck-replay', label: 'Counter-example replayed',
      note: 'every guard re-checked against the model' },
    { id: 'mck-reachable', label: 'Reachable states in total',
      note: 'what a proof of safety has to visit' }
  ];

  function render() {
    return '<div class="grid-2">' +
      scope.ControlPanel.markup({ title: 'Explore every state, or unroll into SAT',
        controls: CONTROLS }) +
      '<div class="card"><div class="card-header">The protocol</div>' +
      '<div class="card-body"><pre class="code-block" id="mck-model-text"></pre>' +
      '<p class="note" id="mck-model-caption"></p></div></div>' +
      '</div>' +
      scope.MetricGrid.markup(METRICS) +
      card('mck-trace', 'The counter-example, step by step',
        ['Step', 'Action', 'What is true afterwards', 'Invariant']) +
      card('mck-bmc-table', 'The same question asked as a SAT problem, depth by depth',
        ['Depth', 'Clauses in the unrolling', 'Conflicts', 'Violation found?']) +
      chartCard() +
      card('mck-logics', 'What each temporal logic can say, and what it costs',
        ['Property', 'In words', 'Logic', 'Checkable by this demo']);
  }

  function chartCard() {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">State explosion: the space, what is reachable, and what a '
      + 'counter-example costs</div>' +
      '<div class="card-body"><div id="mck-chart" class="chart-host"></div>' +
      '<div id="mck-legend" class="legend-host"></div>' +
      '<p class="note" id="mck-chart-note"></p></div></div>';
  }

  function card(id, title, columns) {
    return '<div class="card" style="margin-top:.875rem">' +
      '<div class="card-header">' + title + '</div>' +
      '<div class="card-body"><table class="ref-table" id="' + id + '"><thead><tr>' +
      columns.map(function (name) { return '<th>' + name + '</th>'; }).join('') +
      '</tr></thead><tbody></tbody></table>' +
      '<p class="note" id="' + id + '-caption"></p></div></div>';
  }

  return { render: render, controls: CONTROLS, metrics: METRICS,
    lockSpec: lockSpec, petersonSpec: petersonSpec };
}));
