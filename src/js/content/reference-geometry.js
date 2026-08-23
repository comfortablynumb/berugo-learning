/** Reference entries for primitives, polygons and convex hulls (M16.1-M16.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'geometry-primitives': {
      summary: 'One predicate under everything in the milestone, three ways to compute it, and a ' +
        'measurement that ranks them differently from the way everyone expects.',
      intuition: 'A wrong sign is not an inaccuracy, it is a contradiction — and the tolerance that ' +
        'removes the contradiction removes the answer with it.',
      formulation: {
        equations: [
          {
            label: 'The predicate',
            expr: 'the SIGN of (b − a) × (c − a): left (+1), right (−1) or collinear (0)',
            terms: [
              { sym: 'the magnitude', meaning: 'twice the triangle area, and never read by anything above it' },
              { sym: 'the consistency law', meaning: 'the three rotations agree; all three swaps give the opposite sign' },
              { sym: 'measured', meaning: 'the default triple reads 4.441e-16 in floating point and is a left turn exactly' }
            ]
          },
          {
            label: 'The three implementations, over 4 000 near-collinear triples',
            expr: 'self-contradiction and wrongness are separate columns',
            terms: [
              { sym: 'naive determinant', meaning: '1 121 self-contradictions, 642 wrong answers — fails loudly' },
              { sym: 'value compared against 1e-12', meaning: '0 self-contradictions, 4 000 wrong answers — fails quietly' },
              { sym: 'adaptive', meaning: '0 and 0' },
              { sym: 'the column nobody checks', meaning: 'the epsilon test calls a real turn collinear 4 000 times; the naive test 0 times' }
            ]
          },
          {
            label: 'The filter',
            expr: 'trust the sign when |value| exceeds a bound computed from the operands, otherwise redo it exactly',
            terms: [
              { sym: 'why not a fixed epsilon', meaning: 'a hand-picked constant is a guess about the input scale, so it is wrong on data of another size' },
              { sym: 'the exact path', meaning: 'every double is an integer times a power of two, so scaling by 2ᵏ makes the determinant exact integer arithmetic' },
              { sym: 'measured cost', meaning: '0.00% escalation on ordinary points, 62.67% on adversarial triples — 2 507 of 4 000' }
            ]
          },
          {
            label: 'The escape',
            expr: 'integer coordinates make the fast path the exact path',
            terms: [
              { sym: 'where it applies', meaning: 'tiles, pixels, CAD grids, fixed-point world coordinates' },
              { sym: 'the cost', meaning: 'a snap at the system boundary, which is a correctness decision rather than preprocessing' },
              { sym: 'in-circle', meaning: 'the same story one dimension up, and more fragile — squaring the coordinates squares the range the determinant must resolve' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The three rotations of a triple give the same sign',
          why: 'Downstream code assumes it without ever stating it.',
          breaks: 'A hull walk pops a vertex it should keep, pushes it back, and loops forever.'
        },
        {
          name: 'Swapping two arguments flips the sign',
          why: 'It is checkable with no ground truth at all — you need not know the right answer.',
          breaks: 'Two incompatible arrangements of the same three points reach the caller.'
        },
        {
          name: 'The filter never answers when rounding could have flipped the sign',
          why: 'That is the whole difference between a bound and a tolerance.',
          breaks: 'A filter tuned by hand is wrong on inputs of a different magnitude.'
        },
        {
          name: 'Escalation is measured, not assumed',
          why: 'The rate is the honest answer to "what does robustness cost".',
          breaks: 'Without the counter, the argument for the exact path is a belief.'
        }
      ],
      complexity: [
        { operation: 'orient2d, filtered path', average: 'a determinant plus one comparison', worst: 'answers 100% of ordinary calls — 4 000 of 4 000' },
        { operation: 'orient2d, exact path', average: 'runs only inside the error bound', worst: '62.67% of adversarial triples — 2 507 of 4 000' },
        { operation: 'orient2d, naive', average: 'fastest and wrong near the line', worst: '1 121 contradictions and 642 wrong answers in 4 000' },
        { operation: 'orient2d, epsilon', average: 'as fast as naive', worst: '4 000 wrong answers in 4 000, and 0 contradictions' },
        { operation: 'inCircle', average: 'the same shape of filter, one dimension up', worst: 'more fragile: the lifted coordinates square the dynamic range' },
        { operation: 'integer coordinates', average: 'exact with no filter at all', worst: 'bounded by the coordinate range a double holds exactly' }
      ],
      failureModes: [
        {
          symptom: 'A convex hull loops forever, or a triangulation reports a triangle with no area.',
          cause: 'The orientation test answered differently for the same three points in a different order.',
          fix: 'Run the six-permutation check on the failing triple; it needs no expected answer to convict.'
        },
        {
          symptom: 'The crash goes away after a tolerance is added, and vertices start disappearing.',
          cause: 'The tolerance answers "collinear" for triples that are not, so real hull points are dropped.',
          fix: 'Replace the constant with a bound computed from the operands, and escalate inside it.'
        },
        {
          symptom: 'Geometry that is correct in tests is wrong on production coordinates.',
          cause: 'The epsilon was tuned against inputs of one magnitude and the real data has another.',
          fix: 'Nothing scale-dependent may be a literal; either compute the bound or snap to integers.'
        },
        {
          symptom: 'The robust predicate is rejected on performance grounds with no measurement.',
          cause: 'The exact path is assumed to run often.',
          fix: 'Count escalations: on ordinary data it was 0 of 4 000 calls.'
        }
      ],
      inTheWild: [
        { system: 'CGAL', how: 'exact predicates with inexact constructions is the default kernel, for exactly this reason' },
        { system: 'Shewchuk\'s predicates.c', how: 'the adaptive orient2d and incircle nearly every mesh generator links against' },
        { system: 'JTS and GEOS', how: 'coordinates are snapped to a precision model before boolean operations' },
        { system: 'Mapbox and map tiling', how: 'tile-local integer coordinates make the naive determinant exact by construction' }
      ],
      sources: [
        { title: 'Adaptive Precision Floating-Point Arithmetic and Fast Robust Geometric Predicates', where: 'Jonathan Shewchuk — Discrete & Computational Geometry, 1997' },
        { title: 'Classroom Examples of Robustness Problems in Geometric Computations', where: 'Kettner, Mehlhorn, Pion, Schirra, Yap — ESA, 2004' },
        { title: 'Computational Geometry: Algorithms and Applications', where: 'de Berg, Cheong, van Kreveld, Overmars — 3rd edition, 2008' },
        { title: 'What Every Computer Scientist Should Know About Floating-Point Arithmetic', where: 'David Goldberg — ACM Computing Surveys, 1991' }
      ]
    },

    'polygon-containment': {
      summary: 'Signed area from one pass, two containment rules that are the same function until ' +
        'the ring crosses itself, and the condition under which they come apart.',
      intuition: 'Ray casting counts crossings and the winding number counts them with a sign; the ' +
        'polygon does not say which is meant, the fill rule does.',
      formulation: {
        equations: [
          {
            label: 'The shoelace sum',
            expr: 'twice the area is the sum of x[i]·y[i+1] − x[i+1]·y[i] around the ring',
            terms: [
              { sym: 'the sign', meaning: 'the ring\'s orientation, which an absolute value destroys unrecoverably' },
              { sym: 'measured', meaning: 'the pentagram encloses 3 600.00 wound counter-clockwise; the bowtie\'s lobes cancel to 0.0' },
              { sym: 'no convexity needed', meaning: 'the trapezoids outside the ring cancel, whatever the shape' }
            ]
          },
          {
            label: 'The two rules',
            expr: 'even-odd asks whether the crossing count is odd; non-zero asks whether the signed total is not zero',
            terms: [
              { sym: 'at the pentagram centre', meaning: '2 crossings and a winding number of 2 — even parity says out, non-zero says in' },
              { sym: 'measured', meaning: '44 of 441 probes disagree, 10.0% of the grid, and they form the central pentagon' },
              { sym: 'the standards', meaning: 'SVG defaults to non-zero; the simple-feature model calls the ring invalid and leaves it undefined' }
            ]
          },
          {
            label: 'When a disagreement is possible at all',
            expr: 'a region the ring encircles TWICE — not merely a self-intersection',
            terms: [
              { sym: 'the 8 fixtures', meaning: '6 simple polygons produce 0 disagreements, as they must' },
              { sym: 'the bowtie', meaning: 'not simple and still 0 disagreements: each lobe is encircled exactly once' },
              { sym: 'the pentagram', meaning: '5 self-intersections and a doubly-wound centre — the only fixture that disagrees' }
            ]
          },
          {
            label: 'Convexity, and simplification',
            expr: 'all turns agreeing is necessary and not sufficient; the total turning must be one revolution',
            terms: [
              { sym: 'the counterexample', meaning: 'the pentagram\'s 5 turns all agree and it turns through two full revolutions' },
              { sym: 'Douglas-Peucker', meaning: 'bounds how far the outline may move' },
              { sym: 'Visvalingam', meaning: 'drops the least significant area first, which degrades a coastline more gracefully' },
              { sym: 'neither preserves', meaning: 'simplicity — a simplified ring can cross itself and must be re-checked' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'On a simple polygon the two containment rules agree everywhere',
          why: 'They are the same function there, so a disagreement is an implementation bug.',
          breaks: 'A disagreeing probe on a simple ring means one of the two loops is miscounting.'
        },
        {
          name: 'A ray through a vertex counts one crossing, not two and not zero',
          why: 'The half-open y comparison is the entire handling of that case.',
          breaks: 'Parity flips wrongly and a band of points along one scanline is reported inside out.'
        },
        {
          name: 'Signed area keeps its sign until something deliberately drops it',
          why: 'Orientation is not recoverable once an absolute value has been taken.',
          breaks: 'A boolean operation traverses the wrong way and returns the complement.'
        },
        {
          name: 'Simplification does not silently open or cross the ring',
          why: 'Both algorithms can produce a self-intersecting result from a simple input.',
          breaks: 'A downstream containment test then answers a question with no defined answer.'
        }
      ],
      complexity: [
        { operation: 'shoelace area', average: 'Θ(n), one pass', worst: 'exact on integer coordinates' },
        { operation: 'ray casting', average: 'Θ(n) per query', worst: 'the vertex case needs the half-open rule to stay correct' },
        { operation: 'winding number', average: 'Θ(n) per query, same loop', worst: 'differs from ray casting only where the ring winds twice' },
        { operation: 'convexity test', average: 'Θ(n) for the turn signs', worst: 'the turning number too, or the pentagram passes' },
        { operation: 'Douglas-Peucker', average: 'Θ(n log n) expected', worst: 'Θ(n²) on adversarial input' },
        { operation: 'self-intersection detection', average: 'Θ(n log n) by sweep', worst: 'Θ(n²) pairwise — 5 crossings found on the pentagram' }
      ],
      failureModes: [
        {
          symptom: 'A shape renders filled in the browser and comes back with a hole from the database.',
          cause: 'The two systems apply different fill rules to a self-intersecting ring.',
          fix: 'Validate rings at the boundary; past that point the question has no single right answer.'
        },
        {
          symptom: 'Points along one horizontal line are reported inside when they are outside.',
          cause: 'A ray passing exactly through a vertex counted two crossings.',
          fix: 'Use the half-open y interval so each vertex contributes once.'
        },
        {
          symptom: 'A clipping or calipers routine returns nonsense on a shape that passed the convexity check.',
          cause: 'The check tested only that the turns agreed, which a pentagram satisfies.',
          fix: 'Check the total turning as well as the signs.'
        },
        {
          symptom: 'Simplified boundaries develop crossings and slivers at low zoom.',
          cause: 'Douglas-Peucker moved a vertex past a neighbouring edge.',
          fix: 'Re-run the self-intersection check after simplifying, or simplify topology rather than rings.'
        }
      ],
      inTheWild: [
        { system: 'SVG and Canvas', how: 'fill-rule is a property; nonzero is the default and evenodd the opt-in' },
        { system: 'PostGIS and GEOS', how: 'ST_IsValid rejects self-intersecting rings rather than choosing a rule' },
        { system: 'Mapbox and map rendering', how: 'Douglas-Peucker per zoom level, with a topology-preserving variant for shared borders' },
        { system: 'Hit testing in UI toolkits', how: 'ray casting with a tolerance band, so the boundary is a third answer by design' }
      ],
      sources: [
        { title: 'Computational Geometry in C', where: 'Joseph O\'Rourke — 2nd edition, 1998' },
        { title: 'Algorithms for reporting and counting geometric intersections', where: 'Bentley, Ottmann — IEEE Transactions on Computers, 1979' },
        { title: 'Algorithms for the reduction of the number of points required to represent a digitized line', where: 'Douglas, Peucker — Cartographica, 1973' },
        { title: 'Line generalisation by repeated elimination of points', where: 'Visvalingam, Whyatt — The Cartographic Journal, 1993' },
        { title: 'Scalable Vector Graphics 1.1 — the fill-rule property', where: 'W3C Recommendation, 2011' }
      ]
    },

    'convex-hulls': {
      summary: 'Four algorithms for a unique answer, an output-sensitive bound that is a bet rather ' +
        'than an improvement, and one undocumented parameter that changes the result by 30×.',
      intuition: 'The hull is unique, so the only variables are what each algorithm spends and what ' +
        'it does with the points sitting exactly on an edge.',
      formulation: {
        equations: [
          {
            label: 'The monotone chain',
            expr: 'sort lexicographically, sweep forward for the lower hull and backward for the upper, popping wrong turns',
            terms: [
              { sym: 'why it is the default', meaning: 'no angular comparator, no pivot special case, no trigonometry' },
              { sym: 'measured', meaning: '789 orientation tests and 1 262 sort comparisons on 200 points' },
              { sym: 'the pop rule', meaning: 'one comparison — and its ≤ or < is the collinear policy' }
            ]
          },
          {
            label: 'The four bills for one hull',
            expr: 'identical 12-vertex output from 200 points, at four different costs',
            terms: [
              { sym: 'monotone chain', meaning: '789 orientation tests, 1 262 comparisons' },
              { sym: 'quickhull', meaning: '1 314 tests, 0 comparisons' },
              { sym: 'Graham scan', meaning: '1 651 tests, 1 253 comparisons' },
              { sym: 'gift wrapping', meaning: '2 400 tests, 0 comparisons — 3.04× the cheapest' }
            ]
          },
          {
            label: 'Output sensitivity is a bet on h',
            expr: 'O(n·h) against O(n log n): the point set decides, not the bound',
            terms: [
              { sym: '1 024 points, 16 on the hull', meaning: 'gift wrapping 16 384 orientation tests' },
              { sym: '1 024 points on a circle', meaning: '1 047 552 tests — 63.9× more from the same n' },
              { sym: 'the monotone chain', meaning: '4 077 against 4 090 — it barely notices' }
            ]
          },
          {
            label: 'The collinear policy',
            expr: 'points exactly on a hull edge are kept or dropped, and both are correct',
            terms: [
              { sym: '60 collinear points', meaning: '2 vertices under drop, 60 under keep' },
              { sym: 'a 60-point grid', meaning: '5 against 24' },
              { sym: 'the contract', meaning: 'all four algorithms agree on all 5 degenerate sets under both policies' },
              { sym: 'drop wants', meaning: 'area, calipers, containment; keep wants outlines and index mapping' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every input point lies inside or on the returned ring',
          why: 'Half of the oracle; a too-small hull passes the turn check on its own.',
          breaks: 'A hull built on a tolerance-based predicate drops real vertices and still looks convex.'
        },
        {
          name: 'Every turn around the ring has the same sign',
          why: 'The other half; a ring containing everything can still zigzag.',
          breaks: 'Calipers and clipping both assume convexity and give confident wrong answers without it.'
        },
        {
          name: 'The hull is unique, so all implementations must agree',
          why: 'It makes cross-checking a real test rather than a heuristic one.',
          breaks: 'A disagreement is a bug in one of them, never a difference of opinion.'
        },
        {
          name: 'The collinear policy is stated, not inherited',
          why: 'It is one character in the pop comparison and changes the vertex count by up to 30×.',
          breaks: 'Downstream area, rendering and index-mapping code each break differently.'
        }
      ],
      complexity: [
        { operation: 'monotone chain', average: 'Θ(n log n), dominated by the sort', worst: '789 orientation tests on 200 points' },
        { operation: 'Graham scan', average: 'Θ(n log n) with an angular sort', worst: '1 651 tests — the comparator costs predicate calls' },
        { operation: 'quickhull', average: 'Θ(n log n) expected', worst: 'Θ(n²) when almost every point is on the hull' },
        { operation: 'gift wrapping', average: 'Θ(n·h)', worst: '1 047 552 tests at n = h = 1 024' },
        { operation: 'hull of hulls', average: 'exact — the hull of a union is the hull of the parts\' hulls', worst: 'reduces 200 points to 12 before the merge' },
        { operation: 'the oracle', average: 'Θ(n·h) containment plus Θ(h) turns', worst: 'cheap enough to run inside a property test' }
      ],
      failureModes: [
        {
          symptom: 'A hull routine hangs or returns a ring that crosses itself.',
          cause: 'The orientation predicate contradicted itself on nearly collinear input.',
          fix: 'Use the adaptive predicate, or make the coordinates integers.'
        },
        {
          symptom: 'A shape rendered from the hull has a duplicated or missing corner.',
          cause: 'The collinear policy differs between the producer and the consumer.',
          fix: 'Make the policy an explicit parameter and state which one the output used.'
        },
        {
          symptom: 'Hull computation is fast in testing and unusable in production.',
          cause: 'An output-sensitive algorithm met data where nearly every point is extreme.',
          fix: 'Measure h on real data; the same n cost 63.9× more when the points sat on a circle.'
        },
        {
          symptom: 'A hull passes on random clouds and fails on a real dataset.',
          cause: 'The degenerate cases were never tested — collinear, coincident and grid-aligned points.',
          fix: 'Run the five degenerate generators under both policies and require all implementations to agree.'
        }
      ],
      inTheWild: [
        { system: 'Qhull', how: 'quickhull in n dimensions, behind SciPy, MATLAB and most scientific stacks' },
        { system: 'Collision detection engines', how: 'convex hulls as proxies, because overlap tests are cheap on convex shapes' },
        { system: 'Spatial indexes', how: 'a hull per leaf as a cheap summary, since the hull of a union is the hull of the hulls' },
        { system: 'Linear programming and statistics', how: 'the feasible region and the convex peeling of an outlier set are both hulls' }
      ],
      sources: [
        { title: 'Another efficient algorithm for convex hulls in two dimensions', where: 'A. M. Andrew — Information Processing Letters, 1979' },
        { title: 'An efficient algorithm for determining the convex hull of a finite planar set', where: 'Ronald Graham — Information Processing Letters, 1972' },
        { title: 'On the identification of the convex hull of a finite set of points in the plane', where: 'R. A. Jarvis — Information Processing Letters, 1973' },
        { title: 'The Quickhull Algorithm for Convex Hulls', where: 'Barber, Dobkin, Huhdanpaa — ACM TOMS, 1996' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
