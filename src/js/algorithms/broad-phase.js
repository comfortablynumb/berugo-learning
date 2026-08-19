/**
 * Broad-phase collision detection: turning n² pair tests into a candidate list
 * small enough to test exactly.
 *
 * The split is the whole design. The broad phase is allowed to be wrong in one
 * direction only - it may propose pairs that do not touch, never miss a pair
 * that does - and the narrow phase then does the exact geometry on what
 * survives. Every structure here is measured on the same two numbers: pairs
 * *tested* and pairs *found*, because the ratio between them is the only thing
 * that distinguishes a working broad phase from an expensive no-op.
 *
 * Sweep and prune is the interesting one, and its justification is temporal
 * coherence rather than asymptotics. Sorting n bodies is O(n log n) from
 * scratch, but between two frames almost nothing has changed order, so an
 * insertion sort over the previous frame's order runs in O(n + swaps) with
 * swaps near zero. Insertion sort is the right choice exactly once, and this
 * is the once.
 *
 * `missed` is reported by every run. A discrete broad phase tests positions at
 * frame boundaries, so a body moving further than its own diameter in one step
 * can be on either side of another and touch neither sample - tunnelling. The
 * continuous test here is the oracle that counts those, and raising the speed
 * makes the number climb: the failure is a property of the time step, not of
 * the index.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BroadPhase = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function randomLib() { return load('../utils/random.js', 'Random'); }
  function spatialHash() { return load('./spatial-hash.js', 'SpatialHash'); }

  function keyFor(a, b) {
    return a < b ? a + ':' + b : b + ':' + a;
  }

  function boxOf(body) {
    return {
      minX: body.x - body.r, minY: body.y - body.r,
      maxX: body.x + body.r, maxY: body.y + body.r,
      id: body.id, body: body
    };
  }

  function touching(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const reach = a.r + b.r;
    return dx * dx + dy * dy <= reach * reach;
  }

  function boxesOverlap(a, b) {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
  }

  /* ------------------------------------------------------------- world */

  function world(options) {
    const settings = options || {};
    const bounds = settings.bounds || { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const count = Math.max(1, Math.floor(settings.count || 200));
    const speed = settings.speed === undefined ? 40 : settings.speed;
    const radius = settings.radius || 6;
    const random = randomLib().seeded(settings.seed || 1);
    const bodies = [];

    for (let i = 0; i < count; i += 1) {
      const angle = random.next() * Math.PI * 2;
      bodies.push({
        id: i,
        x: bounds.minX + radius + random.next() * (bounds.maxX - bounds.minX - 2 * radius),
        y: bounds.minY + radius + random.next() * (bounds.maxY - bounds.minY - 2 * radius),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: radius
      });
    }

    return { bodies: bodies, bounds: bounds, speed: speed, radius: radius };
  }

  /** Straight-line motion with a wall reflection: deterministic, and the
   *  reflection keeps the population density stationary so frame-to-frame
   *  pair counts are comparable. */
  function advance(bodies, bounds, dt) {
    bodies.forEach(function (body) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      if (body.x - body.r < bounds.minX) { body.x = bounds.minX + body.r; body.vx = -body.vx; }
      if (body.x + body.r > bounds.maxX) { body.x = bounds.maxX - body.r; body.vx = -body.vx; }
      if (body.y - body.r < bounds.minY) { body.y = bounds.minY + body.r; body.vy = -body.vy; }
      if (body.y + body.r > bounds.maxY) { body.y = bounds.maxY - body.r; body.vy = -body.vy; }
    });
    return bodies;
  }

  /* ------------------------------------------------------- brute force */

  function bruteForce() {
    let stats = { tests: 0, pairs: 0, swaps: 0 };

    function pairs(bodies) {
      const out = [];
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          stats.tests += 1;
          if (touching(bodies[i], bodies[j])) out.push(keyFor(bodies[i].id, bodies[j].id));
        }
      }
      stats.pairs += out.length;
      return out;
    }

    return {
      kind: 'brute-force',
      pairs: pairs,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = { tests: 0, pairs: 0, swaps: 0 }; }
    };
  }

  /* ---------------------------------------------------- sweep and prune */

  function sweepAndPrune(options) {
    const settings = options || {};
    const axis = settings.axis === 'y' ? 'Y' : 'X';
    let order = null;
    let stats = { tests: 0, pairs: 0, swaps: 0, sorts: 0 };

    /** Insertion sort over the previous frame's order. On the first frame it
     *  is a full O(n²) sort; on every frame after it is O(n + swaps), and the
     *  swap count is the measurement that justifies the choice. */
    function reorder(boxes) {
      if (!order || order.length !== boxes.length) order = boxes.map(function (box, index) { return index; });
      stats.sorts += 1;

      for (let i = 1; i < order.length; i += 1) {
        const current = order[i];
        let j = i - 1;
        while (j >= 0 && boxes[order[j]]['min' + axis] > boxes[current]['min' + axis]) {
          order[j + 1] = order[j];
          j -= 1;
          stats.swaps += 1;
        }
        order[j + 1] = current;
      }

      return order;
    }

    function pairs(bodies) {
      const boxes = bodies.map(boxOf);
      const sorted = reorder(boxes);
      const out = [];

      for (let i = 0; i < sorted.length; i += 1) {
        const a = boxes[sorted[i]];
        for (let j = i + 1; j < sorted.length; j += 1) {
          const b = boxes[sorted[j]];
          if (b['min' + axis] > a['max' + axis]) break;
          stats.tests += 1;
          if (boxesOverlap(a, b) && touching(a.body, b.body)) out.push(keyFor(a.id, b.id));
        }
      }

      stats.pairs += out.length;
      return out;
    }

    return {
      kind: 'sweep-and-prune',
      axis: settings.axis === 'y' ? 'y' : 'x',
      pairs: pairs,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = { tests: 0, pairs: 0, swaps: 0, sorts: 0 }; }
    };
  }

  /* ------------------------------------------------------- moving hash */

  /**
   * A grid rebuilt every frame. It has no state to keep coherent, which is
   * both why it survives teleporting objects that break an incremental
   * structure and why it does strictly more work than sweep and prune on a
   * scene where nothing teleports.
   */
  function hashPhase(options) {
    const settings = options || {};
    let stats = { tests: 0, pairs: 0, swaps: 0, cellsScanned: 0 };

    function pairs(bodies) {
      const boxes = bodies.map(boxOf);
      const cellSize = settings.cellSize || Math.max(1, (bodies[0] ? bodies[0].r : 1) * 4);
      const grid = spatialHash().create({
        cellSize: cellSize, mode: 'hash', buckets: Math.max(64, bodies.length * 2)
      });
      boxes.forEach(function (box) { grid.insert(box); });

      const found = new Set();
      boxes.forEach(function (box) {
        grid.queryRange(box).forEach(function (other) {
          if (other.id === box.id) return;
          const key = keyFor(box.id, other.id);
          if (found.has(key)) return;
          stats.tests += 1;
          if (touching(box.body, other.body)) found.add(key);
        });
      });

      stats.cellsScanned += grid.stats().cellsScanned;
      stats.pairs += found.size;
      return Array.from(found);
    }

    return {
      kind: 'spatial-hash',
      pairs: pairs,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = { tests: 0, pairs: 0, swaps: 0, cellsScanned: 0 }; }
    };
  }

  /* ------------------------------------------------- continuous oracle */

  /**
   * Did these two bodies touch at any instant during the step?
   *
   * Relative motion is a straight line, so |Δp + tΔv| = r₁ + r₂ is a quadratic
   * in t and the answer is whether it has a root in [0, dt]. This is the
   * oracle the discrete phases are scored against; it is also, in a real
   * engine, the fix - either as a swept test or by shortening the step.
   */
  function sweptContact(a, b, dt) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const reach = a.r + b.r;

    const quadratic = dvx * dvx + dvy * dvy;
    const linear = 2 * (dx * dvx + dy * dvy);
    const constant = dx * dx + dy * dy - reach * reach;

    if (constant <= 0) return 0;
    if (quadratic < 1e-12) return null;

    const discriminant = linear * linear - 4 * quadratic * constant;
    if (discriminant < 0) return null;

    const t = (-linear - Math.sqrt(discriminant)) / (2 * quadratic);
    return t >= 0 && t <= dt ? t : null;
  }

  function continuousPairs(bodies, dt) {
    const out = new Set();
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        if (sweptContact(bodies[i], bodies[j], dt) !== null) out.add(keyFor(bodies[i].id, bodies[j].id));
      }
    }
    return out;
  }

  /** Exactly who is touching *right now* - the answer any correct discrete
   *  phase must produce at this instant, used as the reference for what a
   *  frame boundary can and cannot see. */
  function contactSet(bodies) {
    const out = new Set();
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        if (touching(bodies[i], bodies[j])) out.add(keyFor(bodies[i].id, bodies[j].id));
      }
    }
    return out;
  }

  /* ------------------------------------------------------------- runner */

  const PHASES = {
    brute: bruteForce,
    sap: sweepAndPrune,
    hash: hashPhase
  };

  function phaseFor(name, options) {
    const factory = PHASES[name];
    if (!factory) throw new Error('BroadPhase: unknown phase "' + name + '"');
    return factory(options);
  }

  /**
   * One scripted run. The bodies are copied, so the same world can be replayed
   * through every phase and the pair sets compared frame by frame - which is
   * what makes "the same answer, less work" a checkable claim rather than a
   * hope.
   */
  function run(options) {
    const settings = options || {};
    const source = settings.world;
    const dt = settings.dt === undefined ? 1 / 30 : settings.dt;
    const frames = Math.max(1, Math.floor(settings.frames || 60));
    const bodies = source.bodies.map(function (body) { return Object.assign({}, body); });
    const phase = phaseFor(settings.phase || 'sap', settings.phaseOptions);
    const series = [];
    let missed = 0;
    let reported = 0;

    for (let frame = 0; frame < frames; frame += 1) {
      const before = phase.stats();
      const found = phase.pairs(bodies);
      const after = phase.stats();
      /* A contact that begins mid-step and is *still* a contact at the next
         sample is not tunnelling - it is one frame of latency, which every
         discrete engine has and no index changes. Tunnelling is a contact that
         neither endpoint of the step can see, so the next frame's exact
         contact set has to be consulted before anything is called missed. */
      const continuous = settings.checkTunnelling ? continuousPairs(bodies, dt) : null;

      reported += found.length;
      series.push({
        frame: frame,
        tests: after.tests - before.tests,
        pairs: found.length,
        swaps: after.swaps - before.swaps
      });
      advance(bodies, source.bounds, dt);

      if (!continuous) continue;
      const visible = new Set(found);
      contactSet(bodies).forEach(function (key) { visible.add(key); });
      continuous.forEach(function (key) { if (!visible.has(key)) missed += 1; });
    }

    return {
      phase: phase.kind,
      frames: series,
      totals: phase.stats(),
      reported: reported,
      missed: missed,
      testsPerFrame: phase.stats().tests / frames,
      pairsPerFrame: reported / frames,
      bodies: bodies
    };
  }

  return {
    world: world,
    advance: advance,
    bruteForce: bruteForce,
    sweepAndPrune: sweepAndPrune,
    hashPhase: hashPhase,
    sweptContact: sweptContact,
    continuousPairs: continuousPairs,
    contactSet: contactSet,
    run: run,
    keyFor: keyFor,
    boxOf: boxOf,
    phases: Object.keys(PHASES)
  };
}));
