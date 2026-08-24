/** Worked examples for public keys, signatures and protocols (M23.7-M23.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'public-key-cryptography': [
      {
        title: 'The same attacker at four key sizes',
        goal: 'Show that the parameter, not the protocol, is what the eavesdropper is fighting.',
        setup: 'Diffie–Hellman with generator 5, private exponents fixed at 61% and 37% of the ' +
          'modulus, and a brute-force discrete log capped at 2 000 000 steps.',
        steps: [
          { do: 'Run the exchange at modulus 7 919 and let the eavesdropper search.',
            why: 'At 13 bits the group is small enough that a naive loop finishes immediately.',
            work: '872 steps, secret recovered' },
          { do: 'Move to modulus 104 729.',
            why: 'Four more bits, and the cost should rise roughly with the group size.',
            work: '11 521 steps — about 13× the previous row for 16× the group' },
          { do: 'Move to modulus 1 299 709.',
            why: 'The trend is what matters, not any single number.',
            work: '142 969 steps, secret recovered' },
          { do: 'Move to modulus 2 147 483 647.',
            why: 'At 31 bits the same code runs out of budget, which is the whole demonstration.',
            work: 'over 2 000 000 steps, not recovered' },
          { do: 'Confirm the recovered exponent is enough even when it is not the real one.',
            why: 'Any solution to the discrete log yields the shared secret, which is why the ' +
              'search is cheaper than it looks.',
            work: 'B raised to the found exponent gives the same shared secret, in 1 step' }
        ],
        answer: 'One protocol, one attacker, one piece of code: 872 steps at 13 bits and a ' +
          'failure at 31. Real parameters are chosen so the best KNOWN search is out of reach, ' +
          'which is why recommended sizes rise without any protocol changing.'
      },
      {
        title: 'The case that inverts it: no search needed, one query is enough',
        goal: 'Break textbook RSA with a chosen-ciphertext malleability attack.',
        setup: 'RSA with p = 1 061, q = 1 553 and e = 17, giving n = 1 647 733. A ciphertext the ' +
          'attacker may not submit, and an oracle that decrypts anything else.',
        steps: [
          { do: 'Encrypt the message and note the ciphertext the attacker is refused.',
            why: 'The attack works precisely because the attacker never submits this value.',
            work: 'm = 42 → c = 42^17 mod 1 647 733 = 1 074 770' },
          { do: 'Blind it with a factor of the attacker’s choosing.',
            why: 'RSA is multiplicative, so multiplying by s^e multiplies the plaintext by s.',
            work: 's = 3 → c′ = c · 3^17 mod n = 1 008 078' },
          { do: 'Submit the blinded ciphertext to the oracle.',
            why: 'It is a different value, so any "do not decrypt c" rule lets it through.',
            work: 'oracle returns 126' },
          { do: 'Divide the answer by the blinding factor.',
            why: 'The homomorphism means the answer is the plaintext times s.',
            work: '126 · 3^-1 mod n = 42' },
          { do: 'Note the alternative at this key size.',
            why: 'Below a few hundred bits the modulus simply factors.',
            work: 'trial division: 1 060 steps → 1 061 × 1 553' }
        ],
        answer: 'One oracle query recovers the plaintext 42, and at 21 bits trial division ' +
          'recovers the private key in 1 060 divisions. OAEP removes the first attack; only key ' +
          'size removes the second.'
      }
    ],

    'signatures-and-pki': [
      {
        title: 'Recovering an ECDSA private key from two signatures',
        goal: 'Run the arithmetic that cost Sony and several Bitcoin wallets their keys.',
        setup: 'A curve of prime order 3 359, a private key d = 1 234, and two messages signed ' +
          'with the same nonce k = 777.',
        steps: [
          { do: 'Notice the shared r in both signatures.',
            why: 'r is the x coordinate of k·G, so equal r means equal k — and it is public.',
            work: 'r1 = 1 854, r2 = 1 854' },
          { do: 'Write both signature equations.',
            why: 'Two equations, two unknowns (k and d), and everything else is public.',
            work: 's1 = 414, s2 = 2 957, with s = k^-1(z + r·d) mod 3 359' },
          { do: 'Subtract them to eliminate d and solve for k.',
            why: 'The d terms cancel because r is the same in both.',
            work: 'k = (z1 − z2) · (s1 − s2)^-1 mod 3 359 = 777' },
          { do: 'Substitute k back into either equation and solve for d.',
            why: 'With k known, one equation has one unknown.',
            work: 'd = (s1 · k − z1) · r^-1 mod 3 359 = 1 234' },
          { do: 'Compare with the real key and count the operations.',
            why: 'The claim is that the whole attack is four modular operations.',
            work: 'recovered 1 234, actual 1 234 — 2 subtractions and 2 inverses' }
        ],
        answer: 'Two subtractions and two modular inverses recover the private key exactly. No ' +
          'weakness in the curve, no side channel and no access to the signer is needed — only ' +
          'two public signatures.'
      },
      {
        title: 'The case that inverts it: five chains, four broken one way each',
        goal: 'Show that certificate validation is a list where every item has been skipped.',
        setup: 'A root CA, an issuing CA and a leaf for shop.example.com, validated at 2026 ' +
          'against a real validator.',
        steps: [
          { do: 'Validate the well-formed chain.',
            why: 'The baseline says how many checks the validator actually applies.',
            work: '9 checks, 9 passed, chain accepted' },
          { do: 'Move the leaf’s validity window to 2019–2021 and revalidate.',
            why: 'Expiry is the check people assume is the only one.',
            work: '1 check fails: the validity window for shop.example.com' },
          { do: 'Ask for bank.example.com against the same leaf.',
            why: 'A perfectly valid certificate for the wrong name is still wrong.',
            work: '1 check fails: the host-name match' },
          { do: 'Edit the leaf’s names after it was signed.',
            why: 'Tampering breaks the signature, and the name check as well.',
            work: '2 checks fail: the signature on the leaf, and the host-name match' },
          { do: 'Use an ordinary site certificate to issue another certificate.',
            why: 'This is what basic constraints exists to stop.',
            work: '14 checks applied, 2 fail: basic constraints and key usage on the issuer' }
        ],
        answer: 'Each broken chain fails on exactly the check that names its flaw, while every ' +
          'other check still passes. That is why a validator that omits one item sees nothing ' +
          'wrong — and why the leaf-signs-leaf case needed a dedicated check.'
      }
    ],

    'protocol-construction': [
      {
        title: 'Measuring the blast radius of one stolen session state',
        goal: 'Separate forward secrecy from post-compromise security by counting messages.',
        setup: 'A ten-message session. The attacker steals the state at message 3, and the ' +
          'conversation changes direction at message 6.',
        steps: [
          { do: 'Count the messages before the theft and check what the attacker can derive.',
            why: 'The chain key is replaced by a hash of itself after each message.',
            work: '3 messages before the theft, 0 of them derivable' },
          { do: 'Count the messages the attacker reads from the theft onward.',
            why: 'Deriving forward is exactly what the legitimate party does.',
            work: 'messages 3, 4 and 5 readable — 3 messages' },
          { do: 'Identify what changes at message 6.',
            why: 'The DH ratchet mixes fresh key-exchange output into the root key.',
            work: 'ratchets so far goes from 0 to 1 at message 6' },
          { do: 'Check the attacker’s access after that point.',
            why: 'The new root depends on material the attacker never observed.',
            work: 'messages 6 through 9: not readable — 4 messages' },
          { do: 'Note who performed the recovery.',
            why: 'Nobody detected the compromise and nobody rotated a key.',
            work: '0 repair actions; the ratchet turns on direction change anyway' }
        ],
        answer: 'The stolen state opens exactly 3 of 10 messages: none before the theft, because ' +
          'the chain runs one way, and none after the ratchet, because the root changed. The ' +
          'two bounds come from two different mechanisms.'
      },
      {
        title: 'The case that inverts it: the bookkeeping is the hard part',
        goal: 'Show that both sides must derive matching keys from different state on every turn.',
        setup: 'An eight-message conversation with realistic bursts: Alice twice, Bob, Alice, ' +
          'Bob twice, Alice, Bob.',
        steps: [
          { do: 'Count the direction changes in the script.',
            why: 'Each one triggers a DH ratchet on both sides.',
            work: '5 direction changes across 8 messages' },
          { do: 'Count the total ratchet steps recorded across both parties.',
            why: 'Each change advances both the sender and the receiver.',
            work: '10 ratchet steps' },
          { do: 'Check that every message decrypted at the other end.',
            why: 'This is the property an implementation lives or dies on.',
            work: '8 of 8 messages with matching keys' },
          { do: 'Price the derivation itself.',
            why: 'The cryptography is cheap; the state machine is not.',
            work: '1 hash per message, 1 key exchange per turn' },
          { do: 'Name what the demo does not model.',
            why: 'Out-of-order delivery and crossed messages are where real implementations get ' +
              'hard.',
            work: 'skipped-key storage, message-number windows, and 0 of those are exercised here' }
        ],
        answer: 'Eight messages, five direction changes and ten ratchet steps, with every message ' +
          'decrypting. The arithmetic is one hash and one exchange; the bookkeeping to keep two ' +
          'independent state machines agreeing is most of a real implementation.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
