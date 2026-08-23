/**
 * Homogeneous transforms, rotation representations, and ray-triangle
 * intersection.
 *
 * Nearly every "the rotation is wrong" bug is a CONVENTION mismatch rather
 * than a maths error: row vectors against column vectors, pre-multiply against
 * post-multiply, degrees against radians, or a rotation order of XYZ where the
 * other library meant ZYX. So this file states its conventions once, here, and
 * every function obeys them:
 *
 *   - Matrices are 4x4, stored ROW-MAJOR as a flat array of 16 numbers.
 *   - Points are COLUMN vectors, so a transform is applied as M * v.
 *   - Composition reads right to left: compose(A, B) applies B first.
 *   - Angles are RADIANS everywhere.
 *   - Euler angles are intrinsic Z-Y-X unless a function says otherwise.
 *
 * Writing those five lines at the top of a graphics file is the cheapest bug
 * fix in the subject, and this module is the demonstration of why.
 *
 * Gimbal lock is here as a measurement rather than an anecdote. At a pitch of
 * exactly 90 degrees the yaw axis and the roll axis have merged, so nudging
 * yaw and nudging roll produce the SAME rotation and one degree of freedom is
 * simply gone. `gimbalCoupling` measures that directly, against the gap at
 * pitch zero: 0% lost at 0 degrees, 29.3% at 30, 45.9% at 45, 63.4% at 60,
 * 93.8% at 85, 98.8% at 89, and 100% at 90. The freedom does not disappear at
 * the pole - it drains away for the whole approach to it, which is why a
 * camera controller feels wrong long before it locks.
 *
 * Note what that is NOT measured by. Comparing the LENGTH of a Euler
 * interpolation against slerp's shows a few percent of excess at any pitch -
 * a Euler path is merely non-geodesic - and says nothing at all about the
 * pole. `eulerPathDeviation` reports that separate, smaller effect.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Transforms3D = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function report() {
    return { multiplies: 0, transforms: 0, rayTests: 0, hits: 0, misses: 0,
      edgeCases: 0, parallel: 0 };
  }

  function vec3(x, y, z) {
    return { x: x, y: y, z: z };
  }

  function add3(a, b) { return vec3(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub3(a, b) { return vec3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function scale3(a, k) { return vec3(a.x * k, a.y * k, a.z * k); }
  function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

  function cross3(a, b) {
    return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }

  function length3(a) { return Math.sqrt(dot3(a, a)); }

  function normalise3(a) {
    const len = length3(a);
    return len === 0 ? vec3(0, 0, 0) : scale3(a, 1 / len);
  }

  /* ------------------------------------------------------- matrices */

  function identity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  /** Row-major 4x4 multiply. `multiply(A, B)` applies B first, then A. */
  function multiply(a, b, stats) {
    const out = new Array(16).fill(0);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        let sum = 0;
        for (let k = 0; k < 4; k += 1) sum += a[row * 4 + k] * b[k * 4 + col];
        out[row * 4 + col] = sum;
      }
    }
    if (stats) stats.multiplies += 1;
    return out;
  }

  /** Right to left: compose(A, B, C) applies C, then B, then A. */
  function compose() {
    const list = Array.prototype.slice.call(arguments);
    return list.reduce(function (acc, m) { return multiply(acc, m); }, identity());
  }

  function translation(x, y, z) {
    return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
  }

  function scaling(x, y, z) {
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  }

  function rotationX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  }

  function rotationY(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  }

  function rotationZ(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function shearXY(factor) {
    return [1, factor, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  /** M * v, with the perspective divide applied when w is not 1. */
  function apply(m, v, stats) {
    const x = m[0] * v.x + m[1] * v.y + m[2] * v.z + m[3];
    const y = m[4] * v.x + m[5] * v.y + m[6] * v.z + m[7];
    const z = m[8] * v.x + m[9] * v.y + m[10] * v.z + m[11];
    const w = m[12] * v.x + m[13] * v.y + m[14] * v.z + m[15];
    if (stats) stats.transforms += 1;
    if (w === 0 || w === 1) return vec3(x, y, z);
    return vec3(x / w, y / w, z / w);
  }

  /** A direction ignores translation, which is what the w = 0 row means. */
  function applyDirection(m, v) {
    return vec3(
      m[0] * v.x + m[1] * v.y + m[2] * v.z,
      m[4] * v.x + m[5] * v.y + m[6] * v.z,
      m[8] * v.x + m[9] * v.y + m[10] * v.z
    );
  }

  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
      0, 0, -1, 0
    ];
  }

  /* ---------------------------------------------------- quaternions */

  function quat(w, x, y, z) {
    return { w: w, x: x, y: y, z: z };
  }

  function quatFromAxisAngle(axis, angle) {
    const unit = normalise3(axis);
    const half = angle / 2;
    const s = Math.sin(half);
    return quat(Math.cos(half), unit.x * s, unit.y * s, unit.z * s);
  }

  function quatMultiply(a, b) {
    return quat(
      a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    );
  }

  function quatNormalise(q) {
    const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    return len === 0 ? quat(1, 0, 0, 0) : quat(q.w / len, q.x / len, q.y / len, q.z / len);
  }

  function quatDot(a, b) {
    return a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /** Intrinsic Z-Y-X, matching the convention stated at the top of the file. */
  function quatFromEuler(yaw, pitch, roll) {
    return quatMultiply(
      quatMultiply(quatFromAxisAngle(vec3(0, 0, 1), yaw), quatFromAxisAngle(vec3(0, 1, 0), pitch)),
      quatFromAxisAngle(vec3(1, 0, 0), roll)
    );
  }

  function quatToMatrix(q) {
    const n = quatNormalise(q);
    const { w, x, y, z } = n;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y), 0,
      2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x), 0,
      2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y), 0,
      0, 0, 0, 1
    ];
  }

  /**
   * Spherical linear interpolation: constant angular velocity along the
   * shortest arc between two orientations. The sign flip is not optional - a
   * quaternion and its negation are the same rotation, and without the flip
   * half the interpolations take the long way round.
   */
  function slerp(a, b, t) {
    let end = quatNormalise(b);
    const start = quatNormalise(a);
    let cosine = quatDot(start, end);

    if (cosine < 0) {
      end = quat(-end.w, -end.x, -end.y, -end.z);
      cosine = -cosine;
    }
    if (cosine > 0.9995) {
      return quatNormalise(quat(
        start.w + t * (end.w - start.w), start.x + t * (end.x - start.x),
        start.y + t * (end.y - start.y), start.z + t * (end.z - start.z)
      ));
    }

    const theta = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const sinTheta = Math.sin(theta);
    const wa = Math.sin((1 - t) * theta) / sinTheta;
    const wb = Math.sin(t * theta) / sinTheta;

    return quat(start.w * wa + end.w * wb, start.x * wa + end.x * wb,
      start.y * wa + end.y * wb, start.z * wa + end.z * wb);
  }

  /** The angle between two orientations, in radians. */
  function angleBetween(a, b) {
    const cosine = Math.abs(quatDot(quatNormalise(a), quatNormalise(b)));
    return 2 * Math.acos(Math.max(-1, Math.min(1, cosine)));
  }

  /**
   * Gimbal lock, measured directly: at the pole, two of the three axes become
   * the SAME axis and one degree of freedom is gone.
   *
   * The test is to nudge yaw by delta and, separately, roll by minus delta,
   * and ask how far apart the two resulting orientations are. Away from the
   * pole they are two different rotations about two different axes, so the gap
   * is about 2 delta. At a pitch of 90 degrees the yaw axis and the roll axis
   * have merged, the two nudges produce the SAME rotation, and the gap
   * collapses to zero - which is exactly what "a degree of freedom is gone"
   * means, stated as a number rather than as a hand-wave.
   *
   * This is the honest measurement. Comparing path LENGTHS does not show it:
   * a Euler path is merely non-geodesic, which costs a few percent at any
   * pitch and says nothing about the pole.
   */
  function gimbalGap(pitch, step) {
    return angleBetween(quatFromEuler(step, pitch, 0), quatFromEuler(0, pitch, -step));
  }

  function gimbalCoupling(pitch, delta) {
    const step = delta === undefined ? 0.01 : delta;
    const gap = gimbalGap(pitch, step);

    /* The baseline is the gap at pitch zero, NOT 2 delta. At zero the two axes
       are perpendicular rather than opposed, so two nudges of delta differ by
       delta times root two - and measuring against 2 delta reports a 29% loss
       of freedom at the one pitch where none has been lost at all. */
    const baseline = gimbalGap(0, step);

    return {
      pitchDegrees: pitch * 180 / Math.PI,
      gap: gap,
      gapDegrees: gap * 180 / Math.PI,
      baseline: baseline,
      baselineDegrees: baseline * 180 / Math.PI,
      freedomLost: baseline > 0 ? 1 - gap / baseline : 0
    };
  }

  /**
   * Interpolating the three Euler angles separately is not the same path as
   * interpolating the orientation. The number returned is the total extra
   * rotation the Euler path travels compared with the direct one - a real
   * cost, and a different phenomenon from gimbal lock above.
   */
  function eulerPathDeviation(fromEuler, toEuler, steps) {
    const n = steps || 64;
    const start = quatFromEuler(fromEuler.yaw, fromEuler.pitch, fromEuler.roll);
    const end = quatFromEuler(toEuler.yaw, toEuler.pitch, toEuler.roll);
    const direct = angleBetween(start, end);

    let eulerTravel = 0;
    let slerpTravel = 0;
    let previousEuler = start;
    let previousSlerp = start;

    for (let i = 1; i <= n; i += 1) {
      const t = i / n;
      const stepEuler = quatFromEuler(
        fromEuler.yaw + (toEuler.yaw - fromEuler.yaw) * t,
        fromEuler.pitch + (toEuler.pitch - fromEuler.pitch) * t,
        fromEuler.roll + (toEuler.roll - fromEuler.roll) * t
      );
      const stepSlerp = slerp(start, end, t);
      eulerTravel += angleBetween(previousEuler, stepEuler);
      slerpTravel += angleBetween(previousSlerp, stepSlerp);
      previousEuler = stepEuler;
      previousSlerp = stepSlerp;
    }

    return {
      direct: direct,
      euler: eulerTravel,
      slerp: slerpTravel,
      excess: eulerTravel - slerpTravel,
      ratio: slerpTravel > 0 ? eulerTravel / slerpTravel : 0
    };
  }

  /* ------------------------------------------- ray-triangle intersection */

  const RAY_EPSILON = 1e-12;

  /**
   * Moller-Trumbore. Returns the hit distance along the ray and the
   * barycentric coordinates, which is what makes it useful beyond a yes or no:
   * u and v interpolate anything stored at the vertices - colour, normal, a
   * texture coordinate - without a second computation.
   *
   * `cull` decides whether a triangle facing away from the ray counts. It is a
   * rendering decision that reaches into the intersection routine, and leaving
   * it implicit is how a mesh comes out with holes in it.
   */
  function rayTriangle(origin, direction, a, b, c, options) {
    const settings = options || {};
    const stats = settings.report || report();
    if (stats) stats.rayTests += 1;

    const e1 = sub3(b, a);
    const e2 = sub3(c, a);
    const pvec = cross3(direction, e2);
    const determinant = dot3(e1, pvec);

    if (settings.cull && determinant < RAY_EPSILON) { stats.misses += 1; return null; }
    if (Math.abs(determinant) < RAY_EPSILON) { stats.parallel += 1; stats.misses += 1; return null; }

    const inverse = 1 / determinant;
    const tvec = sub3(origin, a);
    const u = dot3(tvec, pvec) * inverse;
    if (u < 0 || u > 1) { stats.misses += 1; return null; }

    const qvec = cross3(tvec, e1);
    const v = dot3(direction, qvec) * inverse;
    if (v < 0 || u + v > 1) { stats.misses += 1; return null; }

    const t = dot3(e2, qvec) * inverse;
    if (t < 0) { stats.misses += 1; return null; }

    stats.hits += 1;
    if (u === 0 || v === 0 || u + v === 1) stats.edgeCases += 1;

    return { t: t, u: u, v: v, w: 1 - u - v,
      point: add3(origin, scale3(direction, t)) };
  }

  /** Barycentric coordinates reconstruct the point, which is the check. */
  function fromBarycentric(a, b, c, u, v) {
    const w = 1 - u - v;
    return vec3(
      a.x * w + b.x * u + c.x * v,
      a.y * w + b.y * u + c.y * v,
      a.z * w + b.z * u + c.z * v
    );
  }

  /**
   * An independent reference: intersect the ray with the triangle's PLANE,
   * then test the point against the triangle using three edge cross products.
   * Slower, structured completely differently, and the reason the fast routine
   * can be believed.
   */
  function rayTrianglePlane(origin, direction, a, b, c) {
    const normal = cross3(sub3(b, a), sub3(c, a));
    const denominator = dot3(normal, direction);
    if (Math.abs(denominator) < RAY_EPSILON) return null;

    const t = dot3(normal, sub3(a, origin)) / denominator;
    if (t < 0) return null;
    const p = add3(origin, scale3(direction, t));

    const tests = [
      dot3(normal, cross3(sub3(b, a), sub3(p, a))),
      dot3(normal, cross3(sub3(c, b), sub3(p, b))),
      dot3(normal, cross3(sub3(a, c), sub3(p, c)))
    ];
    if (tests.some(function (value) { return value < -RAY_EPSILON; })) return null;
    return { t: t, point: p };
  }

  return {
    report: report,
    vec3: vec3, add3: add3, sub3: sub3, scale3: scale3, dot3: dot3,
    cross3: cross3, length3: length3, normalise3: normalise3,
    identity: identity, multiply: multiply, compose: compose,
    translation: translation, scaling: scaling, shearXY: shearXY,
    rotationX: rotationX, rotationY: rotationY, rotationZ: rotationZ,
    apply: apply, applyDirection: applyDirection, perspective: perspective,
    quat: quat, quatFromAxisAngle: quatFromAxisAngle, quatMultiply: quatMultiply,
    quatNormalise: quatNormalise, quatDot: quatDot, quatFromEuler: quatFromEuler,
    quatToMatrix: quatToMatrix, slerp: slerp, angleBetween: angleBetween,
    gimbalCoupling: gimbalCoupling,
    eulerPathDeviation: eulerPathDeviation,
    rayTriangle: rayTriangle, rayTrianglePlane: rayTrianglePlane,
    fromBarycentric: fromBarycentric
  };
}));
