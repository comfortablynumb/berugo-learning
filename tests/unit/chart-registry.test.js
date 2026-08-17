'use strict';

/**
 * The live-chart registry behind the section tabs.
 *
 * A chart drawn inside a hidden tab panel measures no width and falls back to
 * the 220px floor, so the shell repaints the visible charts every time the
 * learner switches tab. That only works if ChartBase knows which charts exist
 * and forgets them when they are destroyed - a registry that leaks would try
 * to repaint charts whose section has been re-rendered, and one that never
 * registers would leave every chart at the fallback width.
 *
 * The doubles here are element-shaped rather than a DOM: `create` only needs
 * classList, getBoundingClientRect and offsetWidth, and `refreshVisible`
 * decides purely on offsetWidth.
 */

const test = require('node:test');
const assert = require('node:assert');

const ChartBase = require('../../src/js/viz/chart-base.js');

function fakeHost(width) {
  return {
    width: width,
    classList: { add: function () {} },
    getBoundingClientRect: function () { return { width: this.width }; },
    get offsetWidth() { return this.width; },
    innerHTML: ''
  };
}

test('charts: create registers and destroy deregisters', function () {
  const before = ChartBase.liveCount();

  const a = ChartBase.create({ host: fakeHost(800) });
  const b = ChartBase.create({ host: fakeHost(800) });
  assert.strictEqual(ChartBase.liveCount(), before + 2);

  a.destroy();
  assert.strictEqual(ChartBase.liveCount(), before + 1, 'a destroyed chart must not stay live');
  b.destroy();
  assert.strictEqual(ChartBase.liveCount(), before, 'the registry does not leak');
});

test('charts: refreshVisible repaints the laid-out hosts and skips the hidden ones', function () {
  const shown = fakeHost(800);
  const hidden = fakeHost(0);
  const a = ChartBase.create({ host: shown });
  const b = ChartBase.create({ host: hidden });

  assert.strictEqual(ChartBase.refreshVisible(), 1,
    'a host with no width is inside a hidden panel: repainting it would measure nothing');

  hidden.width = 640;
  assert.strictEqual(ChartBase.refreshVisible(), 2, 'the panel is open now, so both repaint');

  a.destroy();
  b.destroy();
});

test('charts: a host is required, so a typo fails at the call rather than at paint', function () {
  assert.throws(function () { ChartBase.create({}); }, /requires a host element/);
});
