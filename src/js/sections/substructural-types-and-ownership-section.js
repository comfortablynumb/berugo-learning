/**
 * Section: Substructural types and ownership.
 *
 * The measurement is the discipline matrix. Twelve programs against four
 * disciplines, and the columns separate exactly where the theory says they
 * should: `leak` — a resource created and never consumed — is accepted by
 * unrestricted and affine and rejected by relevant and linear, which is
 * weakening. `useTwice` is accepted by unrestricted and relevant and rejected
 * by affine and linear, which is contraction. Nothing else moves.
 *
 * The second is that borrowing is orthogonal. Reading through a borrow does
 * not spend the owner's single use, which is why `sharedTwice` — two shared
 * borrows and a drop — is accepted even under the linear discipline. That is
 * the whole reason borrowing exists.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'substructural-types-and-ownership';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  const READS = { make: 'create an owned resource', move: 'transfer ownership',
    use: 'read', mutate: 'write', drop: 'consume and release',
    share: 'take a shared borrow', borrow: 'take a mutable borrow',
    release: 'the borrow goes out of scope' };

  function diagram() {
    return {
      title: 'Diagram — ownership transfer and borrow scopes over a timeline',
      caption: 'Ownership is a property that moves. At any moment exactly one name owns the ' +
        'resource, and a move transfers it and invalidates the source — which is why using the ' +
        'old name afterwards is an error rather than an alias. A borrow is a temporary, ' +
        'checked window during which the owner cannot be moved or dropped, and the rule inside ' +
        'that window is aliasing XOR mutation: any number of shared borrows, or exactly one ' +
        'mutable borrow, never both at once. Every arrow below is a state transition the ' +
        'checker tracks per name, and every error it reports is a transition attempted from a ' +
        'state that does not allow it.',
      definition: [
        'graph TD',
        'A["let x = new — x owns it"] --> B["let y = move x — y owns it, x is invalid"]',
        'A --> C["let r = &x — shared borrow open"]',
        'C --> D["any number of further shared borrows"]',
        'C --> E["a mutable borrow is refused while any shared one is live"]',
        'A --> F["let m = &mut x — exclusive borrow open"]',
        'F --> G["x itself cannot be read, moved or dropped"]',
        'D --> H["end r — the borrow closes"]',
        'G --> H',
        'H --> I["x is usable again: move it, or drop it"]',
        'B --> J["use x — error, blamed on the move"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Structural rules are the permissions an ordinary type system grants silently.** ' +
        'Weakening lets a value go unused. Contraction lets it be used twice. Exchange lets ' +
        'the order of assumptions change. Every mainstream type system grants all three ' +
        'without mentioning them, and a substructural system is defined by which one it takes ' +
        'away.',
      '**Drop contraction and you have affine types: at most one use.** A file handle cannot ' +
        'be closed twice, a buffer cannot be freed twice, a channel endpoint cannot be sent ' +
        'twice. That single restriction eliminates the double-free bug class statically, and ' +
        'it is the discipline Rust chose.',
      '**Drop weakening as well and you have linear types: exactly once.** Now a resource ' +
        'cannot be forgotten either, so a leak is a type error too. That is stronger and ' +
        'harder to live with, which is why it appears in session types, in quantum languages ' +
        'where a qubit genuinely cannot be copied or discarded, and rarely in general-purpose ' +
        'languages.',
      '**Rust is affine plus a drop obligation, which is a specific and defensible middle.** ' +
        'The compiler enforces at-most-once and inserts the drop for you at end of scope, so ' +
        'the ordinary case needs no ceremony. It does not enforce at-least-once: ' +
        '`std::mem::forget` is safe, and a reference cycle in an `Rc` leaks. That is not an ' +
        'oversight; a leak is not a memory-safety violation.',
      '**A move invalidates the source, and use-after-move is the error that follows.** The ' +
        'demo reports it with the line that moved the value, because "x was already moved out ' +
        'of" without the location is useless. Every ownership error in the table names an ' +
        'earlier statement, which is exactly what a real borrow-checker diagnostic does.',
      '**Borrowing is what makes an affine discipline liveable, and it is orthogonal to it.** ' +
        'A borrow reaches a value without spending its single use, so a program can read a ' +
        'resource ten times and still consume it once. That is why the two-shared-borrows ' +
        'program is accepted even under the strictest discipline, and it is the design that ' +
        'turns linearity from a curiosity into a language.',
      '**Aliasing XOR mutation is the rule, and it is a data-race rule before it is a memory ' +
        'rule.** Many readers or one writer, never both. That is the same invariant a ' +
        'read-write lock enforces at run time, checked instead at compile time — which is why ' +
        'the same discipline that prevents use-after-free also prevents data races, and why ' +
        'the milestone on concurrency comes back to it.',
      '**Lifetimes are regions: the span during which a borrow is valid.** `end r` here is the ' +
        'explicit version of a scope ending. A reference that outlives its region is a ' +
        'dangling pointer, and the checker refuses it — the same analysis, whether the ' +
        'resource is memory, a lock guard, a file handle or a database transaction.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — run a borrow checker, and change the structural rules',
        markup: root.OwnershipTemplate.render()
      },
      diagram: diagram(),
      insight: '**The ownership rules are not about memory; memory is just the case that got ' +
        'the attention.** Every one of the errors in this demo has a direct analogue in code ' +
        'that never allocates: a database transaction committed twice, a file handle closed on ' +
        'two paths through an error handler, a channel receiver cloned so two consumers each ' +
        'think they own the stream, a mutex guard held across an await point, a connection ' +
        'returned to the pool and then used. All of them are "this resource was consumed and ' +
        'then used again" or "two things mutated it at once", and all of them are the same two ' +
        'rules. That is why a language with affine types eliminates the whole family rather ' +
        'than one member of it — and why, in a language without them, the useful discipline is ' +
        'to name the owner of every resource explicitly in review and ask what happens on the ' +
        'error path.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OwnershipTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const analyseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const result = root.Ownership.analyse(parts[0], parts[1]);

    return Object.assign({}, result,
      { statements: root.Ownership.parse(root.Ownership.PROGRAMS[parts[0]].source) });
  });

  const matrixFor = root.Helpers.memoise(function () {
    return root.Ownership.disciplineTable();
  });

  function update() {
    const values = panel.values();
    const state = analyseFor(values['own-program'] + '\n' + values['own-discipline']);

    paintMetrics(state);
    paintSource(state);
    paintErrors(state);
    paintMatrix(values['own-program']);
    paintDisciplines(values['own-discipline']);
    paintStatements();
  }

  function paintMetrics(state) {
    const first = state.errors[0];

    root.MetricGrid.update({
      'own-accepted': { value: state.accepted ? 'yes' : 'no',
        note: state.accepted
          ? 'the borrow rules and the ' + state.label + ' discipline both allow it'
          : state.errors.length + ' problem' + (state.errors.length === 1 ? '' : 's') + ' found' },
      'own-borrow': { value: root.Format.exact(state.borrowErrors),
        note: 'aliasing, mutation through the wrong kind of borrow, and lifetimes' },
      'own-structural': { value: root.Format.exact(state.structuralErrors),
        note: 'these depend entirely on the discipline; the borrow errors do not' },
      'own-first': { value: first ? (first.line >= 0 ? 'line ' + first.line : 'at the end')
        : 'nothing',
      note: first ? first.message : 'the program satisfies every rule' }
    });
  }

  function paintSource(state) {
    const byLine = {};

    state.errors.forEach(function (error) {
      if (error.line < 0 || byLine[error.line]) return;
      byLine[error.line] = error.message;
    });
    root.jQuery('#own-source tbody').html(state.statements.map(function (statement) {
      return '<tr><td class="mono">' + statement.line + '</td><td class="mono">' +
        root.Helpers.escapeHtml(statement.text) + '</td><td>' +
        root.Helpers.escapeHtml(READS[statement.kind]) + '</td><td>' +
        root.Helpers.escapeHtml(byLine[statement.line] || 'ok') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('own-source-caption', state.note +
      '. Every line is one operation on one name, and the checker carries a small state per ' +
      'name: alive or moved, how many shared borrows are open, and whether a mutable one is. ' +
      'That is the entire machine — a borrow checker is not an exotic analysis, it is a state ' +
      'automaton per binding plus the rule that the two kinds of borrow exclude each other.');
  }

  function paintErrors(state) {
    root.jQuery('#own-errors tbody').html(state.errors.map(function (error) {
      return '<tr><td class="mono">' + (error.line >= 0 ? error.line : '—') +
        '</td><td class="mono">' + root.Helpers.escapeHtml(error.text) + '</td><td>' +
        root.Helpers.escapeHtml(error.message) + '</td><td class="mono">' +
        (error.blame >= 0 ? 'line ' + error.blame : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4">no errors — this program satisfies every rule</td></tr>');

    root.Helpers.setText('own-errors-caption',
      'The blame column is the difference between a usable checker and an annoying one. ' +
      '"Cannot borrow x mutably" tells you nothing; "cannot borrow x mutably while a shared ' +
      'borrow taken on line 1 is live" tells you what to move. Real borrow-checker diagnostics ' +
      'are famous for this, and the reason they can do it is that the checker already knows ' +
      'the line — it is stored in the state it is tracking, and printing it costs nothing.');
  }

  function paintMatrix(selected) {
    const rows = matrixFor('all');

    root.jQuery('#own-matrix tbody').html(rows.map(function (row) {
      return '<tr' + (row.program === selected ? ' style="font-weight:600"' : '') +
        '><td class="mono">' + row.program + '</td>' +
        ['unrestricted', 'affine', 'relevant', 'linear'].map(function (name) {
          return '<td>' + (row.verdicts[name].accepted ? 'yes' : 'no') + '</td>';
        }).join('') + '<td>' + root.Helpers.escapeHtml(separator(row)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('own-matrix-caption', matrixCaption(rows));
  }

  function separator(row) {
    const accepted = row.acceptedBy.length;

    if (accepted === 4) return 'nothing — every discipline accepts it';
    if (accepted === 0) return 'a borrow error, which no discipline forgives';
    if (row.verdicts.affine.accepted && !row.verdicts.linear.accepted) return 'weakening';
    return 'contraction';
  }

  function matrixCaption(rows) {
    const all = rows.filter(function (row) { return row.acceptedBy.length === 4; }).length;
    const none = rows.filter(function (row) { return row.acceptedBy.length === 0; }).length;

    return all + ' programs are accepted by every discipline and ' + none + ' by none of them. ' +
      'The interesting rows are the two in between, and they separate on exactly the two ' +
      'structural rules: `leak` creates a resource and never consumes it, so the disciplines ' +
      'that require at least one use reject it — that is weakening. `useTwice` reads the owner ' +
      'twice, so the disciplines that allow at most one use reject it — that is contraction. ' +
      'Everything else in the table is a borrow error, and those are orthogonal: the borrow ' +
      'rules run first and no choice of structural discipline forgives an aliasing violation.';
  }

  function paintDisciplines(selected) {
    root.jQuery('#own-disciplines tbody').html(Object.keys(root.Ownership.DISCIPLINES)
      .map(function (name) {
        const entry = root.Ownership.DISCIPLINES[name];

        return '<tr' + (name === selected ? ' style="font-weight:600"' : '') +
          '><td class="mono">' + entry.label + '</td><td>' +
          (entry.contraction ? 'allowed' : 'refused') + '</td><td>' +
          (entry.weakening ? 'allowed' : 'refused') + '</td><td>' +
          root.Helpers.escapeHtml(entry.note) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('own-disciplines-caption',
      'Two independent switches, four systems. Refusing "use twice" is what makes a double ' +
      'free impossible; refusing "never use" is what makes a leak impossible. Rust sits in the ' +
      'affine row and adds an automatic drop at end of scope, which is why it prevents double ' +
      'frees and does not prevent leaks — `mem::forget` is a safe function and a reference ' +
      'cycle in an `Rc` is a leak the compiler will not complain about. That is a deliberate ' +
      'position on this table, not a gap in it.');
  }

  function paintStatements() {
    root.jQuery('#own-statements tbody').html(Object.keys(root.Ownership.STATEMENTS)
      .map(function (kind) {
        const entry = root.Ownership.STATEMENTS[kind];

        return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.shape) + '</td><td>' +
          root.Helpers.escapeHtml(entry.reads) + '</td><td>' +
          (kind === 'move' || kind === 'drop' || kind === 'use' || kind === 'mutate'
            ? 'yes, when applied to an owner' : 'no') + '</td></tr>';
      }).join(''));

    root.Helpers.setText('own-statements-caption',
      'The last column is the rule that makes the whole thing work: an operation on an OWNER ' +
      'spends a use, and the same operation on a BORROW does not. That is what lets a program ' +
      'read a value ten times through borrows and still satisfy a discipline that allows one ' +
      'use of the owner. Take borrowing away and an affine language is unusable — every read ' +
      'would consume, and nothing could be examined before it was spent.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
