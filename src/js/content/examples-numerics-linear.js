/** Worked examples for least squares, QR, the SVD and eigenvalues (M18.4-M18.5). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'least-squares': [
      {
        title: 'Watching the normal equations square the conditioning',
        goal: 'Confirm that κ(AᵀA) = κ(A)² exactly rather than approximately, and find the degree ' +
          'at which the squared formulation stops producing usable answers.',
        setup: 'Fitting eˣ by polynomials of rising degree at 25 equally spaced points on [0, 1], ' +
          'solved once by QR and once by the normal equations.',
        steps: [
          {
            do: 'Read the two condition numbers at a low degree and take the ratio.',
            why: 'To establish that the relationship is exact before relying on it.',
            work: 'at degree 4: κ(A) = 6.05e2, κ(AᵀA) = 3.66e5, and the ratio to κ(A)² is 1.000',
            result: 'the squaring is exact, not approximate'
          },
          {
            do: 'Apply the digit budget to each formulation at degree 10.',
            why: 'The budget from 18.1 says how many digits each has left.',
            work: 'κ(A) = 2.15e7 loses 7 digits of 16; κ(AᵀA) = 4.63e14 loses 15 of 16',
            result: 'nine digits available through QR, one through the normal equations'
          },
          {
            do: 'Compare the two residuals at that degree.',
            why: 'The prediction should be visible in the answers.',
            work: 'QR gives 6.92e-15 and the normal equations give 1.31e-10',
            result: 'the two agreed to every digit up to degree 8 and part company here'
          },
          {
            do: 'Push to degree 14 and watch the reported condition number stop growing.',
            why: 'The measurement itself has a limit, and knowing where it is prevents a wrong conclusion.',
            work: 'κ(A) = 3.63e10 while κ(AᵀA) reads 4.76e17 — the same as at degree 12, not 1.3e21',
            result: 'the Gram matrix’s smallest singular value has dropped below what a double can resolve'
          },
          {
            do: 'Check that the QR residual is still falling while the other climbs.',
            why: 'To confirm the problem is the formulation rather than the fit.',
            work: 'QR: 1.36e-11 → 6.92e-15 → 2.90e-16 → 3.77e-16; normal equations: 1.38e-11 → 1.31e-10 → 2.64e-9 → 2.28e-8',
            result: 'one column improves monotonically and the other turns around at degree 10'
          }
        ],
        answer: 'The ratio column sits at 1.000 for every degree where κ(AᵀA) is measurable, so ' +
          'the squaring is exact. The consequence is a fit that works to degree 8 and then quietly ' +
          'degrades: the QR residual keeps falling to 3.77e-16 while the normal-equations residual ' +
          'climbs to 2.28e-8, on the same data with the same mathematics. Past degree 12 the ' +
          'reported κ(AᵀA) stops rising, which is not the problem improving — it is the ' +
          'measurement hitting its own floor, because the Gram matrix is now indistinguishable ' +
          'from singular.'
      },
      {
        title: 'Three QR factorisations, and one line of difference between the first two',
        goal: 'Measure how far each computed Q is from orthogonal, and locate the exact change ' +
          'that buys eight orders of magnitude.',
        setup: 'A degree-9 Vandermonde matrix at 12 nodes, condition number 6.84e6, factored three ' +
          'ways, with the loss measured as ‖QᵀQ − I‖.',
        steps: [
          {
            do: 'Write down what the two Gram–Schmidt variants differ by.',
            why: 'The difference is one operand, and everything else about them is identical.',
            work: 'for column 3 of 10, classical subtracts the 2 projections of the ORIGINAL vector; modified subtracts each of the 2 from the running remainder',
            result: 'the same subtractions in a different order, which cannot matter in exact arithmetic'
          },
          {
            do: 'Measure the classical version.',
            why: 'It is the one written in most textbooks.',
            work: '‖QᵀQ − I‖ = 1.023e-1',
            result: 'a Q that is not orthogonal to one decimal place'
          },
          {
            do: 'Measure the modified version.',
            why: 'To price the reordering.',
            work: '2.164e-10, which is 4.7e8 times better',
            result: 'eight orders of magnitude for one operand'
          },
          {
            do: 'Measure Householder.',
            why: 'It obtains orthogonality structurally rather than by cancellation.',
            work: '2.337e-15, another 9.3e4 beyond modified Gram–Schmidt',
            result: 'orthogonal to machine precision on a matrix conditioned at 6.84e6'
          },
          {
            do: 'Explain Householder’s result from its form rather than its arithmetic.',
            why: 'That is the transferable idea.',
            work: 'H = I − 2vvᵀ/(vᵀv) is exactly orthogonal for ANY v, so rounding v does not cost orthogonality',
            result: 'the property is structural, so the arithmetic cannot lose it'
          }
        ],
        answer: 'Classical Gram–Schmidt is 4.4e13 times further from orthogonal than Householder ' +
          'on the same matrix, and the first factor of 4.7e8 comes from changing which vector each ' +
          'projection is subtracted from. The general lesson is the one Householder makes: when a ' +
          'computed object must have a property, prefer a construction that has it by form over ' +
          'one that reaches it by cancellation. Orthogonality of a reflection does not depend on ' +
          'the accuracy of the vector defining it, so no amount of rounding can take it away.'
      }
    ],

    'eigenvalues': [
      {
        title: 'Predicting the iteration count from the spectral gap alone',
        goal: 'Derive how long power iteration will take before running it, then check the ' +
          'prediction — and notice which quantity is missing from the formula.',
        setup: 'Symmetric matrices built to the spectrum [10, 10g, 2, 1] for a gap g, with power ' +
          'iteration run to a residual tolerance of 1e-10.',
        steps: [
          {
            do: 'Write down what one pass does to the unwanted components.',
            why: 'The convergence rate is the whole content of the method.',
            work: 'each pass scales the second direction by λ₂ = 10g and the first by λ₁ = 10, so their ratio shrinks by g each time',
            result: 'the error is multiplied by g per pass'
          },
          {
            do: 'Solve for the number of passes to reach the tolerance.',
            why: 'A geometric decay gives a closed form.',
            work: 'g^k = 1e-10, so k = log(1e-10)/log(g)',
            result: 'at g = 0.5 that is 33 passes; at g = 0.99 it is 2 291'
          },
          {
            do: 'Run it and compare.',
            why: 'A prediction unchecked is a hope.',
            work: 'measured: 33 at g = 0.5, 195 at g = 0.9 against a predicted 219, 1 802 at g = 0.99 against 2 291',
            result: 'the measurement tracks the prediction and runs slightly under it'
          },
          {
            do: 'Account for the gap between prediction and measurement.',
            why: 'A discrepancy the same direction on every row has a cause worth naming.',
            work: 'at g = 0.9 the measurement is 195 against 219 predicted: the starting vector already has a component along the dominant direction, so it does not have to earn the whole ratio',
            result: 'the prediction is an upper estimate, and the growth rate is what matters'
          },
          {
            do: 'Look for the matrix size in either column.',
            why: 'This is the property that makes the method scale.',
            work: 'n appears nowhere: the same 33 passes at a gap of 0.5 hold for a four-by-four and a million-by-million matrix',
            result: 'each pass costs more at scale, but the count does not change'
          }
        ],
        answer: 'The count is log(tolerance)/log(gap) and the measurement confirms it: 33 passes ' +
          'at a gap of 0.5 and 1 802 at 0.99. The matrix size is absent from the formula, which is ' +
          'why power iteration works on matrices too large to factor and why it underlies PageRank. ' +
          'It is also why a slow PageRank is a statement about the graph — a near-tie between the ' +
          'top two eigenvalues means two nearly equally dominant modes, and no implementation ' +
          'change fixes that. Damping at 0.85 rather than 0.99 is exactly this lever being pulled ' +
          'deliberately.'
      },
      {
        title: 'Why the definition is not the algorithm, priced at four degrees',
        goal: 'Perturb one coefficient of a polynomial whose roots are the integers 1 to 20 and ' +
          'measure how far a root moves, at four sizes.',
        setup: 'The Wilkinson polynomial (x − 1)(x − 2)…(x − n), with the coefficient of xⁿ⁻¹ ' +
          'multiplied by 1 + 1e-10.',
        steps: [
          {
            do: 'Note how benign the roots look before touching anything.',
            why: 'The surprise is the point of the example.',
            work: 'the roots are 1, 2, 3, … n — evenly spaced, well separated, no repeats',
            result: 'nothing about the roots suggests sensitivity'
          },
          {
            do: 'Size the perturbation against the rounding that storing the coefficient already caused.',
            why: 'To establish that this is smaller than an unavoidable error.',
            work: 'at n = 20 the coefficient of x¹⁹ is −210, and 1e-10 of it is 2.1e-8; a double stores it to about 2e-14',
            result: 'the perturbation is larger than a single rounding but still in the eleventh digit'
          },
          {
            do: 'Measure the root movement at n = 5, n = 10 and n = 15.',
            why: 'To find the growth rate rather than a single number.',
            work: '3.906e-8 at n = 5, 1.516e-5 at n = 10, and 4.018e-3 at n = 15',
            result: 'roughly a factor of 300 for each five degrees'
          },
          {
            do: 'Measure at n = 20.',
            why: 'This is the case Wilkinson wrote about.',
            work: '9.051e-1 — most of a whole unit, on roots spaced one apart',
            result: 'an amplification of 9.1e9 relative to the perturbation'
          },
          {
            do: 'Contrast with computing the eigenvalues of a symmetric matrix directly.',
            why: 'To locate the fault in the route rather than the destination.',
            work: 'the demo’s QR algorithm recovers a spectrum spanning 1 to 10 in 37 sweeps at machine precision',
            result: 'the eigenvalues are well conditioned; the polynomial’s roots are not'
          }
        ],
        answer: 'A perturbation in the eleventh significant digit moves a root by 9.051e-1, an ' +
          'amplification of 9.1e9, on a polynomial whose roots are the integers. Wilkinson called ' +
          'this the most traumatic experience of his career as a numerical analyst, and it is why ' +
          'the characteristic polynomial appears in the definition of an eigenvalue and in no ' +
          'implementation of one. The transferable form is broader than eigenvalues: whenever you ' +
          'transform a problem into an equivalent one because the equivalent has a nicer closed ' +
          'form, ask what that transformation did to the conditioning — "algebraically identical" ' +
          'is a statement about exact arithmetic.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
