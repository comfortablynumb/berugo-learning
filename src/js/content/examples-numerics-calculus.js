/** Worked examples for interpolation, differentiation and differential equations (M18.6-M18.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'interpolation': [
      {
        title: 'Adding data until the fit falls apart',
        goal: 'Take a smooth, harmless function and make a polynomial interpolant of it worse by ' +
          'giving it more samples — then fix it twice, two different ways.',
        setup: 'Runge’s function 1/(1 + 25x²) on [−1, 1], interpolated at 5, 9, 13, 17, 21 and 25 ' +
          'nodes, with the maximum error over the interval measured each time.',
        steps: [
          {
            do: 'Interpolate at 5 equally spaced nodes and measure the worst error.',
            why: 'To establish a baseline before adding data.',
            work: 'maximum error 4.384e-1',
            result: 'poor, as you would expect from a degree-4 polynomial'
          },
          {
            do: 'Add nodes and measure again, expecting improvement.',
            why: 'More data making a fit better is the intuition being tested.',
            work: '9 nodes: 1.045e+0; 13 nodes: 3.663e+0; 25 nodes: 2.572e+2',
            result: 'every addition makes it worse, and the last is 5.9e+2 times worse than the first'
          },
          {
            do: 'Locate where the error lives.',
            why: 'A diagnosis needs the position, not just the size.',
            work: 'the oscillation is concentrated near x = ±1; near x = 0 the fit is fine',
            result: 'the failure is at the ends of the interval'
          },
          {
            do: 'Move the same number of nodes to the Chebyshev positions.',
            why: 'If the failure is at the ends, sampling more densely there should address it.',
            work: 'at 25 nodes the error falls from 2.572e+2 to 8.166e-3, at the same degree',
            result: 'nothing was added; only the positions changed'
          },
          {
            do: 'Keep the original equally spaced nodes and fit a cubic spline instead.',
            why: 'The other fix: keep the sampling and lower the degree.',
            work: 'at 25 nodes the spline reaches 1.926e-3 on the same equally spaced data',
            result: 'the best of the three, and it never sees a degree above 3'
          }
        ],
        answer: 'Five times the data made the polynomial 5.9e+2 times worse, from 4.384e-1 to ' +
          '2.572e+2, and neither fix involved a better solver. Moving the nodes to the Chebyshev ' +
          'positions took the same degree to 8.166e-3; keeping the nodes and dropping to piecewise ' +
          'cubics took it to 1.926e-3. The mechanism behind both is the same: the interpolation ' +
          'error is proportional to the product of the distances to every node, and on a uniform ' +
          'grid that product is enormous near the ends. Cluster the nodes there, or never let the ' +
          'degree get high enough for it to matter.'
      },
      {
        title: 'A curve that interpolates perfectly and produces a negative probability',
        goal: 'Fit monotone data with two splines that both pass exactly through every point, and ' +
          'find the one that invents values the data never contained.',
        setup: 'The data 0, 0, 0, 1, 1, 1, 1 at x = 0 … 6 — a step, monotone increasing — fitted ' +
          'with a natural cubic spline and with a monotone (Fritsch–Carlson) cubic.',
        steps: [
          {
            do: 'Check that both curves interpolate.',
            why: 'This is the test most code applies, and both must pass it.',
            work: 'the worst deviation at any node is 1.1e-16 for the natural cubic and 0 for the monotone one',
            result: 'both pass through every data point to machine precision'
          },
          {
            do: 'Measure how far the natural cubic goes below the smallest data value.',
            why: 'The data’s minimum is zero, so anything below it was invented.',
            work: '0.1094 below zero',
            result: 'a curve fitted to non-negative data takes negative values between the points'
          },
          {
            do: 'Measure how far above the largest value it goes.',
            why: 'The overshoot is symmetric, and both directions matter.',
            work: '0.1078 above one, so the worst excursion is 10.9% of the data’s range',
            result: 'roughly a tenth of the range, in both directions'
          },
          {
            do: 'Explain why the smooth curve has no choice.',
            why: 'Calling it a defect would suggest a better algorithm exists.',
            work: 'C² continuity at 5 interior knots over-determines the shape; the excess appears as overshoot',
            result: 'the smoothest curve through these points is this one'
          },
          {
            do: 'Fit the monotone cubic and measure the same two quantities.',
            why: 'To price what giving up C² buys.',
            work: '0.0000 above and 0.0000 below, with the same exact interpolation at the nodes',
            result: 'monotone data produces a monotone curve, guaranteed'
          }
        ],
        answer: 'Both curves interpolate the data exactly and only one of them stays inside its ' +
          'range: the natural cubic dips 0.1094 below a data set whose minimum is zero, which is a ' +
          'negative probability, a negative price or a negative mass depending on what the numbers ' +
          'meant. That is not a bug in the spline — C² continuity forces the swing, and you asked ' +
          'for the smoothest curve. The monotone cubic gives up C² and gets 0.0000 in both ' +
          'directions. The general point is that "it passes through every data point" is the ' +
          'weakest quality claim available, and the interesting behaviour of any interpolant is ' +
          'entirely between the points.'
      }
    ],

    'differentiation-and-autodiff': [
      {
        title: 'Finding the bottom of the V, and the floor underneath it',
        goal: 'Derive the best step size for two finite-difference rules from the two error terms, ' +
          'then sweep to check — and read off the accuracy neither can beat.',
        setup: 'The derivative of sin at x = 1.0, whose exact value is cos(1), swept over step ' +
          'sizes from 10⁻¹⁶ to 10⁻¹ by decades, in double precision.',
        steps: [
          {
            do: 'Write down the two error terms for a forward difference.',
            why: 'The optimum is where they are equal, so both are needed.',
            work: 'truncation is about h·f″/2; rounding is about 2ε|f|/h with ε = 2.22e-16',
            result: 'one term grows with h and the other with 1/h'
          },
          {
            do: 'Set them equal and solve for h.',
            why: 'That is the definition of the crossing point.',
            work: 'h ≈ √ε = 1.49e-8, and the error there is about √ε too',
            result: 'a prediction of 1.5e-8 for the step and roughly 1e-8 for the error'
          },
          {
            do: 'Sweep and compare.',
            why: 'A decade-spaced sweep can resolve the decade, which is what the prediction claims.',
            work: 'measured minimum at h = 1e-8 with an error of 2.97e-9',
            result: 'the right decade, and the error is the predicted order'
          },
          {
            do: 'Repeat for the central difference, whose truncation is O(h²).',
            why: 'A different truncation term gives a different optimum, which is the point.',
            work: 'predicted ∛ε = 6.06e-6; measured minimum at h = 1e-5 with an error of 1.11e-11',
            result: 'three orders better, for one extra evaluation'
          },
          {
            do: 'Run the complex-step formula at h = 1e-16.',
            why: 'To show that the floor is a property of the subtraction, not of differentiation.',
            work: 'error 0 — there is no left-hand branch to the V at all',
            result: 'exact, because nothing was ever subtracted'
          }
        ],
        answer: 'The predicted optima are √ε = 1.49e-8 and ∛ε = 6.06e-6 and the sweep lands on the ' +
          'right decade for both, at errors of 2.97e-9 and 1.11e-11. The number worth carrying is ' +
          'the forward difference’s floor: about eight correct digits out of the sixteen a double ' +
          'holds, unreachable by any choice of h. That is not a bug to tune away — it is what ' +
          'subtracting two nearly equal numbers costs. The complex step scores exactly zero at ' +
          'h = 1e-16 for precisely that reason: there is no subtraction, so there is no ' +
          'cancellation, so there is no floor.'
      },
      {
        title: 'Reading a gradient off a tape',
        goal: 'Follow one reverse-mode sweep through a six-node computation graph by hand and see ' +
          'both partial derivatives appear from a single backward pass.',
        setup: 'f(x, y) = sin(xy) + eˣ at x = 0.4, y = 1.3, recorded as a tape of six nodes.',
        steps: [
          {
            do: 'Run forwards and record each node’s value and its local partials.',
            why: 'That is everything the forward pass stores — no derivatives of the whole function yet.',
            work: 'node 2 = xy = 0.520000 with partials 1.3000 and 0.4000; node 3 = sin(0.52) = 0.496880; node 4 = e^0.4 = 1.491825; node 5 = 1.988705',
            result: 'six rows, each knowing only its immediate parents'
          },
          {
            do: 'Seed the backward sweep at the output.',
            why: 'The derivative of f with respect to itself is 1, which is where the chain starts.',
            work: 'adjoint of node 5 = 1.000000',
            result: 'one number to propagate'
          },
          {
            do: 'Push the adjoint to the addition’s two parents.',
            why: 'Each parent receives the child’s adjoint times the local partial.',
            work: 'both partials of an addition are 1, so nodes 3 and 4 each receive 1.000000',
            result: 'two rows filled in'
          },
          {
            do: 'Push through the sine and the multiplication.',
            why: 'This is where the chain rule does real work.',
            work: 'node 2 gets 1.000000 × cos(0.52) = 0.867819; node 0 then gets 0.867819 × 1.3 and node 1 gets 0.867819 × 0.4',
            result: 'the multiplication splits its adjoint by the other operand'
          },
          {
            do: 'Add the exponential’s contribution to x and read the inputs.',
            why: 'x feeds two nodes, so its adjoint is a sum — which is what makes this a graph and not a chain.',
            work: '∂f/∂x = 0.867819 × 1.3 + 1.491825 = 2.619990, and ∂f/∂y = 0.347128',
            result: 'both partials, from one walk down the table'
          }
        ],
        answer: 'One backward sweep over six rows produced both partial derivatives, exactly: ' +
          '∂f/∂x = 2.619990 and ∂f/∂y = 0.347128. The cost did not depend on there being two ' +
          'inputs rather than two thousand — the sweep visits each node once whatever the input ' +
          'count — and that is the whole reason gradient-based training scales. The demo measures ' +
          'the consequence on a 24-input fixture: forward mode needs 24 sweeps and 9.60× the ' +
          'operations, while reverse mode needs 1. The price is memory, because the tape holds ' +
          'every intermediate value until the sweep reaches it.'
      }
    ],

    'differential-equations': [
      {
        title: 'Confirming a solver’s order from its own errors',
        goal: 'Verify that a fourth-order method is actually fourth order, which is the check that ' +
          'catches a mistyped coefficient when the trajectory still looks plausible.',
        setup: 'A unit spring, whose exact solution is a cosine, integrated to t = 1 with the step ' +
          'halved six times from a base of 20 steps.',
        steps: [
          {
            do: 'State what the order predicts about halving the step.',
            why: 'The prediction is what the measurement will be compared against.',
            work: 'error ∝ hᵖ, so halving h divides the error by 2ᵖ: 2 for Euler, 16 for RK4',
            result: 'a ratio to look for in consecutive rows'
          },
          {
            do: 'Take log₂ of consecutive error ratios and use the median.',
            why: 'The first rows are polluted by the coarse step and the last by machine precision.',
            work: 'log₂(ratio) is the order estimate; with 6 halvings there are 5 ratios, and the median of them is the reported value',
            result: 'one number per method'
          },
          {
            do: 'Read the four measurements.',
            why: 'Each should land on its claim.',
            work: 'Euler 0.998 against 1; midpoint 1.996 against 2; RK4 3.995 against 4; Verlet 2.000 against 2',
            result: 'all four within 0.01 of their stated order'
          },
          {
            do: 'Read the error at the finest step alongside the order.',
            why: 'The order says how fast it improves, not how good it is.',
            work: 'Euler 6.57e-4, midpoint 3.42e-7, RK4 4.95e-14, Verlet 2.02e-7',
            result: 'RK4 is seven orders better than Verlet on this measurement'
          },
          {
            do: 'Note what a wrong coefficient would do to this table.',
            why: 'That is why the check is worth running.',
            work: 'a mistyped RK weight typically gives an order near 2 while the trajectory still looks right',
            result: 'the order table catches it and a plot of the solution does not'
          }
        ],
        answer: 'The four measured orders are 0.998, 1.996, 3.995 and 2.000, each within 0.01 of ' +
          'the claim, which confirms the implementations. The last column is where the section ' +
          'turns: RK4’s error at the finest step is 4.95e-14 against Verlet’s 2.02e-7, seven orders ' +
          'better — and over a long orbital run it is RK4 whose answer decays. Accuracy per step ' +
          'and long-term fidelity are different questions, and this table answers only the first.'
      },
      {
        title: 'The orbit that decays under the more accurate method',
        goal: 'Run a circular orbit for 200 000 steps under three integrators and find the one ' +
          'whose error is bounded rather than smallest.',
        setup: 'A circular two-body orbit at step h = 0.1 for 200 000 steps, with the radius — ' +
          'which should be constant — sampled throughout.',
        steps: [
          {
            do: 'Run explicit Euler and confirm the obvious.',
            why: 'To establish the scale before comparing the two that matter.',
            work: 'the radius goes from 1.004988 to 143.505480, an energy drift of 98.8%',
            result: 'first order is not usable here, as expected'
          },
          {
            do: 'Run RK4 and look at the endpoint against the minimum.',
            why: 'Whether the endpoint IS the extreme tells you the shape of the error.',
            work: 'the radius ends at 0.994302, which is also its smallest value; the largest is 1.000000',
            result: 'monotone decay — running longer makes it worse without limit'
          },
          {
            do: 'Run Verlet and look at the same three numbers.',
            why: 'Same measurement, different shape.',
            work: 'ends at 1.004608, smallest 1.000000, largest 1.004988',
            result: 'oscillating inside a band, and running longer keeps it in the same band'
          },
          {
            do: 'Compare the energy drift.',
            why: 'It is the quantity the shape difference is really about.',
            work: 'RK4 5.73e-3 against Verlet 2.46e-5, a factor of 233',
            result: 'the second-order method is 233 times better on the measurement that matters here'
          },
          {
            do: 'Drop the step to 0.01 and repeat.',
            why: 'A claim that only holds at one setting should say so.',
            work: 'at h = 0.01 the drifts are 5.56e-9 for RK4 and 2.50e-9 for Verlet',
            result: 'both hold to about a part in 10⁹ and there is nothing to choose between them'
          }
        ],
        answer: 'At h = 0.1 over 200 000 steps RK4’s radius decays monotonically to 0.994302 while ' +
          'Verlet oscillates within 2.46e-5 of where it started — the fourth-order method loses ' +
          'energy and the second-order one does not. Verlet is symplectic: it exactly conserves a ' +
          'nearby modified energy, so its error is bounded forever, while RK4 conserves nothing in ' +
          'particular and its per-step errors accumulate. At h = 0.01 the effect vanishes ' +
          'entirely, which is worth stating: it matters at the step sizes real-time simulation ' +
          'uses, where the step is the frame time, and that is exactly where games are.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
