/**
 * Section: differential equations and simulation.
 *
 * The orbit demo is the one that has to be honest, and getting it honest took
 * work. At h = 0.01 both RK4 and Verlet hold the orbit to nine digits and
 * there is nothing to see; the "RK4 makes an orbit decay" claim simply does
 * not reproduce there. It reproduces at h = 0.1 over 200 000 steps, where RK4's
 * radius decays monotonically to 0.9943 and Verlet's oscillates within
 * 2.3e-5 of where it started. The demo therefore defaults to the step where
 * the effect is real rather than to the one that flatters either method.
 *
 * The distinction being taught is that error and energy drift are different
 * quantities. RK4 has less error per step than Verlet by two whole orders;
 * Verlet has a bounded energy error and RK4 does not. Over a long simulation
 * the second property matters more, which is why games use Verlet.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'differential-equations';
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
      title: 'Diagram — RK4’s four stage evaluations, and why they are weighted unequally',
      caption: 'RK4 samples the slope four times per step: once at the start, twice at the ' +
        'midpoint using different estimates of what the state there is, and once at the far end ' +
        'using the second midpoint estimate. The final update weights the two midpoint slopes ' +
        'twice as heavily as the endpoints, which is Simpson\'s rule appearing again — and it is ' +
        'the weighting that makes the error fourth order rather than second, for four times the ' +
        'work of Euler.',
      definition: [
        'flowchart TD',
        '    A["state y at time t"] --> B["k1 = f(t, y)<br/>slope at the start"]',
        '    B --> C["k2 = f(t + h/2, y + h*k1/2)<br/>midpoint, using k1"]',
        '    C --> D["k3 = f(t + h/2, y + h*k2/2)<br/>midpoint again, using k2"]',
        '    D --> E["k4 = f(t + h, y + h*k3)<br/>the far end, using k3"]',
        '    E --> F["y := y + h*(k1 + 2*k2 + 2*k3 + k4)/6"]',
        '    F --> G["error is O(h^4)<br/>for 4 evaluations"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A solver\'s order says how the error shrinks when you halve the step, and it is ' +
        'measurable.** An order-p method has error proportional to hᵖ, so halving h divides the ' +
        'error by 2ᵖ.',
      'The demo halves the step six times and reads the order back off the ratios rather than ' +
        'quoting it. Euler comes out at 1, midpoint at 2, RK4 at 4.',
      'That is the entire content of "fourth order". It is worth checking on your own solver, ' +
        'because getting it wrong is the classic symptom of an implementation bug.',
      '**Order is not the same as long-term fidelity.** RK4 has far less error per step than ' +
        'Verlet, and over a long simulation it still loses energy monotonically while Verlet does ' +
        'not.',
      'The reason is structural. Verlet is symplectic, meaning it exactly preserves a slightly ' +
        'perturbed energy, so its energy error oscillates within a bound forever.',
      'RK4 preserves nothing in particular, so its small per-step energy errors all point the same ' +
        'way and accumulate.',
      '**Stiffness is when the step size is limited by a mode you no longer care about.** A system ' +
        'with a very fast component and a very slow one forces an explicit method to take small ' +
        'steps.',
      'They have to stay small enough to remain stable for the fast component, long after that ' +
        'component has decayed to nothing.',
      'The limit is a stability constraint, not an accuracy one. Crossing it does not degrade the ' +
        'answer gracefully: the solution explodes.',
      '**Implicit methods buy stability by solving for the next state instead of computing it.** ' +
        'Backward Euler evaluates the slope at the destination, which makes each step a ' +
        'root-finding problem.',
      'That is more work per step, and unconditionally stable. So the step size is chosen by how ' +
        'accurate you need to be rather than by what will not explode.',
      'On a stiff problem that trade is not close: fifty times the step for a few times the cost ' +
        'per step.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — convergence order, an orbit over 200 000 steps, and stiffness',
        markup: root.DifferentialEquationsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Game physics uses Verlet not because it is more accurate but because its error ' +
        'does not accumulate as energy. A "more accurate" RK4 integrator makes an orbit decay. ' +
        'That is the specific lesson. The general one is that **the property you need preserved is ' +
        'often not the one the error bound talks about**. Error per step is what papers report. ' +
        'Whether the errors cancel or accumulate is what decides whether your simulation is still ' +
        'recognisable after a million steps. Ask what invariant your system has — energy, ' +
        'momentum, a probability summing to one, a total balance — and choose the method that ' +
        'preserves it. A solver that conserves the invariant approximately forever beats one that ' +
        'tracks the trajectory beautifully and then drifts.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DifferentialEquationsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const orderFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.orderTable({});
  });

  const orbitFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.AnalysisLab.orbitStudy({
      step: Number(parts[0]), eccentricity: Number(parts[1]) / 100
    });
  });

  const stiffFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.stiffnessStudy({ fast: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const orbit = orbitFor(values['de-step'] + '|' + values['de-eccentricity']);
    const stiff = stiffFor(values['de-fast']);

    paintMetrics(orbit, stiff);
    paintChart(app, orbit);
    paintOrder(orderFor(''));
    paintOrbit(orbit, Number(values['de-step']));
    paintStiff(stiff);
  }

  function methodOf(rows, method) {
    return rows.filter(function (row) { return row.method === method; })[0];
  }

  function paintMetrics(orbit, stiff) {
    root.MetricGrid.update({
      'de-euler-drift': { value: root.Format.percent(methodOf(orbit, 'euler').energy.relativeWorst),
        note: 'not symplectic, and first order' },
      'de-rk4-drift': { value: root.Format.exponential(
        methodOf(orbit, 'rk4').energy.relativeWorst, 2),
        note: 'not symplectic, and fourth order' },
      'de-verlet-drift': { value: root.Format.exponential(
        methodOf(orbit, 'verlet').energy.relativeWorst, 2),
        note: 'symplectic, and second order' },
      'de-stiff': { value: root.Format.count(stiff.explicitStepsNeeded),
        note: 'implicit Euler needs ' + root.Format.exact(stiff.implicit.steps) }
    });
  }

  function paintChart(app, orbit) {
    const host = root.jQuery('#de-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.FunctionPlot.curves(host, {
      lazyLib: app.lazyLib,
      height: 250,
      xLabel: 'time',
      yLabel: 'orbital radius',
      clip: { min: 0.9, max: 1.15 },
      series: orbit.map(function (row) {
        return { label: row.label,
          points: row.trail.map(function (point) {
            return { x: point.t, y: Math.hypot(point.state[0], point.state[1]) };
          }) };
      }),
      legendHost: root.jQuery('#de-legend')[0]
    });

    root.Helpers.setText('de-chart-note',
      'The radius should be constant — the orbit is circular. The frame is clipped, because ' +
      'Euler’s radius leaves it almost immediately and would flatten the other two into one line. ' +
      'Look at the shape rather than the magnitude: RK4’s line slopes steadily downwards and never ' +
      'comes back, while Verlet’s wobbles around its starting value and stays there. That ' +
      'difference — monotone against oscillating — is what symplectic means in practice, and it ' +
      'is the reason the second-order method wins a long run against the fourth-order one.');
  }

  function paintOrder(rows) {
    root.jQuery('#de-order tbody').html(rows.map(function (row) {
      const finest = row.rows[row.rows.length - 1];
      return '<tr><td>' + row.label + '</td><td>' + row.expected + '</td><td class="mono">' +
        (row.observed === null ? '—' : root.Format.fixed(row.observed, 3)) + '</td><td>' +
        (row.matches ? 'yes' : 'no') + '</td><td class="mono">' +
        root.Format.exponential(finest.error, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('de-order-note',
      'Each row halves the step six times on a unit spring, whose exact solution is a cosine, and ' +
      'reads the order back from the ratio of consecutive errors: an order-p method divides its ' +
      'error by 2ᵖ each time you halve h, so log₂ of the ratio is p. The measured column lands on ' +
      'the claimed one. This is the check to run first on any solver you write, including one you ' +
      'trust — it catches a wrong coefficient in the RK weights instantly, where a plot of the ' +
      'trajectory would look fine.');
  }

  function paintOrbit(rows, step) {
    root.jQuery('#de-orbit tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + (row.symplectic ? 'yes' : 'no') +
        '</td><td class="mono">' + root.Format.fixed(row.radiusStart, 6) + '</td><td class="mono">' +
        root.Format.fixed(row.radiusEnd, 6) + '</td><td class="mono">' +
        root.Format.fixed(row.radiusMin, 6) + '</td><td class="mono">' +
        root.Format.fixed(row.radiusMax, 6) + '</td><td class="mono">' +
        root.Format.exponential(row.energy.relativeWorst, 2) + '</td></tr>';
    }).join(''));

    const rk4 = methodOf(rows, 'rk4');
    const verlet = methodOf(rows, 'verlet');
    root.Helpers.setText('de-orbit-note',
      'Read the "smallest" and "largest" columns together with the endpoint. RK4 ends at ' +
      root.Format.fixed(rk4.radiusEnd, 6) + ', which is also its smallest radius — the decay is ' +
      'monotone, and running longer makes it worse without limit. Verlet ends at ' +
      root.Format.fixed(verlet.radiusEnd, 6) + ' with a smallest of ' +
      root.Format.fixed(verlet.radiusMin, 6) + ' and a largest of ' +
      root.Format.fixed(verlet.radiusMax, 6) + ': it is oscillating inside a band, and running ' +
      'longer keeps it in the same band. Set the step to 0.01 and the effect vanishes — both hold ' +
      'their energy to about a part in 10⁹ and there is nothing to choose between them. The ' +
      'honest statement is that ' +
      'this matters at step sizes a real-time simulation actually uses, which is why the demo ' +
      'defaults to ' + step + ' rather than to a step that flatters RK4.');
  }

  function paintStiff(stiff) {
    const rows = stiff.explicit.map(function (row) {
      return '<tr><td class="mono">explicit Euler, h = ' + root.Format.exponential(row.step, 3) +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 2) + '×</td><td>' +
        root.Format.count(row.steps) + '</td><td>' + (row.stable ? 'yes' : 'NO — exploded') +
        '</td><td class="mono">' + (row.stable ? root.Format.exponential(row.error, 2) : '—') +
        '</td></tr>';
    });
    rows.push('<tr class="matrix-row-lit"><td class="mono">implicit Euler, h = ' +
      root.Format.fixed(stiff.implicit.step, 3) + '</td><td class="mono">' +
      root.Format.fixed(stiff.implicit.ratioToLimit, 1) + '×</td><td>' +
      root.Format.exact(stiff.implicit.steps) + '</td><td>yes</td><td class="mono">' +
      root.Format.exponential(stiff.implicit.error, 2) + '</td></tr>');
    root.jQuery('#de-implicit tbody').html(rows.join(''));

    root.Helpers.setText('de-implicit-note',
      'The system has a mode decaying at rate ' + root.Format.count(stiff.fast) + ' and one at ' +
      root.Format.exact(stiff.slow) + '. The fast mode is gone within a thousandth of the run, and ' +
      'explicit Euler is still bound by it for the whole thing: its stability limit is h = ' +
      root.Format.exponential(stiff.limit, 3) + ', so reaching t = 1 takes ' +
      root.Format.count(stiff.explicitStepsNeeded) + ' steps. Cross the limit by 25% and it does ' +
      'not degrade — it explodes, because stability is a threshold and not a gradient. Implicit ' +
      'Euler runs at ' + root.Format.fixed(stiff.implicit.ratioToLimit, 0) + '× the limit in ' +
      root.Format.exact(stiff.implicit.steps) + ' steps with an error of ' +
      root.Format.exponential(stiff.implicit.error, 2) + '. Each of those steps solves an ' +
      'equation, which is more expensive — and it is not close.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
