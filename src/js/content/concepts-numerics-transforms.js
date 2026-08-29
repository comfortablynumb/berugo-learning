/** Concepts for Fourier transforms and optimisation (M18.9-M18.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'fourier-transforms': [
      {
        term: 'The DFT is a change of basis, not an approximation',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the samples"] --> C["the same information,<br/>written two ways"]',
            '    B["the spectrum"] --> C',
            '    C --> D["the transform is invertible"]',
            '    D --> E["nothing is lost and<br/>nothing is estimated"]',
            '    E --> F["so round-tripping returns exactly<br/>what you started with"]'
          ].join('\n'),
          caption: 'It is a rotation of the same data, not a model fitted to it. That is why a bug in an FFT shows up as a failed round trip rather than as a slightly worse answer.'
        },
        plain: 'The signal and its spectrum are the same information written two ways, and the transform is invertible exactly.',
        formal: 'Xₖ = Σⱼ xⱼ e^(−2πijk/n), a matrix–vector product costing n² operations',
        readAs: 'The k-th spectrum entry is the sum over every sample of that sample times a ' +
          'complex exponential whose angle steps by k each time — n such sums, each over n terms.',
        detail: 'Because it is a change of basis rather than a fit, filtering in the frequency ' +
          'domain and transforming back is a legitimate exact operation rather than a lossy one. ' +
          'The complex exponential is the natural basis here because it is an eigenfunction of ' +
          'shifting — delay a sinusoid and you get the same sinusoid with a phase change — which ' +
          'is exactly why convolution becomes multiplication in this basis.',
        example: 'The demo checks the FFT against the naive DFT at every size and finds them equal ' +
          'to 2.89e-12 at n = 256, which is accumulated rounding and nothing else.'
      },
      {
        term: 'The FFT computes exactly that in (n/2)log₂n butterflies',
        plain: 'Splitting the sum into even and odd samples gives two half-size transforms plus a twiddle multiply.',
        formal: 'the butterfly count is exactly (n/2)log₂n, not approximately it',
        readAs: 'Half the sample count multiplied by the number of times you can halve n before '
          + 'reaching one — that many two-input combining steps, exactly.',
        detail: 'The n² multiplications in the direct form contain only n distinct values, because ' +
          'the exponentials repeat — and the recursion is the arrangement that shares them. Each ' +
          'level halves the problem and costs n/2 butterflies, giving log₂n levels. The demo puts ' +
          'the measured count beside (n/2)log₂n so the equality can be read rather than trusted, ' +
          'and beside n² so the saving is a ratio rather than an asymptotic claim.',
        example: 'At n = 256 the demo counts 1 024 butterflies against the naive DFT’s 65 536 ' +
          'operations, a saving of 64.0×, and a forward-then-inverse round trip at ' +
          'n = 65 536 returns the input to 1.29e-12.'
      },
      {
        term: 'The bit-reversal permutation is what makes the iterative version in-place',
        plain: 'Splitting even from odd repeatedly lands each sample at the position given by its index with the bits reversed.',
        formal: 'sample j ends at the position whose binary digits are those of j read backwards',
        detail: 'The recursive form is easy to write and allocates an array per level. Permuting ' +
          'the input by bit-reversal up front puts every pair a butterfly needs adjacent at the ' +
          'right moment, so the iterative version runs in the original array with no recursion and ' +
          'no allocation. That is why production FFTs are loops rather than recursions, and the ' +
          'permutation is where the index arithmetic from 17.2 earns its keep.',
        example: 'The demo’s diagram shows the permutation before the first stage, and every stage ' +
          'afterwards pairing elements a fixed distance apart.'
      },
      {
        term: 'Leakage comes from the segment’s ends, not from the resolution',
        plain: 'The transform assumes your segment repeats forever, so a wave that does not fit a whole number of times has a jump at the wrap-around.',
        formal: 'a frequency between bins produces a discontinuity in the periodic extension, and a discontinuity has energy at every frequency',
        detail: 'This is the surprise: a pure sine wave smeared across the whole spectrum is not a ' +
          'resolution problem, and more samples do not fix it. The fault is at the boundary, where ' +
          'the last sample and the first no longer join smoothly. Once you see it that way the fix ' +
          'is obvious — change how the segment ends — and that is exactly what a window does.',
        example: 'With a component at 10.5 Hz in a 256-sample record at 256 Hz, the demo shows a ' +
          'single tone spread across every bin.'
      },
      {
        term: 'A window trades resolution for dynamic range, and there is no best one',
        plain: 'Taper the segment to zero at both ends and the skirt collapses; the peak gets lower and wider in exchange.',
        formal: 'each window is a different taper, scored by the ratio of the peak to the worst distant sidelobe',
        detail: 'The trade is unavoidable because tapering discards signal at the edges, which is ' +
          'what widens the main lobe. Which window is best depends on what you are looking for: ' +
          'Hamming flattens the first sidelobe and pays with a slower roll-off further out, while ' +
          'Hann and Blackman give up nearer resolution for far better distant rejection. That is ' +
          'why libraries ship a dozen of them rather than one.',
        example: 'On the same signal the demo measures peak-to-sidelobe ratios of 74× rectangular, ' +
          '642× Hamming, 22 244× Hann and 54 709× Blackman.'
      },
      {
        term: 'Aliasing is irreversible, and the fix has to happen before sampling',
        plain: 'Anything above half the sample rate folds back and becomes indistinguishable from a real component at the lower frequency.',
        formal: 'a component at f appears at |((f + r/2) mod r) − r/2| for sample rate r; at the sampling instants the two waves take identical values',
        readAs: 'Fold the frequency about half the sample rate and keep folding until it lands ' +
          'below; that is where it appears, and no later processing can tell it apart from a real ' +
          'component there.',
        detail: 'The information is not obscured, it is absent: the samples of a 1 100 Hz tone at ' +
          '1 kHz are numerically identical to those of a 100 Hz tone, so no filter, no window and ' +
          'no amount of analysis can separate them afterwards. That is why an anti-aliasing filter ' +
          'is analogue and sits before the converter — it is the last moment at which the ' +
          'distinction still exists.',
        example: 'At a 1 kHz sample rate the demo shows 700 Hz appearing at 300, 900 at 100, ' +
          '1 100 at 100 and 1 300 at 300.'
      },
      {
        term: 'Convolution becomes multiplication, and the crossover is real',
        plain: 'Transform both, multiply pointwise, transform back — and check the operation count before assuming it is faster.',
        formal: 'convolution costs n² directly and about 3·(n/2)log₂n through three transforms',
        readAs: 'Done directly it costs the square of the length; done through the transform it '
          + 'costs three transforms, each of which is half the length times the number of '
          + 'halvings.',
        detail: 'The asymptotic win is real and the constant is three transforms, so on short ' +
          'inputs the quadratic method is faster — the demo measures 48 operations for schoolbook ' +
          'against 96 butterflies through the transform on eight-by-six inputs. Every library that ' +
          'uses this has a length threshold below which it calls the quadratic routine instead, ' +
          'which is the same shape as the introsort and hybrid-root-finder pattern: fast ' +
          'asymptotics with a small-case fallback.',
        example: 'The demo shows the schoolbook route at 48 operations and the transform route at ' +
          '96 on the same inputs, with identical answers.'
      },
      {
        term: 'The number-theoretic transform does the same algorithm without rounding',
        plain: 'Run the FFT in modular integer arithmetic and the convolution is exact, not roundable.',
        formal: 'a root of unity of the right order exists modulo a suitable prime, so the same butterflies work over integers',
        detail: 'Floating-point convolution gives an answer that has to be rounded back to ' +
          'integers, and whether that rounding is safe depends on the inputs — the demo measures ' +
          '1.42e-14 here, which is comfortable and is not a guarantee. The NTT replaces the complex ' +
          'exponential with a modular root of unity and is exact by construction, valid while the ' +
          'largest possible coefficient stays under the modulus. This is how large integers are ' +
          'multiplied, and it connects directly back to Karatsuba in 17.8.',
        example: 'The demo reports the largest possible coefficient as 432 against a modulus of ' +
          '998 244 353, with 2.31M× of headroom.'
      }
    ],

    'optimisation': [
      {
        term: 'Convexity is what "solved" means, and it is the dividing line',
        plain: 'On a convex function every local minimum is the global one, so a method that stops has finished.',
        formal: 'f is convex if the segment between any two points on its graph lies on or above the graph',
        detail: 'Off convexity the same algorithm stops somewhere and cannot tell you what it ' +
          'found — a local minimum, a saddle, or a flat region. That is the entire difference ' +
          'between linear programming, where "optimal" is a provable claim, and neural network ' +
          'training, where it is a report of where the process stopped. The algorithms are similar; ' +
          'the claims you can make about their output are not.',
        example: 'Rosenbrock’s function in the demo is not convex, which is why every method’s path ' +
          'depends on where it started.'
      },
      {
        term: 'A fixed step size has a cliff on one side and a crawl on the other',
        plain: 'Above the stability limit gradient descent explodes; below it, halving the step roughly doubles the iterations.',
        formal: 'on a quadratic, descent diverges for step > 2/L where L is the largest curvature',
        readAs: 'The step must stay under two divided by the largest curvature of the surface, and ' +
          'that curvature is exactly the thing you do not know when choosing the step.',
        detail: 'The boundary is a threshold rather than a gradient, which is what makes the ' +
          'hyperparameter unpleasant: the good values sit immediately next to the values that ' +
          'explode, and the boundary moves with the surface. The demo measures 1 834 iterations at ' +
          'half the limit and 1 016 at 0.9 of it — closer is faster, right up until it is not.',
        example: 'The demo has descent diverging at 1.1× the stability limit in 79 iterations and ' +
          'at 2.0× in 14.'
      },
      {
        term: 'A line search chooses the step from the function instead of from a constant',
        plain: 'Start generous, halve until the decrease is proportional to what the slope promised, accept.',
        formal: 'the Armijo condition asks f(x + td) ≤ f(x) + c·t·(g · d), which a sufficiently small t always satisfies for a descent direction',
        readAs: 'Accept the step only if the function fell by at least a fixed fraction of what the ' +
          'slope in that direction predicted it would; for a downhill direction some small enough ' +
          'step always qualifies, so the loop terminates.',
        detail: 'Asking for a proportional decrease rather than any decrease is the whole point — ' +
          'any decrease would be satisfied by an arbitrarily tiny step, which converges to ' +
          'nowhere. Because a descent direction always admits some qualifying step, backtracking ' +
          'terminates, which is why this removes the hyperparameter rather than hiding it. It is ' +
          'not free: it spends several extra evaluations per iteration probing.',
        example: 'On Rosenbrock the demo’s line search reaches 9.105e-7 against the best fixed ' +
          'step’s 3.761e-3, for 64 587 evaluations against 10 000.'
      },
      {
        term: 'Momentum overshoots on purpose, and its objective goes up sometimes',
        plain: 'Accumulate a velocity so the steps along the valley floor reinforce and the steps across it cancel.',
        formal: 'v := βv − α∇f, then x := x + v; the objective is not monotone and that is intended',
        readAs: 'Keep a running velocity: shrink it a little, subtract a multiple of the gradient, '
          + 'then move by it — and accept that the objective sometimes goes up on the way.',
        detail: 'The zig-zag of plain descent on an elongated valley is oscillation across the ' +
          'narrow direction, and successive gradients there point in opposite directions. ' +
          'Averaging them through a velocity cancels the oscillation while the consistent ' +
          'component along the valley accumulates. The cost is that the objective rises on some ' +
          'iterations, so a monotone-decrease assertion would reject a correctly working ' +
          'optimiser.',
        example: 'The demo measures momentum converging in 4 129 iterations with 17 increases along ' +
          'the way.'
      },
      {
        term: 'Newton is affine invariant, which is why conditioning does not slow it',
        plain: 'Rescaling the problem rescales its steps identically, so the iteration count does not notice.',
        formal: 'the Newton step −H⁻¹g transforms correctly under any invertible change of variables, unlike −g',
        readAs: 'Multiplying the inverse of the second-derivative matrix by the gradient produces a ' +
          'step that transforms the same way the variables do; the plain gradient does not.',
        detail: 'The gradient is not a direction in the space of variables — it is a direction in ' +
          'the dual space, and treating it as one is exactly what makes descent sensitive to ' +
          'scaling. Multiplying by the inverse Hessian converts it properly, which is why Newton ' +
          'takes the same number of steps at any conditioning while descent’s count grows with it. ' +
          'This is also the real reason preconditioning helps first-order methods: it is an ' +
          'approximate version of the same correction.',
        example: 'Across condition numbers from 1 to 1 000 the demo measures gradient descent going ' +
          'from 2 iterations to 9 244 while Newton takes 2 at every point.'
      },
      {
        term: 'BFGS learns the curvature from gradients it was already computing',
        plain: 'Each step’s change in gradient tells you something about the second derivative, for free.',
        formal: 'the secant condition B(x_{k+1} − x_k) = g_{k+1} − g_k constrains an approximate Hessian, updated by a rank-two correction',
        readAs: 'The approximate curvature matrix must map the step you took to the change in ' +
          'gradient it produced; that condition plus a minimal-change rule determines the update.',
        detail: 'It is the same idea as the secant method in 18.2, lifted to many dimensions: use ' +
          'the difference between consecutive gradients instead of computing a derivative. The ' +
          'result gets most of Newton’s speed without ever forming or factoring a Hessian, which ' +
          'is why it is the default in every general-purpose optimiser. L-BFGS goes further and ' +
          'stores only the last few updates, making the memory linear rather than quadratic.',
        example: 'The demo has BFGS reaching 4.251e-21 in 36 iterations against Newton’s 22, on a ' +
          'surface where descent with a line search has not converged after 5 000.'
      },
      {
        term: 'Coordinate descent is fast when the problem is aligned and slow when it is rotated',
        plain: 'Minimising one variable at a time works beautifully if the variables are independent and badly if they are not.',
        formal: 'on a separable quadratic one pass suffices; a rotation of the same surface destroys that with identical eigenvalues',
        detail: 'This is the cleanest available demonstration of what affine invariance is not. The ' +
          'rotated surface has the same eigenvalues, the same condition number and the same ' +
          'difficulty by every intrinsic measure — only its alignment with the coordinate axes ' +
          'changed, and the iteration count moves by a factor of thirty. It matters because ' +
          'coordinate descent is what LASSO and many sparse solvers use, and their coordinates are ' +
          'features chosen by whoever built the dataset.',
        example: 'The demo measures 2 iterations on an axis-aligned valley and 68 on the same ' +
          'valley rotated by 45°.'
      },
      {
        term: 'Constraints turn the gradient condition into a condition on a cone',
        plain: 'At a constrained optimum the gradient does not vanish; it is balanced by the constraints pushing back.',
        formal: 'the KKT conditions require ∇f + Σλᵢ∇gᵢ = 0 with λᵢ ≥ 0 and λᵢgᵢ = 0 for each inequality',
        readAs: 'At the optimum the objective’s gradient is cancelled by a non-negative combination ' +
          'of the active constraints’ gradients, and a constraint that is not tight contributes ' +
          'nothing.',
        detail: 'The complementarity condition — either the constraint is tight or its multiplier ' +
          'is zero — is what makes this checkable rather than merely descriptive, and the ' +
          'multipliers have a direct meaning: each one is the rate at which the optimum would ' +
          'improve if that constraint were relaxed, which is the shadow price. That interpretation ' +
          'is the whole content of linear programming duality, and it is why solvers report ' +
          'multipliers alongside the solution.',
        example: 'The simplex method walks the vertices of the feasible polytope, and at each one ' +
          'the sign of the multipliers says whether an improving edge exists.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
