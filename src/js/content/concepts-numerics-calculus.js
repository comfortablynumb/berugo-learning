/** Concepts for interpolation, differentiation and differential equations (M18.6-M18.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'interpolation': [
      {
        term: 'More data can make a polynomial fit dramatically worse',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a perfectly smooth function"] --> B["fit a polynomial through<br/>equally spaced samples"]',
            '    B --> C["add more samples"]',
            '    C --> D["the fit gets worse near the ends,<br/>and the error grows without bound"]',
            '    D --> C',
            '    E["cluster the samples toward the ends"] --> F["the same degree now converges"]'
          ].join('\n'),
          caption: 'The intuition that more data helps is simply false here, and the fix is where you sample rather than how much. It is the clearest counter-example in numerical work.'
        },
        plain: 'Runge’s function is perfectly smooth, and the polynomial through more of its equally spaced samples oscillates more wildly.',
        formal: 'for f(x) = 1/(1 + 25x²) on [−1, 1] the equally spaced interpolant’s maximum error grows without bound as the node count rises',
        detail: [
          'This is not a rounding problem and it does not go away in exact arithmetic. It is a ' +
            'genuine property of high-degree polynomials through equally spaced points.',
          'The error of an interpolant is proportional to the product of the distances from the ' +
            'evaluation point to every node. On a uniform grid that product is enormous near the ' +
            'ends of the interval.',
          'Adding nodes makes the degree higher and the product worse, so the oscillation grows ' +
            'rather than shrinking.'
        ],
        example: 'The demo measures 4.384e-1 at 5 nodes and 2.572e+2 at 25 — five times the data ' +
          'for an answer 5.9e+2 times worse.'
      },
      {
        term: 'Chebyshev nodes fix it by moving where you sample, not how often',
        plain: 'Cluster the nodes towards the ends of the interval and the same degree of polynomial converges.',
        formal: 'xₖ = cos(kπ/n), which are equally spaced points on a semicircle projected onto the interval',
        readAs: 'The k-th node is the cosine of k times pi over n. Take equally spaced points ' +
          'around a half-circle and drop them straight down onto the line.',
        detail: [
          'The clustering is exactly what makes the product of distances small everywhere, instead ' +
            'of small in the middle and enormous at the edges.',
          'The resulting interpolant is within a small factor of the best possible polynomial of ' +
            'that degree. When you control the sampling this is free accuracy, which is why spectral ' +
            'methods and Chebyshev approximation of special functions use these points.',
          'When the data arrives on a uniform grid instead, it is the reason to reach for something ' +
            'other than one polynomial.'
        ],
        example: 'At 25 nodes the demo measures 8.166e-3 for Chebyshev against 2.572e+2 for the ' +
          'same degree on equally spaced nodes.'
      },
      {
        term: 'A spline is many low-degree pieces rather than one high-degree curve',
        plain: 'Run a separate cubic between each pair of nodes and match value, slope and curvature where they meet.',
        formal: 'a natural cubic spline is C² at every interior knot, with the second derivative set to zero at both ends',
        detail: [
          'Oscillation is a high-degree problem, and no piece ever exceeds degree three. So a spline ' +
            'converges on the equally spaced data where the polynomial diverges.',
          'The continuity conditions produce a tridiagonal system, which is why construction is ' +
            'linear in the number of nodes rather than cubic. That detail is what makes splines ' +
            'practical for thousands of points.',
          'The "natural" boundary condition is a choice. Clamped splines fix the end slopes instead, ' +
            'and which you want depends on what you know about the data.'
        ],
        example: 'On the same equally spaced nodes the demo measures the spline at 1.926e-3 where ' +
          'the polynomial is at 2.572e+2.'
      },
      {
        term: 'Passing through every data point is the weakest possible quality claim',
        plain: 'A curve can agree with the data exactly and be arbitrarily wrong between the data.',
        formal: 'interpolation constrains the curve at n points and says nothing about the continuum between them',
        detail: [
          'It is the same shape as the residual in 18.1. It is an easily checked quantity that ' +
            'measures agreement with what you specified rather than agreement with what you wanted.',
          'Both the natural and the monotone spline in the demo pass through every point to machine ' +
            'precision. Neither is wrong by that test, and only one of them stays inside the range ' +
            'of the data.',
          'Look at the curve between the points, always.'
        ],
        example: 'Both splines in the demo interpolate to within 1.1e-16 at the nodes, and one of ' +
          'them dips 0.109 below a data set whose smallest value is zero.'
      },
      {
        term: 'C² continuity is what forces a spline to overshoot',
        plain: 'Matching curvature at every join leaves the curve no choice but to swing past the data.',
        formal: 'requiring the second derivative to match at each knot over-determines the shape, and the excess appears as overshoot',
        detail: [
          'This is a genuine trade rather than a defect. You asked for the smoothest curve through ' +
            'the points, and the smoothest curve leaves the range.',
          'The consequence is only a bug when the quantity has a meaning that the overshoot ' +
            'violates: a probability going negative, a price going below zero, a mass becoming ' +
            'imaginary.',
          'In those cases the fix is to give up C² deliberately, rather than to look for a better ' +
            'solver.'
        ],
        example: 'On the monotone data 0, 0, 0, 1, 1, 1, 1 the natural cubic dips 0.109 below zero ' +
          'and rises 0.108 above one, which is 10.9% of the data’s range.'
      },
      {
        term: 'Monotone cubics guarantee no overshoot by limiting the slopes',
        plain: 'Clip each node’s derivative to what the neighbouring data actually supports, and the curve cannot leave the range.',
        formal: 'the Fritsch–Carlson conditions bound each node slope by three times the smaller adjacent secant slope',
        detail: [
          'The construction is the useful part. It is not a different kind of curve, but the same ' +
            'piecewise cubic with the free slopes chosen conservatively instead of smoothly.',
          'You give up C² — the curvature now jumps at the knots — and you get the guarantee that ' +
            'monotone data produces a monotone curve.',
          'This is what a colour ramp, an animation easing curve and an audio envelope all need. In ' +
            'each case leaving the range produces a visible or audible artefact.'
        ],
        example: 'On the same step data the demo measures the monotone cubic’s overshoot at exactly ' +
          '0.0000 above and 0.0000 below.'
      },
      {
        term: 'Bézier curves are evaluated by repeated linear interpolation',
        plain: 'De Casteljau’s algorithm interpolates between control points, then between those results, until one point is left.',
        formal: 'at parameter t, repeatedly replace each consecutive pair by (1 − t)P₀ + tP₁ until a single point remains',
        readAs: 'Walk along each line joining two neighbouring control points and take the '
          + 'point a fraction t of the way. That gives a shorter list of points, and '
          + 'repeating until one is left gives the curve at t.',
        detail: [
          'The algorithm is numerically far better behaved than evaluating the Bernstein polynomial ' +
            'directly. Every step is a convex combination, so the intermediate points stay inside ' +
            'the hull of the ones they came from and nothing can grow.',
          'It also produces the subdivision for free. The intermediate points along the two edges of ' +
            'the triangle are the control points of the two halves.',
          'That is how a renderer flattens a curve to line segments adaptively.'
        ],
        example: 'Every font glyph and vector illustration is stored as Bézier control points and ' +
          'drawn by exactly this recursion.'
      },
      {
        term: 'Approximation and interpolation are different requests',
        plain: 'Interpolation must pass through every point. Approximation only has to be close, and on noisy data that is what you want.',
        formal: 'interpolation solves an n-by-n system exactly; least-squares approximation minimises the residual over a smaller basis',
        detail: [
          'When the data carries noise, insisting on passing through every point means fitting the ' +
            'noise, and the curve between the points pays for it.',
          'A least-squares fit with fewer parameters than data points averages the noise away ' +
            'instead, at the cost of not matching any single observation exactly.',
          'Choosing between them is choosing whether you believe the individual measurements. That ' +
            'is a question about the data rather than about numerical methods.'
        ],
        example: 'The polynomial fits in 18.4 are approximations of the same kind of data these ' +
          'interpolants pass exactly through.'
      }
    ],

    'differentiation-and-autodiff': [
      {
        term: 'A finite difference has two errors pulling opposite ways',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["shrink the step h"] --> B["truncation error falls —<br/>the approximation improves"]',
            '    A --> C["rounding error rises —<br/>you subtract two nearly equal numbers"]',
            '    B --> D["the total has a minimum<br/>somewhere in between"]',
            '    C --> D',
            '    D --> E["so smaller is better,<br/>right up until it is much worse"]'
          ].join('\n'),
          caption: 'The instinct that a smaller step is always more accurate is exactly wrong past the optimum, and the failure is a loss of significant digits rather than a warning.'
        },
        plain: 'Shrinking the step reduces the truncation error and increases the rounding error, and the best step is where they cross.',
        formal: 'the forward difference has truncation O(h) and rounding O(ε/h), which balance at h ≈ √ε',
        readAs: 'The part you left out of the Taylor series shrinks in proportion to the step, and ' +
          'the part lost to rounding grows in proportion to one over the step; they are equal ' +
          'around the square root of machine epsilon.',
        detail: 'Plotted against h on log axes the total error is a V, and the bottom of the V is a ' +
          'floor no step size gets under. That floor is the important part: a forward difference in ' +
          'double precision cannot do better than about eight correct digits, which is half the ' +
          'precision the type carries, and no amount of tuning changes it. Every method in this ' +
          'milestone has some version of this trade; this is the one where you can see both branches.',
        example: 'The demo sweeps h by decades and finds the forward difference bottoming out at ' +
          'h = 1e-8 with an error of 2.97e-9, against a predicted optimum of 1.49e-8.'
      },
      {
        term: 'A central difference has a different optimum and a lower floor',
        plain: 'Sampling either side cancels the first-order error term, so the truncation shrinks as h² instead of h.',
        formal: '(f(x + h) − f(x − h)) / 2h has truncation O(h²), balancing rounding at h ≈ ∛ε',
        readAs: 'Take the difference across the point rather than forwards from it; the leftover ' +
          'now shrinks with the square of the step, and the best step is the cube root of machine ' +
          'epsilon.',
        detail: 'It costs one extra evaluation and buys three orders of magnitude, which makes it ' +
          'the default choice for checking a gradient. The predicted optimum comes from balancing ' +
          'h² against ε/h, and the demo finds it by sweeping rather than by quoting — a decade-' +
          'spaced sweep can only resolve the nearest decade, and it lands on the right one for ' +
          'both rules.',
        example: 'The demo measures the central difference bottoming out at h = 1e-5 with an error ' +
          'of 1.11e-11, against a predicted optimum of 6.06e-6.'
      },
      {
        term: 'The complex step removes the subtraction and therefore the floor',
        plain: 'Evaluate at x + ih and take the imaginary part; nothing cancels, so h can be arbitrarily small.',
        formal: 'f′(x) ≈ Im f(x + ih) / h, with no subtraction and therefore no cancellation',
        readAs: 'Feed the function a complex number whose imaginary part is the step, divide the ' +
          'imaginary part of the answer by that step, and you have the derivative with no ' +
          'subtraction anywhere.',
        detail: 'The trick is that the imaginary part of the Taylor expansion contains the ' +
          'derivative times h with no real term to cancel against, so the rounding branch of the V ' +
          'simply does not exist. It requires the function to be analytic and to be rewritten in ' +
          'complex arithmetic, which is why it is not universal — but where it applies the error ' +
          'is exactly zero, and it is the conceptual bridge to autodiff.',
        example: 'The demo measures a complex-step error of 0 at h = 1e-16, where the forward ' +
          'difference is at 3.0e-9.'
      },
      {
        term: 'Gauss–Legendre chooses where to sample, and is exact to degree 2n − 1',
        plain: 'n points give 2n free parameters — positions and weights — and the rule spends all of them.',
        formal: 'an n-point Gauss rule integrates every polynomial of degree at most 2n − 1 exactly, and not degree 2n',
        detail: 'A fixed grid fixes the positions and only lets you choose the weights, which is ' +
          'why Simpson gets degree 3 from three points and Gauss gets degree 5. The boundary is ' +
          'attained rather than merely claimed — the demo measures machine precision at degree ' +
          '2n − 1 and a visible error at 2n. The guarantee is about polynomials, which is also its ' +
          'limitation: on a discontinuous integrand, where no polynomial is close, Gauss has no ' +
          'advantage at all.',
        example: 'The demo integrates eˣ over [0, 1] to 9.33e-10 in 4 evaluations against Simpson’s ' +
          '2.326e-6 and the trapezoid rule’s 2.24e-3, both in 9. At 2 points the error is ' +
          '5.55e-17 at degree 3 and 5.56e-3 at degree 4; at 5 points it is 8.33e-17 at degree 9 ' +
          'and 1.43e-6 at degree 10.'
      },
      {
        term: 'Adaptive quadrature spends its evaluations where the error estimate says',
        plain: 'Split the interval, compare the coarse and fine estimates, and recurse only where they disagree.',
        formal: 'the difference between a rule and the same rule on two halves estimates the error, and Richardson extrapolation improves the result',
        detail: 'On a smooth integrand this is wasted effort — a uniform rule already resolves ' +
          'everything and the adaptation finds nothing to do. Its case is the opposite: an ' +
          'integrand with a spike or a kink forces a uniform grid to be fine everywhere in order ' +
          'to resolve one small region, while adaptation refines only there. That is the general ' +
          'shape of adaptivity, and it means benchmarking an adaptive method on smooth inputs ' +
          'measures its overhead rather than its value.',
        example: 'On the smooth eˣ the demo’s adaptive Simpson spends 1 023 evaluations to reach ' +
          'the requested tolerance, against Gauss–Legendre’s 4.'
      },
      {
        term: 'Autodiff differentiates the program, not the function',
        plain: 'Apply the chain rule to the operations the code actually performed, and the derivative is exact.',
        formal: 'every elementary operation has a known derivative, and the chain rule composes them with no truncation and no step size',
        detail: 'This is why it is not a better finite difference but a different thing entirely: ' +
          'there is no h to choose, no subtraction to cancel and no Taylor term left out, so the ' +
          'result is the derivative to machine precision rather than an approximation of it. It ' +
          'also means the derivative is of the code as written, including its branches — which is ' +
          'usually what you want and is worth remembering when the code contains a discontinuity ' +
          'the mathematics does not.',
        example: 'The demo’s autodiff columns read 0 or 2.8e-14 on every fixture, against a ' +
          'central-difference column between 4.2e-11 and 2.2e-8.'
      },
      {
        term: 'Reverse mode costs one sweep whatever the number of inputs',
        plain: 'Record the operations on the way forward, walk the record backwards once, and every input’s derivative falls out.',
        formal: 'forward mode costs n sweeps for n inputs; reverse mode costs one backward pass, at a small constant times the forward pass',
        detail: 'The asymmetry is the entire reason gradient-based training scales. A gradient with ' +
          'a billion parameters costs a billion sweeps in forward mode and about two forward ' +
          'passes in reverse mode, and that is the difference between possible and not. The price ' +
          'is memory: the tape holds every intermediate value until the backward sweep needs it, ' +
          'which is why activation checkpointing exists — recompute some values instead of storing ' +
          'them, trading time for the memory the tape would have used.',
        example: 'On the 24-input fixture the demo measures forward mode doing 9.60× the operations ' +
          'of reverse mode, and 24 sweeps against 1.'
      },
      {
        term: 'Finite differences keep exactly one job: checking an analytic gradient',
        plain: 'Compare against a central difference at h = 1e-6 and expect agreement to about eight digits.',
        formal: 'the central difference at h = 10⁻⁶ has an error around 10⁻¹⁰ to 10⁻⁸, which is the tolerance a gradient check should use',
        detail: 'Being specific about the expected agreement is what makes the check useful. Much ' +
          'worse than eight digits means the analytic gradient is wrong; much better is suspicious ' +
          'too, because it often means both sides came from the same code. Choosing the tolerance ' +
          'from the V curve rather than picking a round number is the difference between a check ' +
          'that catches sign errors and one that passes everything.',
        example: 'The demo’s central-difference column ranges from 4.2e-11 to 2.2e-8 across four ' +
          'fixtures, which is the band a gradient check should allow.'
      }
    ],

    'differential-equations': [
      {
        term: 'A solver’s order is measurable, and measuring it catches implementation bugs',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["halve the step size"] --> B["an order-p method divides<br/>its error by 2^p"]',
            '    B --> C["RK4 should divide it by 16"]',
            '    C --> D{"does it?"}',
            '    D -->|yes| E["the implementation is<br/>doing what it claims"]',
            '    D -->|no| F["a coefficient is wrong —<br/>and the answers still look plausible"]'
          ].join('\n'),
          caption: 'A mistyped Runge-Kutta coefficient gives sensible-looking output at every step. The convergence order is the one measurement that notices.'
        },
        plain: 'Halve the step and an order-p method divides its error by 2ᵖ.',
        formal: 'error ∝ hᵖ, so log₂ of the ratio between consecutive halvings estimates p',
        readAs: 'The error is proportional to the step raised to the power p, so taking the log ' +
          'base two of how much the error shrank when you halved the step gives you p back.',
        detail: 'This is the first check to run on any solver you write, including one you think ' +
          'you trust: a wrong coefficient in the Runge–Kutta weights produces a trajectory that ' +
          'looks entirely plausible and an order that is visibly not four. The demo halves the step ' +
          'six times on a unit spring, whose exact solution is a cosine, and reads the order off ' +
          'the ratios rather than quoting it.',
        example: 'The demo measures 0.998 for Euler, 1.996 for midpoint, 3.995 for RK4 and 2.000 ' +
          'for velocity Verlet.'
      },
      {
        term: 'RK4 samples the slope four times and weights the middle two twice',
        plain: 'One slope at the start, two at the midpoint from different estimates, one at the far end.',
        formal: 'y := y + h(k₁ + 2k₂ + 2k₃ + k₄)/6, which is Simpson’s rule applied to the slope',
        readAs: 'The new value is the old one plus the step times a weighted average of the four ' +
          'slopes, with the two midpoint slopes counted twice as heavily as the endpoints.',
        detail: 'The unequal weighting is what buys the fourth order: it is Simpson’s rule ' +
          'appearing again, integrating the slope over the step rather than sampling it once. Four ' +
          'evaluations for fourth-order error is a good trade on a smooth problem, which is why ' +
          'RK4 is the default general-purpose integrator — and the section exists to show where ' +
          'that default is the wrong choice.',
        example: 'The demo’s diagram traces the four stages, and the order table confirms 3.995 ' +
          'from the measured errors.'
      },
      {
        term: 'Order is not the same as long-term fidelity',
        plain: 'RK4 has far less error per step than Verlet and loses energy steadily where Verlet does not.',
        formal: 'a symplectic method exactly conserves a nearby modified energy, so its energy error is bounded rather than accumulating',
        detail: 'The reason is structural rather than a matter of accuracy. Verlet preserves the ' +
          'geometry of the underlying system — phase-space volume — so its energy error oscillates ' +
          'within a band forever. RK4 preserves nothing in particular, so its small per-step ' +
          'energy errors all point the same way and accumulate without limit. Over a long ' +
          'simulation the bounded error wins, however much larger it is per step.',
        example: 'Over 200 000 steps at h = 0.1 the demo measures RK4’s orbital radius decaying ' +
          'monotonically to 0.994302 while Verlet oscillates between 1.000000 and 1.004988.'
      },
      {
        term: 'The effect is real at the step sizes simulations actually use, and not at smaller ones',
        plain: 'At h = 0.01 both methods hold the orbit to a part in 10⁹ and there is nothing to choose between them.',
        formal: 'the energy drift is O(h^p) per step, so a small enough step makes both methods indistinguishable over any finite run',
        detail: 'Being honest about where a claimed effect appears is the difference between ' +
          'teaching and folklore. "RK4 makes an orbit decay" is true at h = 0.1 over 200 000 steps ' +
          'and simply does not reproduce at h = 0.01 — so the demo defaults to the step where the ' +
          'difference is real rather than to one that flatters either method. Real-time simulation ' +
          'runs at large steps because the step is the frame time, which is exactly why the ' +
          'distinction matters there.',
        example: 'The demo’s step control offers 0.01, where RK4’s energy drift is 5.56e-9 and ' +
          'Verlet’s is 2.50e-9, and 0.1, where they are 5.73e-3 and 2.46e-5.'
      },
      {
        term: 'Stiffness is a step limited by a mode you no longer care about',
        plain: 'A fast component forces tiny steps long after it has decayed to nothing.',
        formal: 'explicit Euler is stable only for h < 2/|λ| of the fastest mode, regardless of accuracy',
        readAs: 'The step has to stay below two divided by the size of the fastest decay rate or ' +
          'the method blows up, whatever accuracy you were willing to accept.',
        detail: 'The constraint is stability rather than accuracy, which is why it cannot be ' +
          'negotiated away by lowering your standards. It is also a threshold rather than a ' +
          'gradient: crossing it does not degrade the answer, it makes the solution explode. Real ' +
          'stiff systems are everywhere — chemical kinetics with fast and slow reactions, circuits ' +
          'with mixed time constants, and any physical model spanning several time scales.',
        example: 'With decay rates 1 000 and 1, the demo measures a stability limit of h = 2.000e-3 ' +
          'and explicit Euler exploding at 1.25× it.'
      },
      {
        term: 'Implicit methods buy stability by solving for the next state',
        plain: 'Evaluate the slope at the destination instead of the origin, which makes each step a root-finding problem.',
        formal: 'backward Euler is y_{n+1} = y_n + h f(t_{n+1}, y_{n+1}), which is unconditionally stable',
        detail: 'Each step now costs a nonlinear solve — Newton’s method from 18.2, with the ' +
          'previous step as the starting point — so it is several times more expensive. On a stiff ' +
          'problem the trade is not close: the step size is chosen by how accurate you need to be ' +
          'rather than by what will not explode, which can be fifty times larger. This is also why ' +
          'stiff solvers need the Jacobian, and why autodiff from 18.7 turns up inside them.',
        example: 'The demo reaches t = 1 in 10 implicit steps at 50× the explicit stability limit ' +
          'with an error of 1.77e-2, against the 500 steps explicit Euler needs.'
      },
      {
        term: 'Adaptive step size comes from running two methods at once',
        plain: 'An embedded pair produces two estimates of different orders, and their difference is the error estimate.',
        formal: 'RK45 shares stage evaluations between a fourth- and fifth-order formula, so the error estimate is nearly free',
        detail: 'The elegance is in the sharing: the two formulas use the same slope evaluations ' +
          'with different weights, so the extra estimate costs almost nothing. The difference ' +
          'between them estimates the local error, which drives the step-size controller — shrink ' +
          'when the estimate exceeds the tolerance, grow when it is comfortably under. That is ' +
          'what `solve_ivp` and every production ODE solver do, and it is why they report step ' +
          'counts rather than taking the step you asked for.',
        example: 'The same structure appears in adaptive quadrature in 18.7: two estimates, their ' +
          'difference as the error, and refinement only where it is large.'
      },
      {
        term: 'Choose the method by the invariant you need preserved',
        plain: 'Ask what your system conserves, then pick the integrator that conserves it.',
        formal: 'error bounds describe accuracy per step; conservation describes whether errors cancel or accumulate',
        detail: 'Error per step is what papers report; whether the errors cancel or accumulate is ' +
          'what decides whether a simulation is still recognisable after a million steps. Energy, ' +
          'momentum, a probability summing to one, a total account balance — a method that ' +
          'preserves the invariant approximately forever beats one that tracks the trajectory ' +
          'beautifully and drifts. It generalises past ODEs: the same question decides whether to ' +
          'store a running total or recompute it from the ledger.',
        example: 'Verlet is second order and RK4 is fourth, and over 200 000 steps Verlet’s energy ' +
          'drift is 2.46e-5 against RK4’s 5.73e-3.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
