/** Worked examples for Fourier transforms and optimisation (M18.9-M18.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'fourier-transforms': [
      {
        title: 'A pure tone smeared across every bin, and the fix that is not more data',
        goal: 'Reproduce spectral leakage from one sine wave, locate the actual cause, and price ' +
          'the four windows against each other.',
        setup: 'A single component at 10.5 Hz in a 256-sample record at 256 Hz, so the wave fits ' +
          '10.5 times into the segment rather than a whole number of times.',
        steps: [
          {
            do: 'Transform without a window and look at the spectrum.',
            why: 'The result is the surprise the section is built around.',
            work: 'the peak is 83.432 and the worst sidelobe more than 30 bins away is 1.13e+0',
            result: 'a peak-to-sidelobe ratio of only 74×, from a single pure tone'
          },
          {
            do: 'Rule out resolution as the cause.',
            why: 'It is the first thing everybody suspects, and it is wrong.',
            work: 'the wave fits 10.5 times, so the periodic extension has a step where sample 255 meets sample 0',
            result: 'the fault is at the boundary, and more samples do not remove it'
          },
          {
            do: 'Work out what a jump does to a spectrum.',
            why: 'This turns the diagnosis into a prediction about the fix.',
            work: 'a discontinuity has energy at every frequency, so it appears across all 128 bins',
            result: 'change how the segment ENDS and the skirt should collapse'
          },
          {
            do: 'Apply a Hann window and measure again.',
            why: 'A taper to zero at both ends removes the jump.',
            work: 'peak 54.185, worst distant sidelobe 2.44e-3, ratio 22 244×',
            result: '300 times better rejection than no window at all'
          },
          {
            do: 'Compare all four and notice the ordering is not a ladder.',
            why: 'Hamming is often described as "better than Hann" and on this measurement it is not.',
            work: 'rectangular 74×, Hamming 642×, Hann 22 244×, Blackman 54 709×',
            result: 'Hamming flattens the FIRST sidelobe and rolls off more slowly further out'
          }
        ],
        answer: 'One pure tone left a skirt across the entire spectrum with a peak-to-sidelobe ' +
          'ratio of 74×, and a window took it to 54 709× without changing the data at all. The ' +
          'cause was never resolution — it was the discontinuity where the assumed periodic ' +
          'extension wraps around, so the fix has to change the ends rather than add samples. The ' +
          'cost is visible in the peak column: windowing discards signal at the edges, so the peak ' +
          'falls from 83.432 to 47.234 and widens. That is the trade — resolution against dynamic ' +
          'range — and it is why libraries ship a dozen windows rather than one.'
      },
      {
        title: 'Where 1 100 Hz goes, and why nothing afterwards can bring it back',
        goal: 'Compute where each frequency lands under sampling, and establish that the ambiguity ' +
          'is in the samples rather than in the analysis.',
        setup: 'A 1 kHz sample rate, so the Nyquist limit is 500 Hz, with components at 100, 300, ' +
          '450, 500, 700, 900, 1 100 and 1 300 Hz.',
        steps: [
          {
            do: 'Fold each frequency about the Nyquist limit.',
            why: 'That is the arithmetic of aliasing, and it is worth doing rather than describing.',
            work: '700 → |700 − 1000| = 300; 900 → 100; 1 100 → 100; 1 300 → 300',
            result: '4 of the 8 components appear somewhere other than where they are'
          },
          {
            do: 'Check whether the samples themselves distinguish 1 100 Hz from 100 Hz.',
            why: 'If they do, some clever analysis could separate them.',
            work: 'at t = k/1000 the two waves take identical values for every integer k',
            result: 'the sample sequences are the same numbers, so nothing downstream can differ'
          },
          {
            do: 'Consider filtering after sampling.',
            why: 'It is the natural first suggestion and it does not work.',
            work: 'a filter operates on the samples, and the 2 inputs produced identical samples',
            result: 'no filter can produce different outputs from identical inputs'
          },
          {
            do: 'Place the fix where it can still work.',
            why: 'The information exists before sampling and not after.',
            work: 'an analogue low-pass filter before the converter removes everything above 500 Hz',
            result: 'the fix is upstream of the last moment the distinction exists'
          },
          {
            do: 'Translate the same arithmetic into a metrics pipeline.',
            why: 'It is the same phenomenon with different units, and far more commonly met.',
            work: 'a spike every 55 s scraped once every 60 s: folding 1/55 Hz at a 1/60 Hz rate gives a period of about 11 minutes',
            result: 'a phantom eleven-minute cycle that no analysis of the stored series can refute'
          }
        ],
        answer: 'Four of eight components fold, and the reason they cannot be recovered is that the ' +
          'samples of a 1 100 Hz tone and a 100 Hz tone are the same numbers — no filter can ' +
          'produce different outputs from identical inputs. That is why an anti-aliasing filter is ' +
          'analogue and sits before the converter. The version that costs engineers the most time ' +
          'is the metrics one: a 55-second spike scraped every 60 seconds shows up as a slow ' +
          'eleven-minute oscillation, and the fix is the same — average over the interval rather ' +
          'than taking an instantaneous reading, because an average is a low-pass filter.'
      }
    ],

    'optimisation': [
      {
        title: 'One factor of ten between diverging and crawling',
        goal: 'Show that a fixed step size is not merely awkward to tune but has a threshold, and ' +
          'that a line search removes the parameter rather than defaulting it.',
        setup: 'Rosenbrock’s function from (−1.2, 1), with a limit of 5 000 iterations and a ' +
          'tolerance of 1e-8.',
        steps: [
          {
            do: 'Run gradient descent at a step of 0.01.',
            why: 'It is a perfectly reasonable-looking learning rate.',
            work: 'diverged in 5 iterations, objective 4.146e+35',
            result: 'not slow convergence — an explosion, in five steps'
          },
          {
            do: 'Drop the step by a factor of ten and run again.',
            why: 'To locate the boundary rather than describe it.',
            work: 'at 0.001 it survives and reaches 3.761e-3 after the full 5 000 iterations',
            result: 'one factor of ten separates exploding from not converging'
          },
          {
            do: 'Run with a backtracking line search and no step size at all.',
            why: 'The comparison the section is about.',
            work: 'objective 9.105e-7 in the same 5 000 iterations, distance to the minimum 2.13e-3',
            result: 'four orders of magnitude better than the best fixed step'
          },
          {
            do: 'Read the evaluation column before calling that free.',
            why: 'The line search probes several candidate steps per iteration.',
            work: '64 587 gradient evaluations against the fixed step’s 10 000',
            result: 'about six times the work per unit of progress'
          },
          {
            do: 'Run BFGS and Newton on the same problem.',
            why: 'To see what curvature information is worth beyond a good step.',
            work: 'BFGS 4.251e-21 in 36 iterations; Newton 3.744e-21 in 22',
            result: 'both finish while the first-order methods are still running'
          }
        ],
        answer: 'The two fixed steps are one factor of ten apart and one of them explodes in five ' +
          'iterations. The line search needs neither, gets four orders further in the same ' +
          'iteration budget and costs about six times the evaluations — which is the real trade, ' +
          'and it is usually worth taking, because the alternative is a number you cannot choose ' +
          'correctly without already knowing the surface. Then BFGS finishes in 36 iterations and ' +
          'Newton in 22, which is the argument for curvature: a better step along the wrong ' +
          'direction still zig-zags.'
      },
      {
        title: 'Two views of affine invariance, one of them free',
        goal: 'Measure how badly conditioning hurts a first-order method, then show the same effect ' +
          'produced by a pure rotation that changes nothing intrinsic at all.',
        setup: 'Quadratic bowls at condition numbers from 1 to 1 000 for the first part, and a ' +
          'κ = 20 valley in two orientations for the second.',
        steps: [
          {
            do: 'Run gradient descent with a line search across the condition numbers.',
            why: 'Using a line search removes the step size as an explanation.',
            work: '2, 30, 75, 279, 841, 1 439 and 9 244 iterations for κ = 1, 3, 10, 30, 100, 300, 1 000',
            result: 'the count tracks the conditioning even with the step chosen optimally'
          },
          {
            do: 'Run Newton on the same seven problems.',
            why: 'To isolate what the extra information buys.',
            work: '2 iterations at every single condition number',
            result: 'the count does not notice the conditioning at all'
          },
          {
            do: 'Explain the difference without appealing to speed.',
            why: 'It is a structural property rather than a constant-factor one.',
            work: 'the Newton step −H⁻¹g transforms correctly under any rescaling of the 2 variables; −g does not',
            result: 'Newton is affine invariant and gradient descent is not'
          },
          {
            do: 'Run coordinate descent on a κ = 20 valley aligned with the axes.',
            why: 'A second method whose behaviour depends on the coordinate system.',
            work: '2 iterations, 484 evaluations',
            result: 'each variable is independent of the others, so one pass settles it'
          },
          {
            do: 'Rotate the identical surface by 45° and repeat.',
            why: 'The rotation changes the alignment and nothing else.',
            work: '68 iterations, 16 456 evaluations — same eigenvalues, same condition number',
            result: 'a factor of 34 from a change that alters no intrinsic property'
          }
        ],
        answer: 'Gradient descent with a line search goes from 2 iterations to 9 244 as κ goes from ' +
          '1 to 1 000, and Newton takes 2 throughout — the difference is that the Newton step ' +
          'transforms correctly under rescaling and the plain gradient does not. The rotation ' +
          'makes the same point from the other side: coordinate descent goes from 2 iterations to ' +
          '68 on a surface with identical eigenvalues, purely because it is no longer aligned with ' +
          'the axes. That matters practically because coordinate descent is what LASSO solvers ' +
          'use, and their coordinates are features someone else chose.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
