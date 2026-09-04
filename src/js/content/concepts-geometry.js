/** Concepts for primitives, polygons and convex hulls (M16.1-M16.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'geometry-primitives': [
      {
        term: 'One question, asked by every algorithm in the milestone',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["three points: P, Q, R"] --> B{"which side of the line PQ<br/>does R fall on?"}',
            '    B -->|left| C["positive"]',
            '    B -->|right| D["negative"]',
            '    B -->|exactly on it| E["zero"]',
            '    C --> F["hulls, sweeps, triangulation<br/>and containment are all<br/>built from this one test"]',
            '    D --> F',
            '    E --> F'
          ].join('\n'),
          caption: 'Almost nothing in computational geometry asks for a distance or an angle. It asks which side, and the whole milestone rests on getting that sign right.'
        },
        plain: 'Given three points, is the third to the left of the line through the first two, to its right, or on it?',
        formal: 'orient2d(a, b, c) returns the SIGN of (b − a) × (c − a), and only the sign is ever used',
        readAs: 'Take the vector from a to b and the vector from a to c, and form their cross ' +
          'product. Throw the magnitude away: what the caller wants is whether it came out ' +
          'positive, negative or zero.',
        detail: [
          'Convex hulls, point-in-polygon, segment intersection, ear clipping and Delaunay flips are ' +
            'all this single test repeated.',
          'It is a two-by-two determinant, and its magnitude is twice the area of the triangle. But ' +
            'no algorithm above it reads the magnitude — only whether it is positive, negative or ' +
            'zero.',
          'That matters enormously. A result that is off by a percent is harmless. A result whose ' +
            'sign is wrong is not an inaccuracy at all: it is a false statement about how three ' +
            'points are arranged.'
        ],
        example: 'The default triple has c one unit in the last place off the line, and the exact ' +
          'answer is a left turn (+1); the floating-point determinant reads 4.441e-16.'
      },
      {
        term: 'A wrong sign is a contradiction, not an error bar',
        plain: 'Rotating the three arguments must not change the answer, and swapping two must flip it.',
        formal: 'the three rotations agree with each other and disagree with all three swaps — six calls, one fact',
        detail: [
          'This is the property everything downstream leans on without ever stating it.',
          'A hull walk that is told a is left of bc and simultaneously that c is left of ba has been ' +
            'handed two incompatible arrangements of the same three points. There is no recovery: ' +
            'the stack pops a vertex it should have kept, pushes it back, and loops.',
          'The permutation table is worth running before any geometry code is trusted, because it ' +
            'needs no ground truth. You do not have to know the right answer to know that these six ' +
            'cannot all be right.'
        ],
        example: 'On the default triple the naive determinant answers left, collinear, left for the ' +
          'three rotations — it contradicts itself on the very first fixture.'
      },
      {
        term: 'The tolerance test is self-consistent and always wrong',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["treat anything smaller<br/>than epsilon as zero"] --> B["the contradictions disappear"]',
            '    B --> C["because everything near the line<br/>is now reported as on it"]',
            '    C --> D["three points in a row are collinear,<br/>and so are three points that are not"]',
            '    D --> E["consistent, and useless"]'
          ].join('\n'),
          caption: 'A tolerance does not make the predicate correct, it makes it agree with itself. The failures stop being visible without stopping.'
        },
        plain: 'Treating a small value as zero makes the contradictions vanish and makes every answer "collinear".',
        formal: 'over 4 000 near-collinear triples: 0 contradictions, 4 000 wrong answers',
        detail: [
          'Almost everyone reaches for a tolerance first, and the sweep is the argument against it.',
          'The epsilon test scores zero in the column people check, because it answers "collinear" ' +
            'for everything near the line. It scores 4 000 in the column that decides whether the ' +
            'program is correct, because those triples are not collinear.',
          'It is not a compromise between the naive test and the exact one. It is a third, different ' +
            'failure, and the quieter of the two: nothing crashes, and the hull simply comes out ' +
            'missing vertices that were genuinely on it.'
        ],
        example: 'At an epsilon of 1e-12 the tolerance test calls a real turn collinear 4 000 times ' +
          'out of 4 000, while the naive test does it 0 times.'
      },
      {
        term: 'The naive test fails loudly, which is the better of the two failures',
        plain: 'It contradicts itself on about a quarter of near-collinear triples and is outright wrong on about a sixth.',
        formal: '1 121 self-contradictions and 642 wrong answers in 4 000 triples',
        detail: [
          'The plain determinant is not merely imprecise near the line. It is inconsistent, because ' +
            'the subtractions inside it round differently depending on which argument came first.',
          'That is why the crash it produces is easier to live with than the tolerance test\'s ' +
            'silence. A hull that loops forever gets debugged; a hull that quietly drops three ' +
            'vertices ships.',
          'Note also which column is empty for it. The naive test never calls a real turn collinear, ' +
            'so its errors are all sign flips rather than degeneracy claims.'
        ],
        example: 'The same sweep gives the adaptive predicate 0 contradictions and 0 wrong answers.'
      },
      {
        term: 'Measure the rounding error rather than guessing at it',
        plain: 'Compute the determinant, compute a bound on how far rounding could have moved it, and trust the sign only outside the bound.',
        formal: 'if |value| > ε × (|left| + |right|) the sign is certain; otherwise redo the arithmetic exactly',
        readAs: 'Compare the size of the answer against an error bar built from the size of the two ' +
          'products that made it. When the answer is bigger than its own error bar its sign cannot be ' +
          'a rounding artefact, and nothing further needs to run.',
        detail: [
          'An epsilon chosen by hand is a guess about the magnitude of the inputs, which is why it ' +
            'is wrong on data of a different scale.',
          'The bound here is computed from the operands themselves, so it scales with them ' +
            'automatically. It is a genuine bound rather than a heuristic: floating-point rounding ' +
            'provably cannot have moved the value further than that.',
          'The result is a filter that is never wrong when it answers, and knows when it must not ' +
            'answer.'
        ],
        example: 'On ordinary points the filter answers all 4 000 calls itself and escalates 0 times.'
      },
      {
        term: 'Exactly is available, not aspirational',
        plain: 'Every finite double is an integer times a power of two, so scaling the coordinates up makes the determinant integer arithmetic.',
        formal: 'scale by 2ᵏ into exact integers, evaluate the determinant in BigInt, read the sign',
        readAs: 'Multiplying every coordinate by a large enough power of two turns all of them into ' +
          'whole numbers, with no loss whatever. Whole-number arithmetic in BigInt cannot round, so ' +
          'the sign it produces is the true one.',
        detail: [
          'People assume the exact path means arbitrary-precision decimals and a large dependency. ' +
            'It does not.',
          'A double is a sign, a 53-bit integer and an exponent — that is the definition of the ' +
            'format, not an approximation of it. So a common scaling turns the whole triple into ' +
            'integers exactly, and BigInt then evaluates a determinant of three products with no ' +
            'rounding at all.',
          'Shewchuk\'s adaptive predicates get the same guarantee faster, by summing exact partial ' +
            'terms only until the sign is settled. The idea is this one.'
        ],
        example: 'The exact path decides every one of the 2 507 triples the filter refused to answer.'
      },
      {
        term: 'Robustness is free on the data you actually have',
        plain: 'The exact path runs only when the points are close to collinear, and ordinary data never is.',
        formal: '0.00% escalation on ordinary points against 62.67% on triples built to be hard',
        detail: [
          'This is what makes the choice easy, and it is the number to quote when someone objects to ' +
            'the cost.',
          'The adaptive predicate is not a trade of speed against correctness on your inputs. It is ' +
            'a trade of speed against correctness on the inputs that would otherwise give a wrong ' +
            'answer.',
          'On the ordinary set the slow path did not run once in 4 000 calls, so the measured cost ' +
            'of robustness there is the error-bound comparison and nothing else.'
        ],
        example: '4 000 predicate calls on ordinary points escalated 0 times; the same count on ' +
          'adversarial triples escalated 2 507 times.'
      },
      {
        term: 'Integer coordinates make the whole problem evaporate',
        plain: 'If the inputs can be integers within the range a double represents exactly, the naive determinant is already exact.',
        formal: 'coordinates below 2²⁶ keep the determinant\'s products and difference exact in a double',
        detail: [
          'This is the practical escape, and it is chosen far too rarely.',
          'Map tiles, screen pixels, CAD grids and fixed-point world coordinates are all integers, ' +
            'and a determinant over small integers has no rounding to be robust against. The fast ' +
            'path is then the exact path.',
          'The cost is a decision at the boundary of the system rather than inside it: snap on ' +
            'input, and document the grid. Every library that snaps coordinates before a boolean ' +
            'operation is making this trade, and calling it preprocessing rather than what it is — a ' +
            'correctness decision.'
        ],
        example: 'The section\'s adversarial triple is built from full-mantissa values like ' +
          '0.15608477592468262 for exactly this reason. A tidy line through 0.5 with slope 1 never ' +
          'rounds, and the naive test behaves perfectly on it.'
      },
      {
        term: 'In-circle is the same story with one more dimension',
        plain: 'Does d lie inside the circle through a, b and c? It is a 4×4 determinant with the same failure mode.',
        formal: 'the sign of a determinant in the lifted coordinates x, y, x² + y², and only the sign',
        detail: [
          'Delaunay triangulation and every flip-based mesh repair rest on this predicate exactly as ' +
            'hulls rest on orientation.',
          'Lifting each point onto the paraboloid turns "inside the circumcircle" into "below the ' +
            'plane through the other three", which is another orientation test one dimension up.',
          'It has the same three implementations with the same three behaviours, and it is more ' +
            'fragile than orient2d rather than less. Squaring the coordinates squares the dynamic ' +
            'range the determinant has to resolve.'
        ],
        example: 'The triangulation section runs 7 531 predicate calls and needs the exact path 0 ' +
          'times — the same shape of answer as here.'
      }
    ],

    'polygon-containment': [
      {
        term: 'The shoelace sum gives area and orientation in one pass',
        plain: 'Sum the cross products of consecutive vertex pairs and halve it; the sign says which way the ring is wound.',
        formal: 'twice the area is the sum of x[i]·y[i+1] − x[i+1]·y[i] around the ring',
        readAs: 'Walk the vertices in order, and for each consecutive pair add the first vertex\'s x ' +
          'times the second\'s y and subtract the second\'s x times the first\'s y. The total is twice ' +
          'the signed area.',
        detail: [
          'It needs no triangulation and no convexity, and it works on any simple polygon, because ' +
            'the positive and negative trapezoids under each edge cancel outside the ring.',
          'The sign is not a nuisance to be stripped with an absolute value. It is the polygon\'s ' +
            'orientation, which is what tells a renderer which side is inside and a boolean ' +
            'operation which way to traverse.',
          'Taking the absolute value at the point of computation is how that information gets lost, ' +
            'and it is not recoverable later.'
        ],
        example: 'The pentagram\'s ring encloses 3 600.00 of signed area wound counter-clockwise; the ' +
          'bowtie\'s two lobes cancel exactly and it reports 0.0.'
      },
      {
        term: 'Ray casting counts crossings; the winding number counts them with a sign',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["shoot a ray from the point"] --> B["ray casting: is the number<br/>of crossings odd?"]',
            '    A --> C["winding: add +1 upward,<br/>−1 downward — is the total non-zero?"]',
            '    B --> D["they agree on simple polygons"]',
            '    C --> D',
            '    D --> E["and disagree on self-intersecting ones,<br/>which is why the fill rule is a setting"]'
          ].join('\n'),
          caption: 'Two rules that look like the same test give different answers on a self-overlapping shape. Graphics APIs expose both because neither is more correct.'
        },
        plain: 'Both shoot the same ray. One asks whether the count is odd, the other whether the signed total is non-zero.',
        formal: 'even-odd: crossings mod 2; non-zero: the sum of ±1 over the same crossings',
        readAs: 'Fire a ray from the test point and look at every edge it crosses. The first rule ' +
          'keeps only whether the number of crossings is odd. The second adds one for an edge crossing ' +
          'upward and subtracts one for an edge crossing downward, and asks whether the total is ' +
          'anything other than zero.',
        detail: [
          'On a simple polygon the two rules are the same function computed two ways, which is why ' +
            'the difference goes unnoticed for years.',
          'They come apart exactly where the ring wraps a region more than once. Two crossings is an ' +
            'even count, so even-odd says outside; two crossings in the same direction is a winding ' +
            'number of two, so non-zero says inside.',
          'Neither is a bug. The polygon does not carry the answer, the fill rule does, and the fill ' +
            'rule is a choice the format made.'
        ],
        example: 'At the pentagram\'s centre the ray crosses 2 edges and the winding number is 2 — ' +
          'even-odd says out, non-zero says in.'
      },
      {
        term: 'Self-intersection is necessary for a disagreement and not sufficient',
        plain: 'The bowtie crosses itself and the two rules still agree everywhere on it.',
        formal: 'a disagreement needs a region the ring encircles TWICE, not merely a crossing',
        detail: [
          'This is the distinction the shapes table exists to draw, and it is worth more than the ' +
            'headline.',
          'Every simple polygon in the set produces zero disagreeing probes however fine the grid, ' +
            'as it must. Of the two non-simple polygons only the pentagram disagrees: its five ' +
            'points are arranged so that the centre pentagon is enclosed twice in the same direction.',
          'The bowtie crosses itself once, but each lobe is encircled exactly once. So an odd ' +
            'crossing count and a non-zero winding still say the same thing about every point.'
        ],
        example: 'Of the 8 fixture polygons, 2 are not simple and only 1 produces a disagreement — 44 ' +
          'of 441 probes on the pentagram, and 0 on the bowtie.'
      },
      {
        term: 'GIS and SVG made opposite choices, and both are still making them',
        plain: 'The non-zero rule is the graphics default and the even-odd rule is the one most geometry libraries assume.',
        formal: 'SVG fill-rule takes nonzero as its default; simple-feature geometry forbids the case entirely',
        detail: [
          'A path that looks right in a browser and comes back with a hole in it from a spatial ' +
            'database has not hit a bug in either. It has crossed a boundary between two fill rules.',
          'The standards handle it differently again. SVG names the rule as a property and defaults ' +
            'to non-zero, while the OGC simple-feature model declares self-intersecting rings ' +
            'invalid and leaves the behaviour undefined.',
          'In practice that means every implementation answers something and no two agree. Validate ' +
            'rings at the boundary of the system, because past that point the question has no single ' +
            'right answer.'
        ],
        example: 'The same silhouette drawn as an 8-vertex simple star produces 0 disagreeing ' +
          'probes; drawn as a 5-vertex crossing ring it produces 44.'
      },
      {
        term: 'The boundary is a third answer, and it needs a policy',
        plain: 'A point exactly on an edge is neither inside nor outside, and every implementation decides quietly.',
        formal: 'ray casting is written so that a vertex counts once rather than twice or zero times',
        detail: [
          'The classic ray-casting loop uses a half-open comparison on the y interval — one endpoint ' +
            'inclusive, the other exclusive — and that asymmetry is the entire handling of vertices.',
          'Without it, a ray passing exactly through a vertex counts the crossing twice when the two ' +
            'edges leave in opposite directions, and the parity flips wrongly.',
          'Whether a boundary point is reported inside is a separate decision again, and it matters ' +
            'most where polygons tile. If two neighbours both claim their shared edge, a point on it ' +
            'belongs to both; if neither claims it, it belongs to nothing.'
        ],
        example: 'The probe grid marks on-boundary points as a third colour rather than folding them ' +
          'into either answer.'
      },
      {
        term: 'Turn direction does not make a polygon convex; the turning number does',
        plain: 'Every turn in a pentagram goes the same way, and a pentagram is not convex.',
        formal: 'convex means all turns agree AND the total turning is exactly one full revolution',
        detail: [
          'The usual convexity test walks the ring and checks every orientation has the same sign. ' +
            'That is necessary and not sufficient, and the pentagram is the counterexample that ' +
            'shows why.',
          'Its five turns all agree, because the boundary is genuinely turning consistently left. It ' +
            'just turns through 720 degrees rather than 360.',
          'A test that only checks the signs accepts it. Downstream code that trusts convexity — ' +
            'Sutherland-Hodgman clipping, the rotating-calipers scan, an O(log n) containment test — ' +
            'then produces a confident wrong answer.'
        ],
        example: 'The shapes table marks the pentagram not convex and not simple, while every simple ' +
          'polygon in the set that is not convex is at least simple.'
      },
      {
        term: 'Simplification is lossy in a way you get to choose',
        plain: 'Douglas-Peucker bounds how far the outline moves; Visvalingam removes the least significant area first.',
        formal: 'one bounds displacement, the other bounds the area of what is discarded',
        detail: [
          'They optimise different things, and the difference shows on different data.',
          'Douglas-Peucker keeps the point furthest from the current chord and recurses, so its ' +
            'guarantee is geometric: no retained outline is further than the tolerance from the ' +
            'original.',
          'Visvalingam repeatedly drops the vertex whose triangle with its neighbours has the ' +
            'smallest area, which degrades a coastline far more gracefully because it removes ' +
            'wiggle rather than truncating spikes. Neither preserves simplicity: both can make a ' +
            'polygon cross itself, and that has to be checked rather than assumed.'
        ],
        example: 'At a tolerance of zero the pentagram keeps all 5 vertices, 100.0% of its area, and ' +
          'no point moves at all — the baseline every other setting is read against.'
      },
      {
        term: 'A polygon is a ring, and rings have to be closed by convention',
        plain: 'Store n vertices and treat the last edge as running back to the first; do not store the first vertex twice.',
        formal: 'edge i runs from vertex i to vertex (i + 1) mod n',
        readAs: 'Each edge starts at one vertex and ends at the next one round, and the last edge ' +
          'wraps back to the beginning — that is what the mod does.',
        detail: [
          'Repeating the first vertex at the end is the other convention, and mixing the two is a ' +
            'whole class of bug.',
          'The shoelace sum picks up a zero-area edge and still works. The vertex count is off by ' +
            'one everywhere, and a simplification routine can drop the duplicate and silently open ' +
            'the ring.',
          'GeoJSON requires the repeat, most in-memory representations forbid it, and the conversion ' +
            'between them is where the errors live. Pick one, state it at the top of the file, and ' +
            'normalise at the boundary.'
        ],
        example: 'The fixture polygons carry 4 to 12 vertices with no repeated closing point, so the ' +
          'triangle count in the triangulation section is exactly vertices minus two.'
      }
    ],

    'convex-hulls': [
      {
        term: 'The monotone chain is the practical default because it has no special cases',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["sort the points left to right"] --> B["sweep forward, popping any point<br/>that turns the wrong way"]',
            '    B --> C["that is the lower hull"]',
            '    C --> D["sweep backward the same way"]',
            '    D --> E["that is the upper hull"]',
            '    E --> F["join them — no angles, no pivot,<br/>no collinear special case"]'
          ].join('\n'),
          caption: 'Graham scan needs an angular sort and a tie-break for collinear points. This needs neither, which is why it is the one to write from memory.'
        },
        plain: 'Sort left to right, sweep forward for the lower hull and backward for the upper, popping right turns.',
        formal: 'O(n log n) dominated by the sort, with no angular comparison anywhere',
        detail: 'Graham\'s scan sorts by angle around an extreme point, which means a trigonometric ' +
          'or cross-product comparator, a tie rule for equal angles and a special case for the pivot ' +
          'itself. Andrew\'s monotone chain replaces all of that with a lexicographic sort on the ' +
          'coordinates, which any language sorts correctly by default. Two identical sweeps in ' +
          'opposite directions then build the two halves, and the only rule is: pop while the last ' +
          'three points do not turn the right way. That is why it is the version worth memorising.',
        example: 'On 200 points it used 789 orientation tests and 1 262 sort comparisons — the fewest ' +
          'orientation tests of the four algorithms.'
      },
      {
        term: 'O(n log n) and O(n·h) are different bounds, not better and worse',
        plain: 'Gift wrapping costs one scan per hull vertex, so it wins when the hull is tiny and loses catastrophically when it is not.',
        formal: 'gift wrapping is output-sensitive: h scans of n points, and h is the answer\'s size',
        detail: 'This is the clearest example in the milestone of a bound you cannot rank without ' +
          'knowing the data. A clustered cloud of a thousand points might have sixteen hull vertices, ' +
          'and sixteen scans is nothing; a thousand points on a circle have a thousand hull vertices, ' +
          'and the same algorithm now does a million orientation tests for the same n. The sorting ' +
          'algorithms barely notice the difference, because their cost depends on n alone. Choosing ' +
          'gift wrapping is a bet on h being small, and it should be written down as one.',
        example: 'At 1 024 points, gift wrapping costs 16 384 tests on a cloud with 16 hull vertices ' +
          'and 1 047 552 on a circle with 1 024 — a 63.9× difference at the same n, while the ' +
          'monotone chain goes 4 077 against 4 090.'
      },
      {
        term: 'Four algorithms, one hull, four different bills',
        plain: 'They all return the identical vertices; what differs is the mix of comparisons and orientation tests paid for them.',
        formal: 'the hull is unique, so any disagreement between two implementations is a bug in one of them',
        detail: 'The uniqueness is worth leaning on. Unlike a triangulation or a shortest-path tree, ' +
          'the convex hull of a point set is a single well-defined answer, so cross-checking ' +
          'implementations is a real test rather than a heuristic one. That makes the comparison ' +
          'table honest: every row computes the same thing, and the columns are purely what each one ' +
          'spent. Gift wrapping does no sorting at all and pays entirely in orientation tests; ' +
          'quickhull sorts nothing either but partitions instead, and lands in between.',
        example: 'All four returned the identical 12-vertex hull from 200 points, at 789, 1 314, ' +
          '1 651 and 2 400 orientation tests — the dearest is 3.04× the cheapest.'
      },
      {
        term: 'The collinear policy is a parameter, and it must be documented',
        plain: 'Points lying exactly on a hull edge can be kept or dropped, and both are correct answers to different questions.',
        formal: 'the strict test pops on orientation ≤ 0; the permissive one pops only on orientation < 0',
        detail: 'One character in the comparison decides it, which is exactly why it gets chosen by ' +
          'accident. Dropping collinear points gives the minimal vertex set, which is what area, ' +
          'rotating calipers and a containment test want. Keeping them gives every input point on the ' +
          'boundary, which is what a renderer tracing an outline or a downstream algorithm matching ' +
          'hull vertices back to input indices wants. The failure is not choosing wrong, it is not ' +
          'knowing which was chosen, and finding out from a bug report about a shape with a ' +
          'duplicated corner.',
        example: 'On 60 collinear points the two policies give 2 vertices and 60; on a 60-point grid ' +
          'they give 5 and 24.'
      },
      {
        term: 'Degenerate input is where implementations diverge, so test it first',
        plain: 'All collinear, all coincident, on a grid, on a circle: these are the five inputs that separate a correct hull from a plausible one.',
        formal: 'every algorithm must agree with every other under BOTH collinear policies',
        detail: 'That is a stronger contract than "each one computes a convex hull", and it is the ' +
          'one that prevents a surprise downstream. Points on a grid sit exactly on hull edges along ' +
          'every side; a fully collinear set has no interior at all, so the hull is a segment under ' +
          'the strict policy and the whole sorted run under the permissive one; coincident points ' +
          'test whether duplicates are removed before or after the sort. An implementation that ' +
          'passes on random clouds and fails here is the normal case, not the exception.',
        example: 'Five degenerate sets of 60 points each, and all four algorithms agree on every one ' +
          'of them under both policies.'
      },
      {
        term: 'The oracle is "is every point inside", not "does it look convex"',
        plain: 'Check that no input point lies outside the returned ring and that no hull vertex is a reflex turn.',
        formal: 'two conditions: every input point is inside or on the ring, and every ring turn has the same sign',
        detail: 'Either condition alone is satisfiable by a wrong answer. A ring that is convex but ' +
          'too small — the tolerance-test failure from the primitives section — passes the turn ' +
          'check and fails containment. A ring that includes every point but zigzags passes ' +
          'containment and fails the turn check. Together they pin the hull down, and they are cheap ' +
          'enough to run inside a property test on every random input rather than on a fixture. This ' +
          'is the pattern the whole milestone uses: a slow, obviously-correct check run against a ' +
          'fast, subtle one.',
        example: 'The oracle passes for all four algorithms on the 200-point default scene and on ' +
          'every degenerate fixture.'
      },
      {
        term: 'Quickhull is quicksort\'s shape, with quicksort\'s worst case',
        plain: 'Split on the line between two extremes, recurse on the point furthest from it, discard everything inside the triangle.',
        formal: 'O(n log n) expected and O(n²) worst case, on adversarial input rather than random input',
        detail: 'The discard is what makes it fast in practice: every point inside the triangle formed ' +
          'by the two extremes and the furthest point can never be on the hull, and on a uniform ' +
          'cloud that removes most of the input immediately. The worst case arrives when almost every ' +
          'point is on the hull, because nothing is ever discarded and the recursion peels off one ' +
          'vertex at a time — points on a circle again. Its apex choice must use the exact predicate ' +
          'like everything else here, since a furthest-point tie broken by rounding puts a vertex ' +
          'inside its own hull.',
        example: 'Quickhull reached the same 12-vertex hull in 1 314 orientation tests and 0 sort ' +
          'comparisons.'
      },
      {
        term: 'The hull of a hull is the hull, which is what makes it composable',
        plain: 'Hull each chunk, concatenate the results, hull that: the answer is identical and the input is far smaller.',
        formal: 'the hull of a union equals the hull of the union of the parts\' hulls',
        detail: 'This is the property that lets hulls be computed in parallel, incrementally or over ' +
          'data that does not fit in memory, and it holds exactly rather than approximately. It is ' +
          'also the reason a hull is a good summary to store: a spatial index can keep the hull of ' +
          'each leaf and answer "could anything in this leaf be relevant" without touching the ' +
          'points. Merging two hulls directly is faster still — the two tangent lines can be found in ' +
          'logarithmic time — and that is the basis of the divide-and-conquer and dynamic variants.',
        example: 'The 200-point scene reduces to 12 hull vertices, so a second pass over merged ' +
          'chunks works on 6.0% of the original points.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
