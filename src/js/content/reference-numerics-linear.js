/** Reference entries for least squares, QR, the SVD and eigenvalues (M18.4-M18.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'least-squares': {
      summary: 'Overdetermined systems by three routes, with the normal equations squaring the ' +
        'condition number exactly, the three QR variants separated by thirteen orders of ' +
        'orthogonality, and the SVD truncation bound measured in both norms.',
      intuition: 'Forming AᵀA squares the condition number, which is why the textbook derivation ' +
        'quietly fails on exactly the fitting problems people most want to solve.',
      formulation: {
        equations: [
          {
            label: 'The three routes to the same minimiser',
            expr: 'normal equations, QR, or the SVD',
            terms: [
              { sym: 'normal equations', meaning: 'solve AᵀAx = Aᵀb — cheapest, and squares κ' },
              { sym: 'QR', meaning: 'A = QR then Rx = Qᵀb — about twice the cost, κ preserved, the library default' },
              { sym: 'SVD', meaning: 'most expensive, κ preserved, and the only one that reports the rank' },
              { sym: 'measured at degree 10', meaning: 'QR residual 6.92e-15 against the normal equations’ 1.31e-10' }
            ]
          },
          {
            label: 'The squaring, measured',
            expr: 'κ(AᵀA) = κ(A)², with the ratio column reading 1.000',
            terms: [
              { sym: 'degree 4', meaning: 'κ(A) 6.05e2, κ(AᵀA) 3.66e5, ratio 1.000' },
              { sym: 'degree 10', meaning: 'κ(A) 2.15e7, κ(AᵀA) 4.63e14, ratio 1.002' },
              { sym: 'degree 14', meaning: 'κ(AᵀA) reads 4.76e17 and stops rising — the measurement has hit its own floor' },
              { sym: 'why', meaning: 'the Gram matrix’s smallest singular value has fallen below what a double resolves' }
            ]
          },
          {
            label: 'Orthogonality loss on a degree-9 Vandermonde',
            expr: '‖QᵀQ − I‖ for the three QR variants',
            terms: [
              { sym: 'classical Gram–Schmidt', meaning: '1.023e-1 — not orthogonal to one decimal place' },
              { sym: 'modified Gram–Schmidt', meaning: '2.164e-10, a factor of 4.7e8 for one changed operand' },
              { sym: 'Householder', meaning: '2.337e-15, another 9.3e4 beyond that' },
              { sym: 'why Householder wins', meaning: 'I − 2vvᵀ/(vᵀv) is exactly orthogonal for any v, however rounded' }
            ]
          },
          {
            label: 'Eckart–Young, in two norms',
            expr: 'the spectral error is σₖ₊₁; the Frobenius error is the root of the sum of the squares of the dropped values',
            terms: [
              { sym: 'at rank 6', meaning: 'measured Frobenius 5.57e-4, Frobenius bound 5.57e-4, spectral bound 5.34e-4' },
              { sym: 'the trap', meaning: 'a Frobenius measurement against a spectral bound appears to violate the guarantee' },
              { sym: 'storage', meaning: 'k(m + n + 1) numbers, so on a square matrix truncation pays below about half the rank' },
              { sym: 'what it powers', meaning: 'PCA, latent semantic indexing, and every embedding-compression trick' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'At the least-squares minimum the residual is orthogonal to every column of A',
          why: 'It is the geometric definition, and it is what the normal equations state algebraically.',
          breaks: 'A residual with a component in the column space means the minimiser was not reached.'
        },
        {
          name: 'κ(AᵀA) is κ(A) squared, exactly',
          why: 'It converts "the normal equations are less accurate" into a computation you can do in advance.',
          breaks: 'Past κ(A) ≈ 10⁸ the squared formulation has no digits left, whatever the solver.'
        },
        {
          name: 'A Householder reflection is orthogonal regardless of rounding in the vector defining it',
          why: 'Orthogonality is a property of the form, so no arithmetic error can remove it.',
          breaks: 'Gram–Schmidt achieves orthogonality by cancellation instead, and loses it as κ rises.'
        },
        {
          name: 'The best rank-k approximation is the truncated SVD, in both the spectral and Frobenius norms',
          why: 'It makes truncation a decision about how much error you accept, not about which method to use.',
          breaks: 'Comparing a Frobenius measurement with a spectral bound reads as a violated guarantee.'
        }
      ],
      complexity: [
        { operation: 'normal equations', average: 'about mn²/2 to form plus n³/3 to solve — the cheapest route', worst: 'κ squared, so it fails at half the conditioning the others tolerate' },
        { operation: 'Householder QR', average: 'about 2mn² − 2n³/3', worst: 'the library default; no known failure mode short of an actually rank-deficient matrix' },
        { operation: 'SVD', average: 'about 10n³ for a square matrix — several times QR', worst: 'the same, and it is the only route that diagnoses rank deficiency' },
        { operation: 'rank-k truncation', average: 'k(m + n + 1) numbers stored against mn', worst: 'no saving at all above about half the rank on a square matrix' }
      ],
      failureModes: [
        {
          symptom: 'A polynomial fit is fine to degree 8 and produces nonsense coefficients at degree 12.',
          cause: 'The normal equations squared a condition number that was already 10⁷.',
          fix: 'Use QR or the SVD — `lstsq`, not `(X\'X)^-1 X\'y` — and consider an orthogonal basis.'
        },
        {
          symptom: 'A hand-written Gram–Schmidt produces a Q whose columns are visibly not orthogonal.',
          cause: 'Classical Gram–Schmidt projects the original vector rather than the running remainder.',
          fix: 'Switch to the modified variant, or to Householder, which is what every library uses.'
        },
        {
          symptom: 'A regression produces enormous coefficients that cancel to a reasonable prediction.',
          cause: 'Tiny singular values inverted into huge ones by an unregularised solve.',
          fix: 'Truncate below a threshold, or add ridge regularisation and choose λ by cross-validation.'
        },
        {
          symptom: 'A low-rank approximation appears to break the Eckart–Young bound.',
          cause: 'The error was measured in the Frobenius norm and compared with the spectral bound.',
          fix: 'Compare like with like: the Frobenius bound is the root of the sum of the squares of the dropped values.'
        },
        {
          symptom: 'Rank detection reports full rank on a matrix that is visibly degenerate.',
          cause: 'The default threshold is machine epsilon scaled, which is far below the noise in real data.',
          fix: 'Set the tolerance to the noise level, not to the floating-point resolution.'
        }
      ],
      inTheWild: [
        { system: 'NumPy’s `lstsq` and SciPy’s `lstsq`', how: 'both use the SVD (LAPACK `gelsd`) by default and return the singular values, so the rank decision is visible to the caller rather than hidden.' },
        { system: 'Principal component analysis', how: 'is the truncated SVD of the centred data matrix; "explained variance" is the squared singular values as a fraction of their total.' },
        { system: 'Latent semantic indexing and embedding compression', how: 'store the first k singular directions of a term-document or embedding matrix, which Eckart–Young says is the best possible choice at that size.' }
      ],
      sources: [
        { title: 'Numerical Linear Algebra, lectures 7-11 and 18-19', author: 'Trefethen and Bau', note: 'QR, least squares and the conditioning argument, with the Gram–Schmidt comparison worked out.' },
        { title: 'Matrix Computations, chapter 5', author: 'Golub and Van Loan', note: 'Householder and Givens in full detail, including the storage tricks real implementations use.' },
        { title: 'The approximation of one matrix by another of lower rank', author: 'Eckart and Young', note: 'The 1936 paper, and still the clearest statement of the theorem.' },
        { title: 'LAPACK Users’ Guide', author: 'Anderson et al.', note: 'Which driver routine implements which route, and what each one returns about rank.' }
      ]
    },

    'eigenvalues': {
      summary: 'Power iteration priced by the spectral gap, shifted inverse iteration reaching ' +
        'any named eigenvalue in a dozen steps, the QR algorithm driving the subdiagonal to zero ' +
        'by similarity, and the polynomial route that destroys the answer.',
      intuition: 'Power iteration’s convergence rate is the eigenvalue gap; when PageRank ' +
        'converges slowly, the graph structure is the reason and not the implementation.',
      formulation: {
        equations: [
          {
            label: 'The iterations',
            expr: 'multiply and normalise; shift and invert; factor and multiply back',
            terms: [
              { sym: 'power iteration', meaning: 'x := Ax / ‖Ax‖, converging at |λ₂/λ₁| per step' },
              { sym: 'shifted inverse', meaning: 'solve (A − σI)y = x, converging at a rate you choose through σ' },
              { sym: 'QR algorithm', meaning: 'A = QR then A := RQ, which is QᵀAQ and therefore a similarity' },
              { sym: 'Rayleigh quotient', meaning: 'xᵀAx / xᵀx, the best eigenvalue estimate from a given vector' }
            ]
          },
          {
            label: 'Power iteration against its prediction',
            expr: 'iterations ≈ log(tolerance) / log(gap), to a tolerance of 1e-10',
            terms: [
              { sym: 'gap 0.10', meaning: '16 measured against 10 predicted' },
              { sym: 'gap 0.50', meaning: '33 against 33' },
              { sym: 'gap 0.90', meaning: '195 against 219' },
              { sym: 'gap 0.99', meaning: '1 802 against 2 291 — the matrix size appears in neither column' }
            ]
          },
          {
            label: 'Shifted inverse iteration, reaching each eigenvalue of [10, 5, 2, 1]',
            expr: 'σ set 0.2 above each target',
            terms: [
              { sym: 'λ = 10', meaning: '10 iterations' },
              { sym: 'λ = 5', meaning: '12 iterations' },
              { sym: 'λ = 2', meaning: '15 iterations' },
              { sym: 'λ = 1', meaning: '24 iterations — the smallest eigenvalue, which power iteration cannot reach at all' }
            ]
          },
          {
            label: 'Wilkinson’s polynomial, one coefficient multiplied by 1 + 1e-10',
            expr: '(x − 1)(x − 2)…(x − n), and how far a root moves',
            terms: [
              { sym: 'n = 5', meaning: 'root shift 3.906e-8, amplification 3.9e2' },
              { sym: 'n = 10', meaning: '1.516e-5, amplification 1.5e5' },
              { sym: 'n = 15', meaning: '4.018e-3, amplification 4.0e7' },
              { sym: 'n = 20', meaning: '9.051e-1, amplification 9.1e9 — most of a whole unit on roots spaced one apart' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every QR step is a similarity transformation, so the eigenvalues never move',
          why: 'It is what makes the iteration safe: the shape improves while the answer is preserved exactly.',
          breaks: 'Any step that is not a similarity changes the spectrum, which is the one thing being sought.'
        },
        {
          name: 'Power iteration converges at |λ₂/λ₁| per step, independent of the matrix size',
          why: 'It is why the method scales to matrices too large to factor.',
          breaks: 'At a gap approaching 1 the count diverges, and no implementation change helps.'
        },
        {
          name: 'A starting vector that is exactly an eigenvector is a fixed point',
          why: 'The all-ones vector is an eigenvector of every constant-row-sum matrix, which is a common test case.',
          breaks: 'The iteration reports that eigenvalue however dominant the others are, and never escapes in exact arithmetic.'
        },
        {
          name: 'Shifted inverse iteration reaches the eigenvalue nearest σ, at a rate set by σ',
          why: 'It converts the gap from a property of the matrix into a parameter you control.',
          breaks: 'A σ too far from the target lands on a neighbouring eigenvalue instead.'
        }
      ],
      complexity: [
        { operation: 'power iteration', average: 'one matrix-vector product per step; 33 steps at a gap of 0.5', worst: '1 802 steps at a gap of 0.99, and unbounded as the gap approaches 1' },
        { operation: 'shifted inverse iteration', average: 'one factorisation, then one triangular solve pair per step; 10-24 steps', worst: 'the factorisation of (A − σI) is nearly singular by design, which is fine and looks alarming' },
        { operation: 'QR algorithm with Hessenberg reduction', average: 'O(n³) once for the reduction, then O(n²) per sweep', worst: 'cubic convergence per eigenvalue once shifts are added' },
        { operation: 'characteristic polynomial', average: 'cheap to form and worthless', worst: 'amplification of 9.1e9 at degree 20 — the answer is destroyed before any root finder runs' }
      ],
      failureModes: [
        {
          symptom: 'Power iteration returns the same eigenvalue whatever matrix it is given.',
          cause: 'The starting vector is an eigenvector — the all-ones vector on a constant-row-sum matrix.',
          fix: 'Start from a random or at least non-symmetric vector.'
        },
        {
          symptom: 'PageRank takes tens of thousands of iterations to converge.',
          cause: 'A small spectral gap: the graph has two nearly equally dominant modes.',
          fix: 'Lower the damping factor, which bounds the second eigenvalue by construction, or use a Krylov method.'
        },
        {
          symptom: 'Eigenvalues computed from a polynomial disagree with a library routine in the third digit.',
          cause: 'The route through the characteristic polynomial is catastrophically ill-conditioned.',
          fix: 'Call `eig`. There is no repair for the polynomial route.'
        },
        {
          symptom: 'Shifted inverse iteration converges to the wrong eigenvalue.',
          cause: 'The shift was closer to a neighbour than to the target.',
          fix: 'Refine the shift using the Rayleigh quotient of the current iterate, which converges cubically.'
        },
        {
          symptom: 'A symmetric matrix produces complex eigenvalues.',
          cause: 'A general solver was called on a matrix stored without enforcing symmetry, so rounding made it non-symmetric.',
          fix: 'Symmetrise explicitly and call the symmetric routine, which is faster and guarantees real output.'
        }
      ],
      inTheWild: [
        { system: 'PageRank', how: 'is power iteration on the web graph; the 0.85 damping factor exists to bound the second eigenvalue so the iteration count is knowable in advance.' },
        { system: 'LAPACK `dsyev` and `dgeev`', how: 'reduce to tridiagonal or Hessenberg form and then run implicitly shifted QR — the algorithm in this section, with fifty years of refinement on top.' },
        { system: 'ARPACK, behind `scipy.sparse.linalg.eigs`', how: 'uses implicitly restarted Arnoldi to get the few largest eigenvalues of a huge sparse matrix without ever forming a factorisation.' }
      ],
      sources: [
        { title: 'The Algebraic Eigenvalue Problem', author: 'J. H. Wilkinson', note: 'The book, and the source of the polynomial that carries his name.' },
        { title: 'Numerical Linear Algebra, lectures 24-30', author: 'Trefethen and Bau', note: 'Power iteration through to the shifted QR algorithm, derived rather than asserted.' },
        { title: 'The PageRank citation ranking: bringing order to the web', author: 'Page, Brin, Motwani and Winograd', note: 'Power iteration applied at web scale, with the damping factor introduced for exactly the reason above.' },
        { title: 'Templates for the Solution of Algebraic Eigenvalue Problems', author: 'Bai, Demmel, Dongarra, Ruhe and van der Vorst', note: 'A practical guide to choosing a method from the structure of the matrix.' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
