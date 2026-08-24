/** Reference entries for interpolation, differentiation and differential equations (M18.6-M18.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'interpolation': {
      summary: 'Runge’s phenomenon measured across six node counts, the two independent fixes for ' +
        'it, and the overshoot that makes an exactly interpolating spline produce values the data ' +
        'never contained.',
      intuition: 'Animation easing, colour ramps and audio envelopes are all interpolation ' +
        'problems, and overshoot is the visible bug: monotone interpolation is what stops a ' +
        '"smooth" curve producing a negative value.',
      formulation: {
        equations: [
          {
            label: 'Runge’s phenomenon on 1/(1 + 25x²), maximum error over [−1, 1]',
            expr: 'equally spaced against Chebyshev against a cubic spline',
            terms: [
              { sym: '5 nodes', meaning: 'equal 4.384e-1, Chebyshev 4.600e-1, spline 2.793e-1' },
              { sym: '13 nodes', meaning: 'equal 3.663e+0, Chebyshev 8.440e-2, spline 6.909e-3' },
              { sym: '25 nodes', meaning: 'equal 2.572e+2, Chebyshev 8.166e-3, spline 1.926e-3' },
              { sym: 'the headline', meaning: 'five times the data makes the equally spaced fit 5.9e+2 times worse' }
            ]
          },
          {
            label: 'Why moving the nodes fixes it',
            expr: 'the error is proportional to the product of distances to every node',
            terms: [
              { sym: 'equally spaced', meaning: 'that product is enormous near the ends of the interval' },
              { sym: 'Chebyshev nodes', meaning: 'xₖ = cos(kπ/n) — equally spaced on a semicircle, projected down' },
              { sym: 'the effect', meaning: 'the nodes cluster at the boundaries, where the gaps shrink to 0.03407' },
              { sym: 'the guarantee', meaning: 'within a small factor of the best polynomial of that degree' }
            ]
          },
          {
            label: 'Overshoot on the monotone data 0, 0, 0, 1, 1, 1, 1',
            expr: 'both curves interpolate exactly; only one stays in range',
            terms: [
              { sym: 'natural cubic', meaning: '0.1094 below zero, 0.1078 above one — 10.9% of the range' },
              { sym: 'monotone cubic', meaning: '0.0000 in both directions' },
              { sym: 'interpolation error at the nodes', meaning: '1.1e-16 and 0 — neither is "wrong" by that test' },
              { sym: 'the cost', meaning: 'the monotone curve gives up C², so curvature jumps at the knots' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every interpolant agrees with the data at the nodes, by construction',
          why: 'Which means the nodes tell you nothing about which interpolant is better.',
          breaks: 'A check that only tests the nodes passes a curve that is arbitrarily wrong between them.'
        },
        {
          name: 'A cubic spline is C² at every interior knot',
          why: 'It is what makes the curve look smooth, and it is what forces the overshoot.',
          breaks: 'Dropping to C¹ removes the overshoot and makes the curvature visibly discontinuous.'
        },
        {
          name: 'A monotone cubic maps monotone data to a monotone curve',
          why: 'It is a guarantee rather than a tendency, which is what a physical quantity needs.',
          breaks: 'On non-monotone data the guarantee says nothing, and the extra smoothness was given up for nothing.'
        },
        {
          name: 'De Casteljau evaluates by convex combinations only',
          why: 'Every intermediate point stays inside the hull of its parents, so nothing can grow.',
          breaks: 'Evaluating the Bernstein form directly loses that and is measurably less accurate at high degree.'
        }
      ],
      complexity: [
        { operation: 'polynomial interpolation, barycentric form', average: 'O(n²) to set up the weights, O(n) per evaluation', worst: 'the error grows without bound in n on equally spaced nodes' },
        { operation: 'natural cubic spline construction', average: 'O(n) — the continuity conditions form a tridiagonal system', worst: 'the same; it has no data-dependent behaviour' },
        { operation: 'spline evaluation', average: 'O(log n) to locate the interval, O(1) to evaluate the cubic', worst: 'O(n) if the interval search is linear, which is a common oversight' },
        { operation: 'de Casteljau', average: 'O(n²) for degree n, and it subdivides for free', worst: 'the same, and numerically far better behaved than the direct Bernstein evaluation' }
      ],
      failureModes: [
        {
          symptom: 'Adding data points makes a polynomial fit visibly worse.',
          cause: 'Runge’s phenomenon: high degree through equally spaced nodes.',
          fix: 'Use a spline, or move the nodes to the Chebyshev positions if you control the sampling.'
        },
        {
          symptom: 'A smooth interpolation of non-negative data produces negative values.',
          cause: 'A C² spline overshoots; matching curvature at every knot forces the swing.',
          fix: 'Use a monotone (Fritsch–Carlson) cubic, which gives up C² for the guarantee.'
        },
        {
          symptom: 'An animation eases past its target and comes back.',
          cause: 'The same overshoot, in a curve chosen for smoothness rather than for staying in range.',
          fix: 'Clamp the control points, or use an easing curve whose overshoot is deliberate and bounded.'
        },
        {
          symptom: 'A colour ramp shows a band of a colour that is in neither endpoint.',
          cause: 'Interpolating each channel independently through a smooth curve that leaves the range.',
          fix: 'Interpolate in a perceptual space and use a monotone curve per channel.'
        },
        {
          symptom: 'A spline evaluation is unexpectedly slow in a hot loop.',
          cause: 'The interval search is linear, so evaluation is O(n) rather than O(log n).',
          fix: 'Binary search the knots, or cache the last interval when queries are sequential.'
        }
      ],
      inTheWild: [
        { system: 'CSS `cubic-bezier` easing', how: 'is de Casteljau evaluation of a two-control-point Bézier, and the standard `ease-out-back` curve deliberately overshoots — which is the same phenomenon, chosen rather than suffered.' },
        { system: 'SciPy’s `PchipInterpolator`', how: 'is the monotone cubic in this section, offered alongside `CubicSpline` precisely because the smooth one overshoots.' },
        { system: 'Font rendering', how: 'stores glyph outlines as quadratic (TrueType) or cubic (PostScript) Bézier curves, flattened to line segments by recursive de Casteljau subdivision at draw time.' }
      ],
      sources: [
        { title: 'Approximation Theory and Approximation Practice', author: 'Lloyd N. Trefethen', note: 'Chebyshev interpolation from first principles, with the Runge phenomenon explained rather than merely displayed.' },
        { title: 'A Practical Guide to Splines', author: 'Carl de Boor', note: 'The standard reference for spline construction, including every boundary condition and why you would choose it.' },
        { title: 'Monotone piecewise cubic interpolation', author: 'Fritsch and Carlson', note: 'The 1980 paper that gives the slope conditions the monotone variant uses.' },
        { title: 'Numerical Recipes, chapter 3', author: 'Press, Teukolsky, Vetterling and Flannery', note: 'Practical interpolation, with unusually direct warnings about high-degree polynomials.' }
      ]
    },

    'differentiation-and-autodiff': {
      summary: 'The V curve swept by decades with both theoretical optima checked, four quadrature ' +
        'rules compared per evaluation rather than per rule, and both autodiff modes measured ' +
        'against the analytic gradient and against each other’s cost.',
      intuition: 'Reverse-mode autodiff costs about the same as one forward evaluation regardless ' +
        'of the number of inputs, which is the entire reason gradient-based training scales to ' +
        'billions of parameters.',
      formulation: {
        equations: [
          {
            label: 'The V curve, differentiating sin at x = 1',
            expr: 'truncation falls with h; rounding rises as 1/h; the optimum is where they cross',
            terms: [
              { sym: 'forward difference', meaning: 'predicted √ε = 1.49e-8, measured minimum at h = 1e-8 with error 2.97e-9' },
              { sym: 'central difference', meaning: 'predicted ∛ε = 6.06e-6, measured minimum at h = 1e-5 with error 1.11e-11' },
              { sym: 'complex step', meaning: 'error 0 at h = 1e-16 — no subtraction, so no left-hand branch' },
              { sym: 'the floor', meaning: 'about eight correct digits of sixteen for a forward difference, at any h' }
            ]
          },
          {
            label: 'Quadrature of eˣ over [0, 1], where the exact answer is e − 1',
            expr: 'error beside evaluation count, which is the only fair comparison',
            terms: [
              { sym: 'trapezoid, 8 panels', meaning: 'error 2.24e-3 in 9 evaluations' },
              { sym: 'Simpson, 8 panels', meaning: '2.33e-6 in 9' },
              { sym: 'Gauss–Legendre, 4 points', meaning: '9.33e-10 in 4 — choosing where to sample, not just how heavily' },
              { sym: 'adaptive Simpson', meaning: 'reaches the tolerance in 1 023 evaluations, which on a smooth integrand is its overhead rather than its value' }
            ]
          },
          {
            label: 'Gauss–Legendre’s exactness boundary',
            expr: 'n points integrate degree 2n − 1 exactly, and degree 2n not',
            terms: [
              { sym: '2 points', meaning: 'error 5.55e-17 at degree 3, and 5.56e-3 at degree 4' },
              { sym: '3 points', meaning: '5.55e-17 at degree 5, 3.57e-4 at degree 6' },
              { sym: '5 points', meaning: '8.33e-17 at degree 9, 1.43e-6 at degree 10' },
              { sym: 'why 2n − 1', meaning: 'n positions plus n weights is 2n free parameters, all spent' }
            ]
          },
          {
            label: 'Autodiff, both modes against the analytic gradient',
            expr: 'error, then cost',
            terms: [
              { sym: 'accuracy', meaning: 'both modes read 0 or 2.8e-14 on every fixture; the central difference reads 4.2e-11 to 2.2e-8' },
              { sym: '2 inputs', meaning: 'forward mode does 0.75-0.80× reverse mode’s operations — forward wins when n is small' },
              { sym: '24 inputs', meaning: 'forward mode does 9.60× the operations, and 24 sweeps against 1' },
              { sym: 'the tape', meaning: 'six nodes for sin(xy) + eˣ, giving ∂f/∂x = 2.619990 and ∂f/∂y = 0.347128 in one sweep' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The total error of a finite difference has a minimum in h, and it is a floor',
          why: 'It bounds what any finite-difference gradient can achieve, whatever tolerance is requested.',
          breaks: 'Shrinking h past the optimum makes the answer worse, which is the opposite of the naive expectation.'
        },
        {
          name: 'The complex step has no cancellation, so its error does not rise as h falls',
          why: 'It shows the floor belongs to the subtraction rather than to differentiation.',
          breaks: 'It requires an analytic function rewritten in complex arithmetic, so it does not always apply.'
        },
        {
          name: 'An n-point Gauss rule is exact to degree 2n − 1 and not to 2n',
          why: 'The boundary is attained, so the guarantee is tight rather than conservative.',
          breaks: 'On a discontinuous integrand no polynomial is close and the guarantee is worth nothing.'
        },
        {
          name: 'Reverse-mode cost is independent of the input count',
          why: 'It is why a gradient over a billion parameters is affordable at all.',
          breaks: 'The memory cost is not independent — the tape holds every intermediate until the sweep needs it.'
        }
      ],
      complexity: [
        { operation: 'forward difference gradient', average: 'n + 1 function evaluations for n inputs', worst: 'about eight correct digits, whatever the tolerance asked for' },
        { operation: 'central difference gradient', average: '2n evaluations, about eleven correct digits', worst: 'twice the cost of the forward version for three orders of accuracy' },
        { operation: 'forward-mode autodiff', average: 'n sweeps for n inputs; cheaper than reverse mode below about three inputs', worst: '9.60× reverse mode’s operations at 24 inputs, and unboundedly worse beyond' },
        { operation: 'reverse-mode autodiff', average: 'one backward sweep, at a small constant times the forward pass', worst: 'memory proportional to the number of operations, which is what checkpointing trades away' }
      ],
      failureModes: [
        {
          symptom: 'A finite-difference derivative gets worse when the step is made smaller.',
          cause: 'The step has passed the bottom of the V and rounding now dominates.',
          fix: 'Use √ε for a forward difference and ∛ε for a central one, or switch to autodiff.'
        },
        {
          symptom: 'A gradient check passes with a tolerance of 1e-3 and the model still will not train.',
          cause: 'The tolerance is far looser than the 1e-8 a central difference actually achieves, so it catches nothing.',
          fix: 'Set the tolerance from the V curve — expect about eight digits at h = 1e-6 and investigate anything worse.'
        },
        {
          symptom: 'Training runs out of GPU memory in the backward pass but not the forward one.',
          cause: 'The tape holds every intermediate activation until the backward sweep consumes it.',
          fix: 'Use gradient checkpointing: store a subset and recompute the rest, trading time for memory.'
        },
        {
          symptom: 'An adaptive integrator is slower than a fixed rule and no more accurate.',
          cause: 'The integrand is smooth, so the adaptation finds nothing to refine and pays its overhead.',
          fix: 'Use a fixed high-order rule on smooth integrands; keep adaptivity for spikes and kinks.'
        },
        {
          symptom: 'A Gauss rule performs badly on an integrand with a jump in it.',
          cause: 'Its guarantee is about polynomials, and a step function is not near any of them.',
          fix: 'Split the interval at the discontinuity and integrate each piece separately.'
        }
      ],
      inTheWild: [
        { system: 'PyTorch and JAX', how: 'are reverse-mode autodiff engines with operator libraries attached; `backward()` is exactly the tape sweep in this section, and `torch.autograd.gradcheck` is the finite-difference check it is verified against.' },
        { system: 'SciPy’s `quad`', how: 'is adaptive Gauss–Kronrod from QUADPACK: a Gauss rule plus extra points that reuse the same evaluations to estimate the error, which is the embedded-pair idea from 18.8 applied to integration.' },
        { system: 'The complex-step derivative in aerospace optimisation', how: 'is used where the analysis code is a legacy Fortran solver: recompiling it with complex arithmetic gives exact derivatives without rewriting the physics.' }
      ],
      sources: [
        { title: 'Evaluating Derivatives', author: 'Andreas Griewank and Andrea Walther', note: 'The reference for automatic differentiation, including the cost bounds that make reverse mode worth its memory.' },
        { title: 'The complex-step derivative approximation', author: 'Martins, Sturdza and Alonso', note: 'The paper that popularised the trick, with the implementation caveats that matter in practice.' },
        { title: 'Numerical Recipes, chapters 4 and 5', author: 'Press, Teukolsky, Vetterling and Flannery', note: 'Quadrature and numerical differentiation, with the step-size trade-off derived.' },
        { title: 'Automatic differentiation in machine learning: a survey', author: 'Baydin, Pearlmutter, Radul and Siskind', note: 'How the two modes map onto what deep-learning frameworks actually do.' }
      ]
    },

    'differential-equations': {
      summary: 'Convergence orders read off measured errors, an orbit run for 200 000 steps where ' +
        'the fourth-order method decays and the second-order one does not, and a stiff system ' +
        'where the explicit step is bounded by a mode that has already died.',
      intuition: 'Game physics uses Verlet not because it is more accurate but because its error ' +
        'does not accumulate as energy; a "more accurate" RK4 integrator makes an orbit decay.',
      formulation: {
        equations: [
          {
            label: 'Order, measured by halving the step six times on a unit spring',
            expr: 'log₂ of consecutive error ratios',
            terms: [
              { sym: 'explicit Euler', meaning: '0.998 against a claimed 1; error 6.57e-4 at the finest step' },
              { sym: 'midpoint', meaning: '1.996 against 2; error 3.42e-7' },
              { sym: 'RK4', meaning: '3.995 against 4; error 4.95e-14' },
              { sym: 'velocity Verlet', meaning: '2.000 against 2; error 2.02e-7' }
            ]
          },
          {
            label: 'A circular orbit at h = 0.1 for 200 000 steps',
            expr: 'the radius should be constant; the shape of the deviation is the point',
            terms: [
              { sym: 'explicit Euler', meaning: '1.004988 → 143.505480, energy drift 98.8%' },
              { sym: 'RK4', meaning: '1.000000 → 0.994302, which is also its minimum — monotone decay' },
              { sym: 'velocity Verlet', meaning: '1.000012 → 1.004608, inside a band of 1.000000 to 1.004988' },
              { sym: 'energy drift', meaning: 'RK4 5.73e-3 against Verlet 2.46e-5, a factor of 233' }
            ]
          },
          {
            label: 'The same orbit at h = 0.01',
            expr: 'where the claimed effect does not reproduce',
            terms: [
              { sym: 'RK4', meaning: 'energy drift 5.56e-9' },
              { sym: 'velocity Verlet', meaning: '2.50e-9' },
              { sym: 'the honest statement', meaning: 'both hold to about a part in 10⁹ and there is nothing to choose between them' },
              { sym: 'why it still matters', meaning: 'real-time simulation runs at the frame time, which is a large step' }
            ]
          },
          {
            label: 'A stiff system with decay rates 1 000 and 1',
            expr: 'the explicit step is a stability constraint, not an accuracy one',
            terms: [
              { sym: 'stability limit', meaning: 'h = 2.000e-3, so reaching t = 1 needs 500 steps' },
              { sym: 'at 0.95× the limit', meaning: '526 steps, error 3.50e-4 — stable' },
              { sym: 'at 1.25× the limit', meaning: 'exploded; the boundary is a threshold, not a gradient' },
              { sym: 'implicit Euler', meaning: '10 steps at 50× the limit, error 1.77e-2' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'An order-p method divides its error by 2ᵖ when the step is halved',
          why: 'It makes the claimed order testable, which catches a mistyped coefficient a plot would not.',
          breaks: 'A measured order well below the claim is the standard symptom of an implementation bug.'
        },
        {
          name: 'A symplectic integrator’s energy error is bounded rather than accumulating',
          why: 'Over a long run bounded beats small, and the two are different properties.',
          breaks: 'It only applies to Hamiltonian systems, and only with a fixed step — adaptive stepping destroys it.'
        },
        {
          name: 'Explicit stability requires h below 2/|λ| of the fastest mode',
          why: 'It is a constraint you cannot negotiate by accepting less accuracy.',
          breaks: 'Crossing it does not degrade the answer gracefully; the solution explodes.'
        },
        {
          name: 'Implicit methods are unconditionally stable and cost a nonlinear solve per step',
          why: 'It moves the step-size choice back to accuracy, which is where you can reason about it.',
          breaks: 'On a non-stiff problem the extra cost per step buys nothing at all.'
        }
      ],
      complexity: [
        { operation: 'explicit Euler', average: 'one evaluation per step, first-order error', worst: 'bounded by the fastest mode’s stability limit, which can be absurdly small' },
        { operation: 'RK4', average: 'four evaluations per step, fourth-order error', worst: 'energy drifts monotonically on a conservative system, without limit' },
        { operation: 'velocity Verlet', average: 'one or two evaluations per step, second-order error', worst: 'bounded energy error, which is what a long run needs' },
        { operation: 'implicit Euler', average: 'a nonlinear solve per step, unconditionally stable', worst: 'several times the cost per step, and 50× the step size on the demo’s stiff problem' }
      ],
      failureModes: [
        {
          symptom: 'An orbital or molecular simulation loses energy over a long run.',
          cause: 'A non-symplectic integrator; the per-step energy errors all point the same way.',
          fix: 'Use velocity Verlet or leapfrog with a fixed step.'
        },
        {
          symptom: 'A simulation is stable at a small step and explodes at a slightly larger one.',
          cause: 'The step crossed the explicit stability limit of the fastest mode.',
          fix: 'Use an implicit method, or an explicit one with a stability region matched to the problem.'
        },
        {
          symptom: 'A stiff chemical kinetics model takes hours at a step of 10⁻⁶.',
          cause: 'A fast reaction that finished in the first microsecond still bounds the step.',
          fix: 'Switch to a stiff solver (BDF, Radau) and let the step be chosen by accuracy.'
        },
        {
          symptom: 'A "more accurate" solver makes a game simulation feel worse.',
          cause: 'Higher order per step, but no conservation — energy drifts and objects gain or lose speed.',
          fix: 'Choose the method by the invariant, not by the order.'
        },
        {
          symptom: 'A hand-written RK4 produces plausible trajectories and a measured order near 2.',
          cause: 'A wrong coefficient in the stage weights, which the trajectory does not reveal.',
          fix: 'Run the order study: halve the step and check the error falls by 16.'
        }
      ],
      inTheWild: [
        { system: 'Game physics engines (Box2D, Bullet)', how: 'use semi-implicit Euler or Verlet at a fixed timestep, and decouple it from the frame rate with an accumulator — the fixed step is what preserves the symplectic property.' },
        { system: 'SciPy’s `solve_ivp`', how: 'defaults to RK45, an embedded pair whose two estimates share stage evaluations so the error estimate is nearly free, and offers `BDF` and `Radau` for stiff problems.' },
        { system: 'Molecular dynamics (GROMACS, LAMMPS)', how: 'runs leapfrog or velocity Verlet for billions of steps, because bounded energy error is the only property that survives that many.' }
      ],
      sources: [
        { title: 'Geometric Numerical Integration', author: 'Hairer, Lubich and Wanner', note: 'Why symplectic integrators conserve a modified energy, which is the theorem behind the orbit result.' },
        { title: 'Solving Ordinary Differential Equations I and II', author: 'Hairer, Nørsett and Wanner', note: 'The standard reference; volume II is entirely about stiff problems.' },
        { title: 'Fix Your Timestep!', author: 'Glenn Fiedler', note: 'The fixed-timestep accumulator pattern, written for game developers and correct about why it matters.' },
        { title: 'Numerical Methods for Ordinary Differential Equations', author: 'J. C. Butcher', note: 'Runge–Kutta theory from the person the order conditions are named after.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
