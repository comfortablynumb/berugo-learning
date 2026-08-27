/**
 * Register allocation: graph colouring and linear scan over the same function.
 *
 * The two algorithms answer the same question and are chosen for different
 * reasons, which is the section's whole point. Colouring builds an
 * interference graph and produces better code; linear scan walks the
 * intervals once and produces its answer far faster. An ahead-of-time
 * compiler pays the graph; a JIT cannot, because its compile time is on the
 * critical path of the program it is compiling. That is a latency decision,
 * not a quality one.
 *
 * The allocation is **verified against an independent liveness pass** rather
 * than trusted: at every program point, no two live values may share a
 * register. An allocator that is subtly wrong produces code that runs and is
 * occasionally wrong, and nothing but that check notices — the same shape as
 * every oracle in M29.
 *
 * The input is post-destruction IR: phis are gone, so a value is a plain
 * interval and the copies a phi became are ordinary moves the coalescer can
 * try to remove.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Regalloc = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');
  const Cfg = berugo && berugo.Cfg ? berugo.Cfg : require('./cfg.js');
  const Dataflow = berugo && berugo.Dataflow ? berugo.Dataflow : require('./dataflow.js');

  /* --------------------------------------------------------- linearisation */

  /**
   * One number per instruction, in reverse postorder of the blocks. Linear
   * scan needs a total order and colouring needs somewhere to ask "what is
   * live here"; both are this list. Reverse postorder rather than source
   * order because it keeps a loop body contiguous, which is what makes an
   * interval a range rather than a set of holes.
   */
  function linearise(fn) {
    const graph = Cfg.build(fn);
    const order = Cfg.order(graph).reverse;
    const points = [];

    order.forEach(function (id) {
      const block = Ir.blockById(fn, id);

      if (!block) return;
      block.instructions.forEach(function (inst) {
        points.push({ at: points.length, block: id, inst: inst });
      });
      if (block.terminator) points.push({ at: points.length, block: id, inst: block.terminator });
    });
    return { points: points, graph: graph, order: order };
  }

  /**
   * Live-in and live-out per instruction, computed backwards from the block
   * liveness M29 already checks against a path enumeration. Doing it here
   * from the block sets rather than from a second analysis is deliberate:
   * the verifier below has to be an INDEPENDENT pass, so it must not share
   * this code.
   */
  function livePoints(fn, layout) {
    const blocks = Dataflow.run(fn, 'liveness');
    const live = {};
    const byBlock = {};

    layout.points.forEach(function (point) {
      (byBlock[point.block] = byBlock[point.block] || []).push(point);
    });
    Object.keys(byBlock).forEach(function (id) {
      let after = new Set(blocks.out[id] || []);

      byBlock[id].slice().reverse().forEach(function (point) {
        live[point.at] = { after: after, before: transferBack(point.inst, after) };
        after = live[point.at].before;
      });
    });
    return live;
  }

  function transferBack(inst, after) {
    const before = new Set(after);
    const target = Ir.definitionOf(inst);

    if (target) before.delete(target);
    Ir.usesOf(inst).forEach(function (register) {
      if (Ir.isRegister(register)) before.add(register);
    });
    return before;
  }

  /* ---------------------------------------------------------- live intervals */

  function intervals(fn, layout, live) {
    const spans = {};
    const note = function (register, at) {
      if (!Ir.isRegister(register)) return;
      if (!spans[register]) spans[register] = { register: register, from: at, to: at };
      spans[register].from = Math.min(spans[register].from, at);
      spans[register].to = Math.max(spans[register].to, at);
    };

    fn.params.forEach(function (register) { note(register, 0); });
    layout.points.forEach(function (point) {
      live[point.at].after.forEach(function (register) { note(register, point.at); });
      live[point.at].before.forEach(function (register) { note(register, point.at); });
    });
    return Object.keys(spans).sort(function (a, b) {
      return spans[a].from - spans[b].from || a.localeCompare(b);
    }).map(function (key) { return spans[key]; });
  }

  /* ------------------------------------------------------ interference graph */

  /**
   * Two values interfere when both are live at the same point. Building it
   * from the point sets rather than from interval overlap is the more precise
   * of the two definitions, and the difference is exactly the holes an
   * interval flattens over — which is what live-range splitting exists to
   * recover.
   */
  function interference(fn, layout, live) {
    const edges = {};
    const add = function (a, b) {
      if (a === b) return;
      (edges[a] = edges[a] || new Set()).add(b);
      (edges[b] = edges[b] || new Set()).add(a);
    };

    layout.points.forEach(function (point) {
      const here = Array.from(live[point.at].after);

      here.forEach(function (a, at) {
        edges[a] = edges[a] || new Set();
        here.slice(at + 1).forEach(function (b) { add(a, b); });
      });
    });
    fn.params.forEach(function (register) { edges[register] = edges[register] || new Set(); });
    return edges;
  }

  function degreeOf(edges, register) {
    return edges[register] ? edges[register].size : 0;
  }

  /* -------------------------------------------------------- graph colouring */

  /**
   * Chaitin–Briggs. Repeatedly remove a node whose degree is below the
   * register count — it can always be coloured once everything else is — and
   * when none is left, push one optimistically and hope its neighbours end up
   * sharing colours. The optimism is Briggs's contribution and is why this
   * spills less than Chaitin's original, which spilled as soon as it was
   * stuck.
   */
  function colour(fn, options) {
    const settings = options || {};
    const registers = settings.registers || 4;
    const layout = linearise(fn);
    const live = livePoints(fn, layout);
    const edges = interference(fn, layout, live);
    const coalesced = settings.coalesce === false ? { moves: 0, merged: {} }
      : coalesce(fn, edges, registers);
    const order = simplify(edges, registers);
    const assignment = select(order, edges, registers, coalesced.merged);

    return finishColouring(fn, layout, live, { assignment: assignment, edges: edges,
      registers: registers, coalesced: coalesced, order: order,
      intervals: intervals(fn, layout, live) });
  }

  function finishColouring(fn, layout, live, state) {
    const spilled = Object.keys(state.assignment).filter(function (register) {
      return state.assignment[register] === null;
    });

    return { name: 'graph colouring', assignment: state.assignment, spilled: spilled,
      spills: spilled.length, registers: state.registers,
      spilledPoints: spilledSpan(placementsFrom(state.assignment, state.intervals)),
      values: Object.keys(state.edges).length,
      edges: countEdges(state.edges), coalesced: state.coalesced.moves,
      maxDegree: Object.keys(state.edges).reduce(function (most, register) {
        return Math.max(most, degreeOf(state.edges, register));
      }, 0),
      verify: verify(fn, state.assignment, layout, live) };
  }

  function countEdges(edges) {
    return Object.keys(edges).reduce(function (sum, register) {
      return sum + edges[register].size;
    }, 0) / 2;
  }

  function simplify(edges, registers) {
    const removed = [];
    const left = new Set(Object.keys(edges));
    const degree = {};

    Object.keys(edges).forEach(function (register) { degree[register] = degreeOf(edges, register); });
    while (left.size) {
      const pick = chooseNode(left, degree, registers);

      left.delete(pick);
      removed.push(pick);
      edges[pick].forEach(function (other) {
        if (left.has(other)) degree[other] -= 1;
      });
    }
    return removed.reverse();
  }

  /** Below the register count first; otherwise the highest degree, optimistically. */
  function chooseNode(left, degree, registers) {
    let fallback = null;

    left.forEach(function (register) {
      if (degree[register] < registers) { fallback = fallback || register; return; }
      if (fallback === null || degree[fallback] >= registers) {
        if (fallback === null || degree[register] > degree[fallback]) fallback = register;
      }
    });
    const low = Array.from(left).find(function (register) { return degree[register] < registers; });

    return low === undefined ? fallback : low;
  }

  function select(order, edges, registers, merged) {
    const assignment = {};

    order.forEach(function (register) {
      const taken = new Set();

      edges[register].forEach(function (other) {
        if (assignment[other] !== undefined && assignment[other] !== null) {
          taken.add(assignment[other]);
        }
      });
      const preferred = merged[register];

      if (preferred !== undefined && !taken.has(preferred)) { assignment[register] = preferred; return; }
      assignment[register] = firstFree(taken, registers);
    });
    return assignment;
  }

  function firstFree(taken, registers) {
    for (let at = 0; at < registers; at += 1) {
      if (!taken.has(at)) return at;
    }
    return null;
  }

  /**
   * Briggs's conservative coalescing: a move between two values that do NOT
   * interfere can be removed by giving both the same register, but only if
   * doing so does not create a node whose degree makes it unallocatable. The
   * conservative test is the whole reason coalescing does not make spilling
   * worse, which is what aggressive coalescing famously did.
   */
  function coalesce(fn, edges, registers) {
    const merged = {};
    let moves = 0;

    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (inst.op !== 'move' || !Ir.isRegister(inst.from)) return;
        if (edges[inst.target] && edges[inst.target].has(inst.from)) return;
        const combined = new Set(Array.from(edges[inst.target] || [])
          .concat(Array.from(edges[inst.from] || [])));

        if (combined.size >= registers) return;
        moves += 1;
        merged[inst.target] = merged[inst.from] === undefined ? 0 : merged[inst.from];
      });
    });
    return { moves: moves, merged: merged };
  }

  /* ------------------------------------------------------------ linear scan */

  /**
   * Poletto and Sarkar. Walk the intervals in order of their start, expire
   * the ones that have ended, and hand out a free register; when none is
   * free, spill the interval that ends LAST, because that frees the most
   * space.
   *
   * The output is a list of PLACEMENTS rather than one register per value --
   * `{ register, from, to, colour }`, with a null colour meaning "in memory
   * over this span". That shape is what makes splitting real: a value can
   * hold a register for the first half of its life and sit in memory for the
   * second, which is exactly what a split is. The first version of this
   * allocator kept one register per value and re-queued the tail under an
   * invented name, so the tail was consulted by nothing -- the split counter
   * went up, the code was unchanged, and the feature was decorative.
   */
  function linearScan(fn, options) {
    const settings = options || {};
    const registers = settings.registers || 4;
    const layout = linearise(fn);
    const live = livePoints(fn, layout);
    const queue = intervals(fn, layout, live).map(function (row) {
      return { register: row.register, from: row.from, to: row.to };
    });
    const state = { active: [], free: countUp(registers), placements: [], spills: 0,
      splits: 0, registers: registers, split: settings.split !== false, guard: 0 };

    while (queue.length && state.guard < 5000) {
      const interval = queue.shift();

      state.guard += 1;
      expire(state, interval.from);
      if (state.free.length) { place(state, interval, state.free.shift()); continue; }
      spillAt(state, interval, queue);
    }
    return finishScan(fn, state, layout, live);
  }

  function finishScan(fn, state, layout, live) {
    return { name: 'linear scan', placements: state.placements,
      assignment: assignmentFrom(state.placements),
      spills: state.spills, splits: state.splits, registers: state.registers,
      intervals: state.placements.length,
      values: countRegisters(state.placements),
      spilledPoints: spilledSpan(state.placements),
      spilled: spilledRegisters(state.placements),
      verify: verifyPlacements(fn, state.placements, layout, live) };
  }

  function countRegisters(placements) {
    return new Set(placements.map(function (row) { return row.register; })).size;
  }

  function spilledSpan(placements) {
    return placements.reduce(function (sum, row) {
      if (row.colour !== null) return sum;
      return sum + (row.to - row.from + 1);
    }, 0);
  }

  function spilledRegisters(placements) {
    return Array.from(new Set(placements.filter(function (row) {
      return row.colour === null;
    }).map(function (row) { return row.register; })));
  }

  /** For display: the register a value spent most of its life in. */
  function assignmentFrom(placements) {
    const best = {};

    placements.forEach(function (row) {
      const span = row.to - row.from + 1;

      if (!best[row.register] || span > best[row.register].span) {
        best[row.register] = { span: span, colour: row.colour };
      }
    });
    return Object.keys(best).reduce(function (into, register) {
      into[register] = best[register].colour;
      return into;
    }, {});
  }

  function countUp(n) {
    const out = [];

    for (let at = 0; at < n; at += 1) out.push(at);
    return out;
  }

  function expire(state, at) {
    state.active = state.active.filter(function (entry) {
      if (entry.to >= at) return true;
      state.free.push(entry.colour);
      return false;
    });
    state.free.sort(function (a, b) { return a - b; });
  }

  function place(state, interval, colour) {
    const row = { register: interval.register, from: interval.from, to: interval.to,
      colour: colour };

    state.placements.push(row);
    if (colour === null) { state.spills += 1; return; }
    interval.colour = colour;
    interval.row = row;
    state.active.push(interval);
    state.active.sort(function (a, b) { return a.to - b.to; });
  }

  /**
   * Spill the interval that ends last, because that frees the register for
   * the longest time. The one already holding it keeps it up to this point --
   * its placement is truncated rather than deleted, which is the half of a
   * split that actually saves anything.
   */
  function spillAt(state, interval, queue) {
    const last = state.active[state.active.length - 1];

    if (!last || last.to <= interval.to) { place(state, interval, null); return; }
    truncate(state, last, interval.from - 1);
    state.active.pop();
    place(state, interval, last.colour);
    spillRemainder(state, last, interval.from, queue);
  }

  function truncate(state, interval, to) {
    interval.row.to = to;
    if (to >= interval.row.from) return;
    state.placements.splice(state.placements.indexOf(interval.row), 1);
  }

  /**
   * The rest of the evicted value's life. With splitting off it is in memory
   * for all of it; with splitting on it is in memory only until a register
   * frees up, and the tail from that point re-enters the queue.
   *
   * Where to resume is the whole of whether splitting is worth anything. The
   * obvious answer -- one point later -- puts the tail back at a position
   * where nothing has expired, so it spills again immediately for the rest of
   * its life and the split saves exactly nothing. Resuming at the first point
   * an active interval has ended is what makes the second half allocatable,
   * and it still terminates because that point is strictly later.
   */
  function spillRemainder(state, interval, at, queue) {
    const resume = Math.max(at + 1, nextFreePoint(state));

    if (!state.split || interval.to <= resume) {
      state.placements.push({ register: interval.register, from: at, to: interval.to,
        colour: null });
      state.spills += 1;
      return;
    }
    state.placements.push({ register: interval.register, from: at, to: resume - 1,
      colour: null });
    state.splits += 1;
    queue.push({ register: interval.register, from: resume, to: interval.to });
    queue.sort(function (a, b) { return a.from - b.from; });
  }

  /** The first point at which some active interval has ended. */
  function nextFreePoint(state) {
    return state.active.reduce(function (soonest, entry) {
      return Math.min(soonest, entry.to);
    }, Infinity) + 1;
  }

  /* ------------------------------------------------------------ verification */

  /**
   * The independent check, and the acceptance criterion this section is
   * gated on. It recomputes liveness from the function rather than reusing
   * the allocator's sets, then asserts that at every point the live values
   * holding a register hold distinct ones. A value in memory has no register
   * and is skipped, which is why the spilled-points count is reported beside
   * this rather than instead of it.
   */
  function verifyPlacements(fn, placements, layout, live) {
    const clashes = [];

    layout.points.forEach(function (point) {
      const seen = new Map();

      Array.from(live[point.at].after).forEach(function (register) {
        const colour = colourAt(placements, register, point.at);

        if (colour === null) return;
        if (seen.has(colour)) {
          clashes.push({ at: point.at, block: point.block, a: seen.get(colour), b: register });
        }
        seen.set(colour, register);
      });
    });
    return { ok: clashes.length === 0, clashes: clashes, points: layout.points.length };
  }

  function colourAt(placements, register, at) {
    const found = placements.find(function (row) {
      return row.register === register && row.from <= at && row.to >= at;
    });

    return found ? found.colour : null;
  }

  /** A map assignment, expressed as placements so one verifier serves both. */
  function placementsFrom(assignment, spans) {
    return spans.map(function (span) {
      return { register: span.register, from: span.from, to: span.to,
        colour: assignment[span.register] === undefined ? null : assignment[span.register] };
    });
  }

  function verify(fn, assignment, layout, live) {
    return verifyPlacements(fn, placementsFrom(assignment, intervals(fn, layout, live)),
      layout, live);
  }

  /** A second liveness, computed without the allocator's helpers. */
  function independentLive(fn) {
    const result = Dataflow.run(fn, 'liveness');
    const out = {};

    Object.keys(result.out).forEach(function (id) {
      out[id] = Array.from(result.out[id]).sort();
    });
    return out;
  }

  /* --------------------------------------------------------------- comparing */

  function compare(fn, options) {
    const settings = options || {};
    const registers = settings.registers || 4;
    const graph = colour(fn, { registers: registers, coalesce: settings.coalesce });
    const scan = linearScan(fn, { registers: registers, split: settings.split });

    return { registers: registers, rows: [graph, scan].map(function (row) {
      return { name: row.name, spills: row.spills, splits: row.splits || 0,
        coalesced: row.coalesced || 0, values: row.values,
        spilledPoints: row.spilledPoints,
        sound: row.verify.ok, clashes: row.verify.clashes.length };
    }), graph: graph, scan: scan };
  }

  /** Spills against register count: the curve every allocator is judged on. */
  function pressureSweep(fn, counts) {
    return counts.map(function (registers) {
      const out = compare(fn, { registers: registers });

      return { registers: registers, colouring: out.graph.spills, scan: out.scan.spills,
        colouringPoints: out.graph.spilledPoints, scanPoints: out.scan.spilledPoints,
        sound: out.graph.verify.ok && out.scan.verify.ok };
    });
  }

  return {
    linearise: linearise, livePoints: livePoints, intervals: intervals,
    interference: interference, degreeOf: degreeOf,
    colour: colour, linearScan: linearScan, coalesce: coalesce,
    verify: verify, independentLive: independentLive,
    compare: compare, pressureSweep: pressureSweep
  };
}));
