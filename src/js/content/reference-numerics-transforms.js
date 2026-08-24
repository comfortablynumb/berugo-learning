/** Reference entries for Fourier transforms and optimisation (M18.9-M18.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'fourier-transforms': {
      summary: 'The FFT checked against the transform it computes, the butterfly count measured ' +
        'against (n/2)log₂n exactly, four windows scored on the leakage they leave, and aliasing ' +
        'as a table of where each frequency actually lands.',
      intuition: 'Aliasing is not an audio curiosity: undersampled metrics dashboards show phantom ' +
        'periodicity for exactly the same reason, and the fix is the same — filter before you ' +
        'sample.',
      formulation: {
        equations: [
          {
            label: 'The transform and its fast form',
            expr: 'Xₖ = Σⱼ xⱼ e^(−2πijk/n), computed in (n/2)log₂n butterflies',
            terms: [
              { sym: 'n = 8', meaning: '12 butterflies against 64 naive operations, a saving of 5.3×' },
              { sym: 'n = 64', meaning: '192 against 4 096, a saving of 21.3×' },
              { sym: 'n = 256', meaning: '1 024 against 65 536, a saving of 64.0×' },
              { sym: 'agreement with the naive DFT', meaning: '4.61e-15 at n = 8 rising to 2.89e-12 at n = 256 — accumulated rounding, nothing else' }
            ]
          },
          {
            label: 'Round-trip accuracy, forward then inverse',
            expr: 'the acceptance criterion the milestone states',
            terms: [
              { sym: 'n = 256', meaning: 'relative error 2.64e-15' },
              { sym: 'n = 65 536', meaning: '1.29e-12, comfortably inside the 1e-10 requirement' },
              { sym: 'why it grows', meaning: 'log₂n stages of rounding, so the error grows slowly with the size' },
              { sym: 'bit-reversal', meaning: 'permuting the input up front is what lets the iterative form work in place' }
            ]
          },
          {
            label: 'Windows, on one tone at 10.5 Hz in a 256-sample record',
            expr: 'peak height, worst distant sidelobe, and their ratio',
            terms: [
              { sym: 'rectangular', meaning: 'peak 83.432, sidelobe 1.13e+0, ratio 74×' },
              { sym: 'Hamming', meaning: '56.521, 8.80e-2, ratio 642× — tuned to flatten the FIRST sidelobe' },
              { sym: 'Hann', meaning: '54.185, 2.44e-3, ratio 22 244×' },
              { sym: 'Blackman', meaning: '47.234, 8.63e-4, ratio 54 709× — best rejection, lowest and widest peak' }
            ]
          },
          {
            label: 'Aliasing at a 1 kHz sample rate, Nyquist 500 Hz',
            expr: 'fold about the Nyquist limit',
            terms: [
              { sym: '700 Hz', meaning: 'appears at 300 Hz' },
              { sym: '900 Hz', meaning: 'appears at 100 Hz' },
              { sym: '1 100 Hz', meaning: 'appears at 100 Hz — indistinguishable from a real 100 Hz tone in the samples' },
              { sym: '1 300 Hz', meaning: 'appears at 300 Hz; 4 of 8 components fold' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The FFT computes the DFT exactly, to rounding',
          why: 'It is a rearrangement of the same sum, not an approximation of it.',
          breaks: 'A difference above accumulated rounding means the implementation is wrong, not less accurate.'
        },
        {
          name: 'The butterfly count is exactly (n/2)log₂n',
          why: 'Making it exact rather than asymptotic turns the saving into a checkable number.',
          breaks: 'Non-power-of-two sizes need mixed radix or Bluestein and the count changes.'
        },
        {
          name: 'The transform assumes the segment repeats forever',
          why: 'Every leakage effect follows from this one assumption.',
          breaks: 'A frequency between bins makes the wrap-around discontinuous, spreading energy across every bin.'
        },
        {
          name: 'Aliasing is not invertible: two frequencies produce identical samples',
          why: 'It puts the fix before the sampler rather than after it.',
          breaks: 'No filter, window or analysis on the samples can separate what the samples do not distinguish.'
        }
      ],
      complexity: [
        { operation: 'naive DFT', average: 'n² complex multiplications', worst: '65 536 operations at n = 256 against the FFT’s 1 024' },
        { operation: 'radix-2 FFT', average: '(n/2)log₂n butterflies, exactly', worst: 'requires a power-of-two size; other sizes need mixed radix or Bluestein' },
        { operation: 'convolution through the FFT', average: 'three transforms plus a pointwise multiply', worst: 'slower than schoolbook below the crossover — 96 butterflies against 48 operations on the demo’s inputs' },
        { operation: 'number-theoretic transform', average: 'the same butterflies in modular arithmetic, exact', worst: 'valid only while the largest coefficient fits under the modulus' }
      ],
      failureModes: [
        {
          symptom: 'A pure tone shows up spread across the entire spectrum.',
          cause: 'Spectral leakage: the frequency does not land on a bin, so the periodic extension has a jump.',
          fix: 'Apply a window. More samples do not help, because the fault is at the segment boundary.'
        },
        {
          symptom: 'A dashboard shows a slow periodic pattern nobody can explain.',
          cause: 'Aliasing: a faster real cycle folded below the scrape rate.',
          fix: 'Average over the scrape interval rather than sampling instantaneously, and check the folding arithmetic.'
        },
        {
          symptom: 'A weak second tone is invisible next to a strong one.',
          cause: 'The strong tone’s sidelobes are above the weak tone, at 74× with no window.',
          fix: 'Use a Blackman or Hann window; the loss of resolution is worth the dynamic range here.'
        },
        {
          symptom: 'An FFT-based convolution of small arrays is slower than the naive loop.',
          cause: 'Three transforms cost more than n² below the crossover.',
          fix: 'Dispatch on length, the way every library does.'
        },
        {
          symptom: 'An FFT-based integer multiplication is off by one in a middle digit.',
          cause: 'The floating-point coefficients were large enough that rounding back to integers was unsafe.',
          fix: 'Use the number-theoretic transform, and check the coefficient bound against the modulus.'
        }
      ],
      inTheWild: [
        { system: 'FFTW', how: 'plans the transform at run time by benchmarking codelets for the actual size and machine, which is why it beats hand-written radix-2 by a wide margin.' },
        { system: 'Audio codecs (MP3, AAC, Opus)', how: 'transform overlapping windowed blocks, quantise the coefficients by a perceptual model, and rely on the window to stop block boundaries becoming audible clicks.' },
        { system: 'Prometheus and other scrape-based metrics systems', how: 'sample at a fixed interval and therefore alias any faster periodicity — which is why rate() over a window is preferred to an instantaneous gauge reading.' }
      ],
      sources: [
        { title: 'An algorithm for the machine calculation of complex Fourier series', author: 'Cooley and Tukey', note: 'The 1965 paper, four pages long, that made real-time spectral processing possible.' },
        { title: 'The Scientist and Engineer’s Guide to Digital Signal Processing', author: 'Steven W. Smith', note: 'Freely available, and unusually good on windows and what each one is for.' },
        { title: 'On the use of windows in harmonic analysis with the DFT', author: 'Fredric J. Harris', note: 'The 1978 survey that tabulates every window and the trade each one makes.' },
        { title: 'Numerical Recipes, chapters 12 and 13', author: 'Press, Teukolsky, Vetterling and Flannery', note: 'The FFT and its applications, including convolution and the crossover with direct methods.' }
      ]
    },

    'optimisation': {
      summary: 'Five optimisers on one surface with the step rule isolated as the only difference ' +
        'between the first three, a stability cliff measured either side of the limit, and two ' +
        'demonstrations that conditioning and alignment are what first-order methods pay for.',
      intuition: 'Most "the optimiser did not converge" reports are a step-size problem on an ' +
        'ill-conditioned surface, and a line search removes the hyperparameter that caused it.',
      formulation: {
        equations: [
          {
            label: 'Five methods on Rosenbrock from (−1.2, 1), limit 5 000 iterations',
            expr: 'iterations, gradient evaluations and final objective',
            terms: [
              { sym: 'fixed step 0.01', meaning: 'diverged in 5 iterations to 4.146e+35' },
              { sym: 'fixed step 0.001', meaning: '5 000 iterations, 10 000 evaluations, objective 3.761e-3' },
              { sym: 'line search', meaning: '5 000 iterations, 64 587 evaluations, objective 9.105e-7' },
              { sym: 'BFGS then Newton', meaning: '36 iterations to 4.251e-21, and 22 to 3.744e-21' }
            ]
          },
          {
            label: 'The stability cliff on an elongated valley',
            expr: 'fixed steps as multiples of 2/L',
            terms: [
              { sym: '0.5×', meaning: '1 834 iterations, converged' },
              { sym: '0.9×', meaning: '1 016 iterations — closer to the limit is faster' },
              { sym: '1.0×', meaning: 'never converges; the objective sits at 5.00e+1' },
              { sym: '1.1× and 2.0×', meaning: 'diverged in 79 and 14 iterations — a threshold, not a gradient' }
            ]
          },
          {
            label: 'Iterations against the condition number, both with a line search',
            expr: 'gradient descent beside Newton',
            terms: [
              { sym: 'κ = 1', meaning: 'descent 2, Newton 2' },
              { sym: 'κ = 100', meaning: 'descent 841, Newton 2' },
              { sym: 'κ = 1 000', meaning: 'descent 9 244, Newton 2' },
              { sym: 'why', meaning: 'the Newton step −H⁻¹g transforms correctly under rescaling; −g does not' }
            ]
          },
          {
            label: 'Coordinate descent on the same valley, twice',
            expr: 'identical eigenvalues, different alignment',
            terms: [
              { sym: 'axis-aligned', meaning: '2 iterations, 484 evaluations' },
              { sym: 'rotated 45°', meaning: '68 iterations, 16 456 evaluations' },
              { sym: 'what changed', meaning: 'nothing intrinsic — same condition number, same spectrum' },
              { sym: 'why it matters', meaning: 'LASSO solvers use coordinate descent, and features are chosen by whoever built the dataset' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'On a convex function every local minimum is global',
          why: 'It is what makes "optimal" a claim rather than a report of where the process stopped.',
          breaks: 'Off convexity a converged optimiser tells you nothing about what else exists.'
        },
        {
          name: 'Gradient descent with a fixed step diverges above 2/L',
          why: 'It bounds the step by a curvature you generally do not know.',
          breaks: 'Crossing the bound explodes rather than degrading, so tuning by bisection is expensive.'
        },
        {
          name: 'Backtracking terminates for any descent direction',
          why: 'It is why a line search removes the hyperparameter instead of hiding a default.',
          breaks: 'On a non-descent direction the loop does not terminate, which is why the direction is checked first.'
        },
        {
          name: 'Newton is affine invariant; gradient and coordinate descent are not',
          why: 'It explains both the conditioning result and the rotation result with one property.',
          breaks: 'Newton needs the Hessian to be positive definite, and it is not, away from a minimum.'
        }
      ],
      complexity: [
        { operation: 'gradient descent, fixed step', average: 'one gradient per iteration; iterations proportional to κ', worst: 'divergence above the stability limit, in a handful of iterations' },
        { operation: 'gradient descent, line search', average: 'several evaluations per iteration — 64 587 against 10 000 here', worst: 'never diverges; the count still grows with κ' },
        { operation: 'BFGS', average: 'one gradient per iteration plus an O(n²) update; 36 iterations here', worst: 'O(n²) memory, which is what L-BFGS trades away' },
        { operation: 'Newton', average: 'a Hessian and a factorisation per iteration; 22 iterations here', worst: 'O(n³) per step, and it needs a positive-definite Hessian to be a descent direction' }
      ],
      failureModes: [
        {
          symptom: 'Training loss becomes NaN within a few steps.',
          cause: 'The learning rate is above the stability limit; it explodes rather than converging slowly.',
          fix: 'Reduce the rate by an order of magnitude, or use a line search or an adaptive method.'
        },
        {
          symptom: 'An optimiser converges but takes thousands of iterations on a small problem.',
          cause: 'An ill-conditioned surface, which a first-order method pays for directly.',
          fix: 'Rescale the variables, precondition, or use a quasi-Newton method.'
        },
        {
          symptom: 'A monotone-decrease assertion fails on a correctly working optimiser.',
          cause: 'Momentum deliberately overshoots; its objective rises on some iterations.',
          fix: 'Assert on the trend over a window, not on every step.'
        },
        {
          symptom: 'Newton’s method moves uphill.',
          cause: 'The Hessian is not positive definite away from a minimum, so −H⁻¹g need not be a descent direction.',
          fix: 'Add a multiple of the identity until it is, which is what trust-region and Levenberg–Marquardt do.'
        },
        {
          symptom: 'A LASSO fit takes far longer on one dataset than on an equivalent one.',
          cause: 'Coordinate descent is sensitive to how the features align with the coordinate axes.',
          fix: 'Standardise the features, or decorrelate them before fitting.'
        }
      ],
      inTheWild: [
        { system: 'SciPy’s `minimize`', how: 'defaults to BFGS when a gradient is available and Nelder–Mead when it is not, and reports the iteration and evaluation counts separately — which is the distinction this section is about.' },
        { system: 'Adam and its relatives', how: 'adapt a per-parameter step from gradient statistics, which is a cheap approximation to the rescaling Newton does exactly; deep learning uses them because the problems are too large for curvature and too noisy for a line search.' },
        { system: 'Linear programming solvers (simplex and interior point)', how: 'return the dual multipliers alongside the solution, because each one is the shadow price of its constraint — the KKT conditions made into an output.' }
      ],
      sources: [
        { title: 'Numerical Optimization', author: 'Nocedal and Wright', note: 'The standard reference; the line-search and quasi-Newton chapters are the source for most of this section.' },
        { title: 'Convex Optimization', author: 'Boyd and Vandenberghe', note: 'Freely available, and the clearest treatment of why convexity is the dividing line and what KKT actually says.' },
        { title: 'Why Momentum Really Works', author: 'Gabriel Goh, Distill', note: 'The conditioning argument for momentum, with the oscillation-cancelling mechanism drawn rather than derived.' },
        { title: 'On the limited memory BFGS method for large scale optimization', author: 'Liu and Nocedal', note: 'How to keep most of BFGS while storing only a handful of updates.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
