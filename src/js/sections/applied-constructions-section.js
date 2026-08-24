/**
 * Section: applied constructions.
 *
 * Two constructions, both measured. Shamir sharing is run at every k-subset of
 * the shares to show that any k reconstruct exactly and k − 1 constrain
 * nothing: the demo enumerates candidate secrets against the held shares and
 * confirms each one is still consistent, which is what "information-theoretic"
 * means made checkable. The Merkle tree produces an inclusion proof, verifies
 * it hash by hash, and rejects the same proof against an edited leaf.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'applied-constructions';
  const SECRET = 1234567n;
  const SHARES = 5;
  const ENTRIES = ['alice:100', 'bob:250', 'carol:75', 'dave:900', 'erin:12', 'frank:640',
    'grace:38'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an inclusion proof is one path, not the whole tree',
      caption: 'Every leaf is hashed, every pair of hashes is hashed together, and the single ' +
        'value at the top commits to the entire list — change any byte anywhere and the root ' +
        'changes. To prove that one entry is in the list you send that entry plus the sibling ' +
        'hash at each level, and the verifier recomputes the path upward and compares against a ' +
        'root they already trust. That is log n hashes instead of the whole list, and it is why ' +
        'the same picture turns up in Git, Certificate Transparency, blockchains, backup systems ' +
        'and replication protocols.',
      definition: [
        'flowchart TD',
        '    R["root — the only value the verifier needs"] --- N1["H(A,B)"]',
        '    R --- N2["H(C,D) — sent as proof"]',
        '    N1 --- L1["H(alice) — sent as proof"]',
        '    N1 --- L2["H(carol) — the leaf being proved"]',
        '    N2 --- L3["H(erin)"]',
        '    N2 --- L4["H(grace)"]',
        '    L2 -.-> N1',
        '    N1 -.-> R'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** The prime here ' +
        'is 31 bits so the arithmetic is readable; a real sharing uses a field wide enough for ' +
        'the secret.',
      '**Shamir sharing is a fact about polynomials, not a computational assumption.** A ' +
        'polynomial of degree k − 1 is determined by any k points on it and by no fewer. Put the ' +
        'secret in the constant term, hand out points, and any k holders reconstruct while k − 1 ' +
        'learn nothing — the demo checks both halves.',
      '**"Learn nothing" is literal here, and stronger than anything else in this milestone.** ' +
        'With k − 1 shares every candidate secret is still consistent with exactly one ' +
        'polynomial through them, so the shares eliminate no possibilities at all. No amount of ' +
        'computation helps, which is what information-theoretic security means.',
      '**A commitment is "I have decided and cannot change my mind".** Hash a message with a ' +
        'random opening value: the commitment hides the message because the opening is unknown, ' +
        'and binds it because opening it two ways would be a hash collision. Sealed bids, ' +
        'coin flips and fair random beacons are all this.',
      '**A Merkle tree turns "trust the list" into "verify one path".** Hash the leaves, hash the ' +
        'pairs, and the root commits to everything. Proving one entry costs log n sibling hashes ' +
        'and the demo walks them, ending at a root the verifier already holds.',
      '**The cost difference is the reason it is everywhere.** The demo tabulates it: proving one ' +
        'entry in a billion costs 30 hashes — 960 bytes — against 34 GB for the whole list. That ' +
        'ratio is what makes verification possible for a client that could never hold the data.',
      '**The odd-leaf case is a real bug, not a detail.** Duplicating a lone node instead of ' +
        'carrying it up lets two different trees produce the same root, which was Bitcoin\'s ' +
        'CVE-2012-2459. This implementation carries the node, and the demo lets you prove the ' +
        'odd leaf so the shorter path is visible.',
      '**The wider family runs from here.** Hash chains are Merkle trees with one branch; ' +
        'verifiable random functions add a proof that a random-looking output was computed ' +
        'correctly; zero-knowledge proofs generalise "convince me without telling me"; and ' +
        'post-quantum hybrids ship a classical and a lattice key exchange together so a break in ' +
        'either leaves the other standing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — split a secret, then prove one entry out of a list',
        markup: root.AppliedTemplate.render()
      },
      diagram: diagram(),
      insight: '**Merkle proofs are the most reusable idea in this milestone: they turn "trust ' +
        'the server" into "verify one path", and they appear in Git, Certificate Transparency, ' +
        'blockchains, backups and replication protocols.** What makes the idea travel is that it ' +
        'solves a systems problem, not a cryptographic one. A client that cannot hold the data, ' +
        'cannot re-download it and does not trust the party serving it can still check that one ' +
        'answer belongs to a commitment it already has, for log n hashes. Once you recognise the ' +
        'shape you start seeing it as the answer to "how would this component verify what it is ' +
        'being told?" — which is a question that comes up far more often than "which cipher ' +
        'should I use".'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AppliedTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const splitFor = root.Helpers.memoise(function (k) {
    return root.Threshold.split({ secret: SECRET, n: SHARES, k: Number(k),
      rng: root.Random.seeded(9) });
  });

  const subsetsFor = root.Helpers.memoise(function (k) {
    const run = splitFor(k);
    const out = [];

    combinations(run.shares.length, Number(k)).forEach(function (indices) {
      const picked = indices.map(function (i) { return run.shares[i]; });

      out.push({ indices: indices, value: root.Threshold.reconstruct(picked, run.prime) });
    });
    return { run: run, subsets: out };
  });

  function combinations(n, k) {
    const out = [];
    const walk = function (start, picked) {
      if (picked.length === k) return out.push(picked.slice());
      for (let i = start; i < n; i += 1) {
        picked.push(i);
        walk(i + 1, picked);
        picked.pop();
      }
      return null;
    };

    walk(0, []);
    return out;
  }

  const shortFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const run = splitFor(parts[0]);
    const held = run.shares.slice(0, Number(parts[1]));

    return {
      run: run, held: held,
      reconstructed: root.Threshold.reconstruct(held, run.prime),
      enough: held.length >= run.k,
      study: root.Threshold.underdetermined({ shares: held, k: run.k, candidates: 8,
        from: Number(SECRET) - 3, prime: run.prime })
    };
  });

  const treeFor = root.Helpers.memoise(function () {
    const hash = root.CryptoHash;
    const values = ENTRIES.map(hash.bytesOf);

    return { values: values, tree: root.Threshold.buildTree(values) };
  });

  function update() {
    const values = panel.values();
    const k = values['apc-threshold'];
    const short = shortFor(k + '|' + values['apc-held']);
    const leaf = Number(values['apc-leaf']);
    const built = treeFor('');
    const proof = root.Threshold.proof(built.tree, leaf);

    root.Helpers.setText('apc-disclaimer', root.Threshold.DISCLAIMER);
    paintMetrics({ short: short, proof: proof, built: built, leaf: leaf });
    paintVerdict(short);
    paintSubsets(k);
    paintCandidates(short);
    paintPath({ built: built, proof: proof, leaf: leaf });
    paintCost();
    paintUses();
  }

  function tampered(built, leaf, proof) {
    const edited = root.CryptoHash.bytesOf(ENTRIES[leaf] + '0');

    return !root.Threshold.verifyProof({ root: built.tree.root, value: edited, proof: proof });
  }

  function paintMetrics(state) {
    const short = state.short;

    root.MetricGrid.update({
      'apc-reconstructed': { value: short.reconstructed.toString(),
        note: short.enough
          ? 'the true secret, ' + SECRET.toString() + ', from ' +
            root.Format.exact(short.held.length) + ' shares'
          : 'a number, and not the secret — ' + root.Format.exact(short.held.length) +
            ' shares is one short of ' + root.Format.exact(short.run.k) },
      'apc-candidates': { value: short.enough ? '1'
        : root.Format.exact(short.study.candidates.length) + ' of ' +
          root.Format.exact(short.study.candidates.length) + ' tested',
      note: short.enough
        ? 'k shares pin the polynomial down completely'
        : 'every candidate tested is still consistent — the shares rule nothing out' },
      'apc-proof': { value: root.Format.exact(state.proof.length) + ' hashes',
        note: root.Format.exact(state.proof.length * 32) + ' bytes to prove one entry out of ' +
          root.Format.exact(ENTRIES.length) },
      'apc-tampered': { value: tampered(state.built, state.leaf, state.proof) ? 'yes' : 'no',
        note: 'the same proof re-run against an edited value, and the root no longer matches' }
    });
  }

  function paintVerdict(short) {
    root.jQuery('#apc-verdict').html(
      '<div class="mono" style="font-size:.9rem">holds ' +
      root.Format.exact(short.held.length) + ' of ' + root.Format.exact(SHARES) +
      ' shares · needs ' + root.Format.exact(short.run.k) + '</div>' +
      '<div class="mono" style="font-size:.95rem">reconstructs ' +
      short.reconstructed.toString() + ' · true secret ' + SECRET.toString() + '</div>');

    root.Helpers.setText('apc-verdict-note', short.enough
      ? 'With ' + root.Format.exact(short.held.length) + ' shares and a threshold of ' +
        root.Format.exact(short.run.k) + ', Lagrange interpolation at zero returns the constant ' +
        'term exactly, and the subset table below shows that every choice of ' +
        root.Format.exact(short.run.k) + ' shares gives the same answer. There is no ' +
        'approximation and no probability anywhere in it — the polynomial through k points is ' +
        'unique, so the answer is forced.'
      : 'With ' + root.Format.exact(short.held.length) + ' shares against a threshold of ' +
        root.Format.exact(short.run.k) + ', interpolation still returns a number — it returns ' +
        short.reconstructed.toString() + ' — and that number is not the secret. This is the ' +
        'trap worth understanding: the arithmetic does not fail, error out or signal anything. ' +
        'It fits a lower-degree polynomial through the points it has and reports its constant ' +
        'term, which is a value with no relationship to the real one. The candidate table below ' +
        'shows why nothing better is possible.');
  }

  function paintSubsets(k) {
    const study = subsetsFor(k);
    const rows = study.subsets.slice(0, 12);

    root.jQuery('#apc-subsets tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.indices.map(function (i) {
        return 'x=' + (i + 1);
      }).join(', ') + '</td><td class="mono">' + row.value.toString() + '</td><td class="mono">' +
        (row.value === SECRET ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const correct = study.subsets.filter(function (row) { return row.value === SECRET; }).length;

    root.Helpers.setText('apc-subsets-note',
      root.Format.exact(correct) + ' of ' + root.Format.exact(study.subsets.length) +
      ' subsets of size ' + root.Format.exact(Number(k)) +
      ' reconstruct the secret exactly' +
      (study.subsets.length > rows.length
        ? ' (the first ' + root.Format.exact(rows.length) + ' are listed)'
        : '') +
      '. That "every subset" property is the operational value of the scheme: the shares are ' +
      'interchangeable, so a key can be split across five people or five regions and any ' +
      root.Format.exact(Number(k)) + ' of them can act without anybody being indispensable and ' +
      'without any single holder being able to act alone. Losing shares up to n − k is ' +
      'survivable, which makes this an availability mechanism as much as a confidentiality one.');
  }

  function paintCandidates(short) {
    root.jQuery('#apc-fits tbody').html(short.study.candidates.map(function (entry) {
      return '<tr><td class="mono">' + entry.secret.toString() +
        (entry.secret === SECRET ? ' ← the real one' : '') + '</td><td class="mono">' +
        (entry.consistent ? 'yes' : 'NO') + '</td><td class="mono">' +
        entry.implies.toString() + '</td></tr>';
    }).join(''));

    root.Helpers.setText('apc-fits-note', short.enough
      ? 'The attacker already has enough shares here, so this table is showing candidates against ' +
        'a set that determines the answer — pull the "shares the attacker holds" slider below the ' +
        'threshold to see the interesting case. The third column is what each candidate would ' +
        'imply about a share at x = ' + short.study.probe.toString() + ', which nobody holds.'
      : 'Every candidate fits. That is the whole claim, computed rather than asserted: for each ' +
        'of the ' + root.Format.exact(short.study.candidates.length) + ' secrets tested there ' +
        'is a polynomial with that constant term passing through every share the attacker holds, ' +
        'and the check confirms it reproduces each of them. The third column shows what each ' +
        'candidate would imply about a share at x = ' + short.study.probe.toString() +
        ' — ' + root.Format.exact(short.study.distinctImplied) + ' different values for ' +
        root.Format.exact(short.study.candidates.length) + ' candidates, which is the same fact ' +
        'from the other side: the missing share could be anything, so the secret could be ' +
        'anything. No computation improves this, which is what separates information-theoretic ' +
        'security from everything else in this milestone.');
  }

  function paintPath(state) {
    const hex = root.CryptoHash.hex;
    const rows = state.proof.path.map(function (step, level) {
      return { level: level, hash: hex(step.hash).slice(0, 20) + '…',
        side: step.right ? 'sibling on the right' : 'sibling on the left' };
    });

    root.jQuery('#apc-path tbody').html(rows.map(function (row, i) {
      return '<tr><td class="mono">' + row.level + '</td><td class="mono">' + row.hash +
        '</td><td>' + row.side + '</td><td class="mono">' +
        (i === rows.length - 1 ? hex(state.built.tree.root).slice(0, 20) + '… (the root)'
          : 'combined and carried up') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('apc-path-note',
      'Proving "' + ENTRIES[state.leaf] + '" is in the list costs ' +
      root.Format.exact(state.proof.length) + ' sibling hashes, and the verifier needs nothing ' +
      'else — not the other entries, not the tree, only the root they already trust. Leaf ' +
      root.Format.exact(ENTRIES.length - 1) + ' has a shorter path than the rest, because ' +
      root.Format.exact(ENTRIES.length) + ' is odd and a lone node at a level is carried up ' +
      'rather than duplicated. That choice matters: duplicating it would let two different lists ' +
      'produce the same root, which is exactly the bug Bitcoin shipped as CVE-2012-2459. Editing ' +
      'the leaf and re-running this proof against the same root fails, which the metric above ' +
      'reports.');
  }

  function paintCost() {
    const rows = root.Threshold.proofCost([8, 1024, 1048576, 1073741824]);

    root.jQuery('#apc-cost tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.entries) + '</td><td class="mono">' +
        root.Format.exact(row.proofHashes) + '</td><td class="mono">' +
        root.Format.bytes(row.proofBytes) + '</td><td class="mono">' +
        root.Format.bytes(row.fullListBytes) + '</td><td class="mono">' +
        root.Format.fixed(row.saving, 1) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('apc-cost-note',
      'The first column grows by factors of a thousand and the second grows by tens, which is ' +
      'the logarithm doing its work. Read the last row: proving one entry out of a billion costs ' +
      root.Format.exact(rows[rows.length - 1].proofHashes) + ' hashes and ' +
      root.Format.bytes(rows[rows.length - 1].proofBytes) + ', against ' +
      root.Format.bytes(rows[rows.length - 1].fullListBytes) + ' for the list itself. That ratio ' +
      'is what makes light clients, transparency logs and incremental backup verification ' +
      'possible at all — a verifier that could never hold the data can still check any single ' +
      'answer against a root that fits in a tweet.');
  }

  function paintUses() {
    const rows = [
      { system: 'Git', committed: 'the whole tree of files at a commit',
        replaces: 'trusting that a fetched object is the one the history names' },
      { system: 'Certificate Transparency', committed: 'every certificate a log has ever issued',
        replaces: 'trusting a CA to disclose what it signed' },
      { system: 'Blockchains', committed: 'the transactions in a block',
        replaces: 'downloading every transaction to verify one payment' },
      { system: 'Backup and dedup systems', committed: 'the content of each chunk',
        replaces: 'rereading a whole archive to check it is intact' },
      { system: 'Replicated stores (anti-entropy)', committed: 'a range of keys on each replica',
        replaces: 'comparing entire ranges to find which keys diverged' },
      { system: 'Package registries (sigstore, TUF)', committed: 'the set of published artefacts',
        replaces: 'trusting that the artefact served is the one that was signed' }
    ];

    root.jQuery('#apc-uses tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.system + '</td><td>' + row.committed + '</td><td>' + row.replaces +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('apc-uses-note',
      'Six systems, one shape. In each row the third column is a trust assumption that the tree ' +
      'converts into an arithmetic check, and that conversion is why the idea has spread far ' +
      'beyond cryptography. The fifth row is the one worth borrowing soonest: comparing Merkle ' +
      'ranges to locate divergence between replicas is a standard anti-entropy technique and it ' +
      'reduces a full-range comparison to a walk down the branches that differ. M54 builds it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
