/** Concepts for least squares, QR, the SVD and eigenvalues (M18.4-M18.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'least-squares': [
      {
        term: 'Least squares projects rather than solves',
        plain: 'With more equations than unknowns there is no exact answer, so you take the point whose leftover is perpendicular to everything reachable.',
        formal: 'minimise ‖Ax − b‖², whose solution makes the residual orthogonal to every column of A',
        readAs: 'Choose x to make the length of the leftover as small as possible; at that point ' +
          'the leftover is at right angles to every column of the matrix.',
        detail: 'The geometric statement is the whole method and it is worth holding onto, ' +
          'because it explains why the answer is unique whenever the columns are independent — ' +
          'a point has exactly one closest point in a subspace. Setting the derivative of the ' +
          'squared norm to zero produces the same condition algebraically, which is where the ' +
          'normal equations come from. Squaring rather than taking absolute values is what makes ' +
          'the problem have a closed form at all, and it is also why one wild outlier can move ' +
          'the whole fit.',
        example: 'Every polynomial fit in the demo is this: the columns are 1, x, x², … sampled at ' +
          'the data points, and the fit is b projected onto their span.'
      },
      {
        term: 'The normal equations square the condition number, exactly',
        plain: 'AᵀA has κ(A) multiplied by itself, so you lose half your digits before any solving happens.',
        formal: 'κ(AᵀA) = κ(A)², so a design matrix at 10⁸ becomes a system at 10¹⁶',
        readAs: 'The condition number of A-transpose-A is the condition number of A squared, so a ' +
          'problem with eight zeros in its condition number turns into one with sixteen.',
        detail: 'This is the textbook derivation being numerically wrong, which is unusual enough ' +
          'to be worth stating plainly: the mathematics is correct and the arithmetic is not. The ' +
          'demo puts κ(A), κ(AᵀA) and their ratio in adjacent columns, and the ratio sits at 1.000 ' +
          'so the squaring can be read as exact rather than approximate. Past the degree where ' +
          'κ(AᵀA) exceeds 1/ε the reported number stops climbing, because the Gram matrix’s ' +
          'smallest singular value has fallen below what a double can resolve — the formulation ' +
          'has become indistinguishable from singular.',
        example: 'At degree 10 the demo shows κ(A) = 2.15e7 against κ(AᵀA) = 4.63e14, with the ' +
          'ratio to κ(A)² at 1.002.'
      },
      {
        term: 'Classical and modified Gram–Schmidt differ by one subtraction and by seven orders',
        plain: 'Subtract each projection from the running remainder rather than from the original vector.',
        formal: 'classical uses the original vector for every projection; modified uses the vector as it stands after the previous subtractions',
        detail: 'On paper the two are the same algorithm — the projections are of the same vector ' +
          'onto orthogonal directions, so the order cannot matter. In floating point it matters ' +
          'enormously, because the classical version computes every projection against a vector ' +
          'that still contains components it is about to remove, so the rounding errors reinforce ' +
          'instead of cancelling. This is the clearest example in the milestone of "algebraically ' +
          'identical" saying nothing about numerical behaviour.',
        example: 'On a degree-9 Vandermonde the demo measures classical Gram–Schmidt at 1.023e-1 ' +
          'from orthogonal against modified Gram–Schmidt at 2.164e-10 — a factor of 4.7e8.'
      },
      {
        term: 'Householder builds Q from reflections, which are orthogonal by construction',
        plain: 'Instead of subtracting projections and hoping they cancel, reflect the vector onto an axis.',
        formal: 'H = I − 2vvᵀ/(vᵀv) is orthogonal exactly, whatever rounding does to v',
        readAs: 'The reflection matrix built from any vector v is exactly orthogonal, so a product ' +
          'of such reflections is too, no matter how inaccurate the vectors themselves are.',
        detail: 'This is why no library ships Gram–Schmidt as its QR. Orthogonality is a property ' +
          'of the reflection’s form rather than of the arithmetic that produced it, so the ' +
          'computed Q is orthogonal to machine precision regardless of how ill-conditioned the ' +
          'matrix was. The pattern generalises: when you need a computed object to have a ' +
          'property, prefer a construction that has it structurally over one that achieves it by ' +
          'cancellation.',
        example: 'Householder measures 2.337e-15 from orthogonal on the matrix where classical ' +
          'Gram–Schmidt measures 1.023e-1 — a factor of 4.4e13.'
      },
      {
        term: 'The SVD is rotate, scale, rotate — and the scalings are everything you need',
        plain: 'Any matrix is a rotation, a stretch along axes, and another rotation.',
        formal: 'A = UΣVᵀ with U and V orthogonal and Σ diagonal with non-negative entries',
        readAs: 'A equals U times sigma times V-transpose, where the two outer matrices are pure ' +
          'rotations and the middle one only stretches along the axes.',
        detail: 'The singular values on that diagonal answer three separate questions at once: ' +
          'their ratio is the condition number, how many are meaningfully above zero is the rank, ' +
          'and each one is the error of the approximation that drops it. That is why plotting the ' +
          'spectrum is the first diagnostic for a misbehaving fit — the plot is the answer rather ' +
          'than an input to further analysis. It also exists for every matrix, square or not, ' +
          'singular or not, which the eigendecomposition does not.',
        example: 'The demo’s spectrum plot puts the singular values and the truncation errors on ' +
          'one chart, offset by exactly one position.'
      },
      {
        term: 'Eckart–Young: the best rank-k approximation is the first k singular values',
        plain: 'Truncating the SVD is optimal, and the error is exactly what you threw away.',
        formal: 'in the spectral norm the error is σₖ₊₁; in the Frobenius norm it is the root of the sum of the squares of all the dropped values',
        readAs: 'Measured one way, the leftover is the next singular value you discarded; measured ' +
          'the other way, it is the square root of the sum of the squares of every discarded one.',
        detail: 'The two norms give different numbers and the difference catches people out: ' +
          'measuring a Frobenius difference and comparing it to the spectral bound makes the ' +
          'approximation appear to violate its own guarantee, when it is a units error. What ' +
          'makes the theorem valuable is the word "best" — no other rank-k matrix, however ' +
          'cleverly constructed, does better. Principal component analysis, latent semantic ' +
          'indexing and embedding compression are all this theorem with different nouns.',
        example: 'At rank 6 the demo measures a Frobenius error of 5.57e-4 against a Frobenius ' +
          'bound of 5.57e-4 and a spectral bound of 5.34e-4.'
      },
      {
        term: 'Numerical rank is a threshold decision, not a property of the matrix',
        plain: 'No computed singular value is exactly zero, so someone has to say how small counts as gone.',
        formal: 'rank = the count of singular values above σ_max × max(m, n) × machine epsilon, which is a convention',
        readAs: 'Count the singular values that are bigger than the largest one multiplied by the '
          + 'matrix’s larger dimension and by machine epsilon; that count is what the library '
          + 'calls the rank, and the threshold is a choice rather than a fact.',
        detail: 'Exact rank is a discontinuous function of the entries, so it cannot survive ' +
          'rounding: perturb a singular matrix in the sixteenth digit and it becomes full rank. ' +
          'Every library therefore picks a tolerance, and the standard one scales with the largest ' +
          'singular value and the size. Knowing it is a convention matters because it is ' +
          'adjustable — with noisy data the right threshold is the noise level, not machine ' +
          'epsilon, and using the default silently keeps directions that are pure noise.',
        example: 'The truncation table’s last row has a singular value of 1.00e-6 and a measured ' +
          'error of 1.78e-15 once it is kept, which is the floor rather than a meaningful value.'
      },
      {
        term: 'Ridge regularisation trades a little bias for a lot of variance',
        plain: 'Add a small multiple of the identity before solving, and the tiny singular values stop being inverted.',
        formal: 'minimise ‖Ax − b‖² + λ‖x‖², whose solution replaces each 1/σ with σ/(σ² + λ)',
        readAs: 'Penalise large coefficients as well as large residuals; the effect is that a ' +
          'singular value close to zero is damped instead of inverted into something enormous.',
        detail: 'The mechanism is visible in the singular values: the unregularised solution ' +
          'divides by σ, so a σ of 10⁻¹² produces a coefficient of 10¹² driven entirely by noise. ' +
          'The ridge form divides by σ + λ/σ instead, which leaves the large singular values ' +
          'almost untouched and crushes the small ones. Choosing λ is choosing where to put the ' +
          'boundary between signal and noise, which is the same decision as the rank threshold, ' +
          'made continuously instead of discretely.',
        example: 'On the demo’s highest-degree fits the unregularised coefficient norm grows with ' +
          'the condition number, which is what regularisation is there to stop.'
      }
    ],

    'eigenvalues': [
      {
        term: 'An eigenvector is a direction the matrix only scales',
        plain: 'Most vectors get rotated; a few come out pointing exactly where they went in, just longer or shorter.',
        formal: 'Av = λv with v non-zero; λ is the factor and v the direction',
        readAs: 'A times v equals lambda times v: applying the matrix to that particular direction ' +
          'is the same as multiplying it by a single number.',
        detail: 'Those directions are what make a matrix comprehensible, because in a basis of ' +
          'them the matrix is diagonal and applying it a thousand times is raising numbers to the ' +
          'thousandth power. That is the content of PageRank (the stationary distribution is an ' +
          'eigenvector), of PCA (the principal directions are eigenvectors of the covariance), of ' +
          'vibration analysis (the modes are eigenvectors) and of stability analysis (the growth ' +
          'rates are eigenvalues).',
        example: 'The demo builds symmetric matrices with a chosen spectrum, so the eigenvalues ' +
          'are known in advance and every method can be scored against them.'
      },
      {
        term: 'Power iteration is three lines and its speed is one number',
        plain: 'Multiply and normalise repeatedly; the largest eigenvalue wins and the rest decay away.',
        formal: 'the error falls by |λ₂/λ₁| each step, so reaching a tolerance takes about log(tolerance)/log(gap) steps',
        readAs: 'Each pass shrinks the unwanted part by the ratio of the second eigenvalue to the ' +
          'first, so the number of passes needed is the log of the tolerance divided by the log of ' +
          'that ratio.',
        detail: 'Every eigendirection is scaled by its own eigenvalue on each pass, so relative to ' +
          'the largest, everything else shrinks — and the rate is entirely the gap. The matrix ' +
          'size does not appear anywhere in that count, which is why the method scales to matrices ' +
          'too large to factor. It also means a slow PageRank is a statement about the graph’s ' +
          'spectrum rather than about the implementation.',
        example: 'The demo measures 33 iterations at a gap of 0.5 and 1 802 at a gap of 0.99, on ' +
          'the same four-by-four matrix.'
      },
      {
        term: 'A starting vector that is already an eigenvector never leaves it',
        plain: 'Power iteration on an exact eigenvector returns that eigenvalue forever, whichever one it is.',
        formal: 'if x₀ = v_k then Ax₀ = λ_k x₀, so the iteration is stationary at λ_k',
        readAs: 'If the starting vector is already the k-th eigenvector, then multiplying by the '
          + 'matrix just scales it by the k-th eigenvalue, so the iteration never moves off it.',
        detail: 'This is the practical trap in an otherwise trivial algorithm, and the vector of ' +
          'all ones walks straight into it: it is an eigenvector of every matrix with constant row ' +
          'sums, which includes many of the structured matrices people test with. In exact ' +
          'arithmetic the iteration never escapes; in floating point rounding eventually ' +
          'introduces a component along the dominant direction and it escapes slowly, which is ' +
          'worse than failing. A random or simply non-symmetric starting vector avoids it.',
        example: 'On [[2, 1], [1, 2]] the all-ones vector is the eigenvector for λ = 3, so inverse ' +
          'iteration started there reports the smallest eigenvalue as 3 rather than 1.'
      },
      {
        term: 'Shifting turns any eigenvalue you name into the dominant one',
        plain: 'Iterate on (A − σI)⁻¹ and whichever eigenvalue is nearest your guess becomes enormous relative to the rest.',
        formal: 'the eigenvalues of (A − σI)⁻¹ are 1/(λ − σ), which is largest for the λ nearest σ',
        readAs: 'Subtract your guess from the matrix and invert; each eigenvalue becomes one over ' +
          'its distance from the guess, so the closest one becomes the biggest by a wide margin.',
        detail: 'It converts the gap — the thing that decides the speed and that you do not ' +
          'control — into something you do control, which is the whole trick. It reaches the ' +
          'smallest eigenvalue, which plain power iteration can never do, and it converges in a ' +
          'dozen steps for any target. The inverse is never formed: each step solves ' +
          '(A − σI)y = x with the factorisation computed once, which is 18.3’s reuse rule applied.',
        example: 'The demo reaches all four eigenvalues of a spectrum spanning 1 to 10 in between ' +
          '10 and 24 iterations each, against 1 802 for power iteration at a tight gap.'
      },
      {
        term: 'The QR algorithm makes the matrix triangular without changing it',
        plain: 'Factor as QR, multiply back in the other order, repeat — and the eigenvalues never move.',
        formal: 'RQ = QᵀAQ, which is a similarity transformation, and similar matrices have identical eigenvalues',
        readAs: 'Multiplying R by Q gives Q-transpose times A times Q, which is a change of basis ' +
          'rather than a change of matrix, so the eigenvalues are untouched.',
        detail: 'The invariance is what makes it safe: every step is a change of basis, so the ' +
          'thing being sought is preserved exactly while the shape of the matrix improves. The ' +
          'subdiagonal shrinks by a factor set by ratios of neighbouring eigenvalues, which is ' +
          'power iteration appearing again from another angle. Production implementations reduce ' +
          'to Hessenberg form first — one O(n³) step that makes each sweep O(n²) instead of ' +
          'O(n³) — and add shifts, which turn the convergence cubic.',
        example: 'The demo drives the subdiagonal norm to machine precision in 37 sweeps and ' +
          'recovers all four eigenvalues from the diagonal.'
      },
      {
        term: 'Never compute eigenvalues through the characteristic polynomial',
        plain: 'It is the definition and it is numerically hopeless; the roots are catastrophically sensitive to the coefficients.',
        formal: 'det(A − λI) = 0 defines the eigenvalues, and the map from coefficients to roots can amplify a perturbation by 10⁹',
        readAs: 'The eigenvalues are the values of lambda that make the determinant of A minus '
          + 'lambda times the identity equal to zero — and getting them that way can magnify a '
          + 'wobble in the coefficients by a factor of a billion.',
        detail: 'Wilkinson’s example is the one everyone cites and it deserves the reputation: the ' +
          'polynomial with roots at 1 through 20 has coefficients that, perturbed in their ' +
          'fifteenth significant digit — less than the rounding that storing them already caused — ' +
          'move a root by most of a whole unit. The eigenvalues of a symmetric matrix are ' +
          'perfectly well conditioned; it is the detour through the polynomial that destroys them, ' +
          'which is the general lesson: a route can be far worse conditioned than its destination.',
        example: 'The demo perturbs one coefficient by a factor of 1 + 1e-10 and measures the root ' +
          'moving 3.906e-8 at degree 5 and 9.051e-1 at degree 20.'
      },
      {
        term: 'Krylov methods get a few eigenvalues without ever forming a factorisation',
        plain: 'Build a subspace from repeated matrix-vector products and solve a tiny problem inside it.',
        formal: 'the Krylov subspace spanned by x, Ax, A²x, … captures the extreme eigenvalues first',
        detail: 'Lanczos for symmetric matrices and Arnoldi for general ones are what you reach ' +
          'for when the matrix is enormous and sparse and you want the ten largest eigenvalues ' +
          'rather than all of them. The cost per step is one matrix-vector product, so the ' +
          'sparsity is preserved throughout, and the extreme eigenvalues emerge long before the ' +
          'subspace is complete. The practical catch is that the basis loses orthogonality in ' +
          'floating point and has to be reorthogonalised, which is where most of the ' +
          'implementation effort goes.',
        example: 'Power iteration is the one-dimensional case of this, and its convergence at a ' +
          'gap of 0.99 shows why the larger subspace is worth building.'
      },
      {
        term: 'The eigenvalue gap is the answer to "why is this converging slowly"',
        plain: 'When PageRank crawls, the graph structure is the reason, not the implementation.',
        formal: 'iterations ≈ log(tolerance) / log(|λ₂/λ₁|), which diverges as the gap approaches 1',
        readAs: 'The number of passes is roughly the log of the tolerance divided by the log of '
          + 'the ratio of the second eigenvalue to the first, and that count grows without bound '
          + 'as the two eigenvalues get closer together.',
        detail: 'This reframes a class of performance question. A near-tie between the top two ' +
          'eigenvalues means the system has two nearly equally dominant modes, and no ' +
          'implementation trick changes that — the fix is structural. In PageRank the damping ' +
          'factor is exactly this lever: 0.85 rather than 0.99 is a deliberate choice to bound the ' +
          'second eigenvalue, trading some fidelity to the link structure for a convergence rate ' +
          'that is knowable in advance.',
        example: 'The demo’s prediction column is log(1e-10)/log(gap), and the measurement runs a ' +
          'little under it at every row while growing at the same rate.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
