'use strict';

/**
 * The log-axis domain, which is where every cost curve in the platform lived
 * or died for a while.
 *
 * A d3 log scale given a domain starting at zero does not throw. `nice()`
 * rounds the floor down to the power of ten below it, zero rounds to zero, and
 * every point then maps to NaN — so the chart draws its axes, its grid and its
 * legend and no data at all. Nothing headless catches that: jsdom has no
 * layout, the render audit sees a populated <svg>, and the figure tests only
 * ever look at the numbers going in. It was found by opening the page.
 *
 * These tests pin the invariant that prevents it: a logarithmic axis is never
 * handed a floor of zero or below.
 */

const test = require('node:test');
const assert = require('node:assert');

const GrowthPlot = require('../../src/js/viz/growth-plot.js');

function series(points) {
  return [{ label: 'one', points: points.map(function (y, i) { return { x: i + 1, y: y }; }) }];
}

test('growth plot: a log domain never starts at zero', function () {
  const domain = GrowthPlot.logDomain([0, 1047552]);

  assert.ok(domain[0] > 0, 'the floor must be positive, got ' + domain[0]);
  assert.strictEqual(domain[1], 1047552);
  assert.ok(Number.isFinite(Math.log10(domain[0])), 'and its logarithm must be finite');
});

test('growth plot: a negative or missing floor is replaced rather than clamped to zero', function () {
  [[-5, 100], [Number.NaN, 100], [undefined, 100]].forEach(function (span) {
    const domain = GrowthPlot.logDomain(span);

    assert.ok(domain[0] > 0, 'floor for ' + span[0] + ' was ' + domain[0]);
    assert.ok(domain[1] > domain[0], 'and the top must stay above it');
  });
});

test('growth plot: a positive floor is kept as given', function () {
  assert.deepStrictEqual(GrowthPlot.logDomain([2, 2000]), [2, 2000]);
});

test('growth plot: a degenerate span still spans something', function () {
  const flat = GrowthPlot.logDomain([50, 50]);

  assert.ok(flat[1] > flat[0], 'a single-valued series still needs a range');

  const empty = GrowthPlot.logDomain([Infinity, -Infinity]);

  assert.ok(empty[0] > 0 && empty[1] > empty[0], 'and so does an empty one');
});

test('growth plot: the floor for a log axis is the smallest positive value present', function () {
  assert.strictEqual(GrowthPlot.lowestPositive(series([113, 242, 503, 1011]),
    function (p) { return p.y; }), 113);
});

test('growth plot: zeros and negatives cannot become the floor of a log axis', function () {
  const lowest = GrowthPlot.lowestPositive(series([0, -4, 7, 900]),
    function (p) { return p.y; });

  assert.strictEqual(lowest, 7, 'a zero in the data must not drag the floor down');
  assert.ok(GrowthPlot.logDomain([lowest, 900])[0] > 0);
});

test('growth plot: an all-zero series leaves the floor to logDomain, not to Infinity', function () {
  const lowest = GrowthPlot.lowestPositive(series([0, 0, 0]), function (p) { return p.y; });

  assert.strictEqual(lowest, Infinity, 'there is no positive value to find');
  const domain = GrowthPlot.logDomain([lowest, 0]);

  assert.ok(domain[0] > 0 && Number.isFinite(domain[0]), 'and the domain is still usable');
  assert.ok(domain[1] > domain[0]);
});

test('growth plot: every cost curve in the platform survives the domain it produces', function () {
  /* The four shapes the sections actually pass: a wide log-log sweep, a series
     that starts at one, a flat series, and one with a zero in it. */
  [[113, 242, 503, 1011, 2036, 4077], [1, 10, 100], [50, 50, 50], [0, 12, 480]]
    .forEach(function (values) {
      const points = series(values);
      const top = values.reduce(function (a, b) { return Math.max(a, b); }, -Infinity);
      const floor = GrowthPlot.lowestPositive(points, function (p) { return p.y; });
      const domain = GrowthPlot.logDomain([floor, top]);

      assert.ok(domain[0] > 0, values.join(',') + ': floor ' + domain[0]);
      assert.ok(domain[1] >= domain[0], values.join(',') + ': top below floor');
      values.filter(function (v) { return v > 0; }).forEach(function (v) {
        const t = (Math.log(v) - Math.log(domain[0])) / (Math.log(domain[1]) - Math.log(domain[0]));
        assert.ok(Number.isFinite(t), values.join(',') + ': ' + v + ' maps to a non-finite position');
      });
    });
});
