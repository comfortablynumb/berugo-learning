/**
 * Substructural types: ownership, borrowing, and the two structural rules a
 * type system can refuse to give you.
 *
 * Ordinary type systems silently allow *weakening* (a value may go unused) and
 * *contraction* (a value may be used twice). Drop contraction and you have
 * affine types: at most one use, so a file handle cannot be closed twice. Drop
 * weakening too and you have linear types: exactly one use, so a handle cannot
 * be forgotten either. Rust is affine with a `Drop` obligation attached, which
 * is why a move invalidates the source and why a leak is a bug the compiler
 * does not catch but a double free is.
 *
 * Borrowing is what makes that liveable. Without it, passing a value anywhere
 * gives it away. A borrow is a temporary, checked alias: any number of shared
 * borrows, or exactly one mutable borrow, never both — the rule that makes
 * data races unrepresentable rather than merely discouraged. This module
 * checks programs against all four disciplines and reports, for each error,
 * the earlier statement responsible.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Ownership = api;
}(this, function () {
  'use strict';

  /**
   * The four disciplines, as the two structural rules they permit.
   * `contraction` is "use it twice"; `weakening` is "never use it".
   */
  const DISCIPLINES = {
    unrestricted: { contraction: true, weakening: true,
      label: 'unrestricted', note: 'ordinary types: use it any number of times' },
    affine: { contraction: false, weakening: true,
      label: 'affine', note: 'at most once — Rust, minus the drop obligation' },
    relevant: { contraction: true, weakening: false,
      label: 'relevant', note: 'at least once — nothing may be forgotten' },
    linear: { contraction: false, weakening: false,
      label: 'linear', note: 'exactly once — session types, quantum registers' }
  };

  /* --------------------------------------------------------- the language */

  const STATEMENTS = {
    make: { arity: 1, shape: 'let x = new', reads: 'create an owned resource' },
    move: { arity: 2, shape: 'let y = move x', reads: 'transfer ownership' },
    use: { arity: 1, shape: 'use x', reads: 'read through a name' },
    mutate: { arity: 1, shape: 'mutate x', reads: 'write through a name' },
    drop: { arity: 1, shape: 'drop x', reads: 'consume and release' },
    share: { arity: 2, shape: 'let r = &x', reads: 'take a shared borrow' },
    borrow: { arity: 2, shape: 'let m = &mut x', reads: 'take a mutable borrow' },
    release: { arity: 1, shape: 'end r', reads: 'the borrow goes out of scope' }
  };

  function parse(text) {
    return String(text).split('\n').map(function (line) {
      return line.replace(/#.*$/, '').trim();
    }).filter(Boolean).map(parseLine);
  }

  const LINE_PATTERNS = [
    { re: /^let\s+(\w+)\s*=\s*new$/, kind: 'make', args: [1] },
    { re: /^let\s+(\w+)\s*=\s*move\s+(\w+)$/, kind: 'move', args: [1, 2] },
    { re: /^let\s+(\w+)\s*=\s*&mut\s+(\w+)$/, kind: 'borrow', args: [1, 2] },
    { re: /^let\s+(\w+)\s*=\s*&(\w+)$/, kind: 'share', args: [1, 2] },
    { re: /^use\s+(\w+)$/, kind: 'use', args: [1] },
    { re: /^mutate\s+(\w+)$/, kind: 'mutate', args: [1] },
    { re: /^drop\s+(\w+)$/, kind: 'drop', args: [1] },
    { re: /^end\s+(\w+)$/, kind: 'release', args: [1] }
  ];

  function parseLine(line, index) {
    for (let i = 0; i < LINE_PATTERNS.length; i += 1) {
      const found = LINE_PATTERNS[i].re.exec(line);

      if (found === null) continue;
      return { kind: LINE_PATTERNS[i].kind, line: index,
        text: line, args: LINE_PATTERNS[i].args.map(function (slot) {
          return found[slot];
        }) };
    }
    throw new Error('cannot parse "' + line + '"');
  }

  /* ------------------------------------------------------------ checking */

  function newState() {
    return { owners: {}, borrows: {}, errors: [], uses: {} };
  }

  function fail(state, statement, message, blame) {
    state.errors.push({ line: statement.line, text: statement.text,
      message: message, blame: blame === undefined ? -1 : blame });
  }

  /** Every check the borrow rules impose, one function each. */
  const CHECKS = {
    make: function (state, statement) {
      const name = statement.args[0];

      if (state.owners[name] !== undefined) {
        return fail(state, statement, name + ' is already bound', state.owners[name].line);
      }
      state.owners[name] = { alive: true, line: statement.line, movedAt: -1,
        shared: [], mutable: null };
      state.uses[name] = 0;
    },
    move: function (state, statement) { moveOut(state, statement); },
    use: function (state, statement) { touch(state, statement, false); },
    mutate: function (state, statement) { touch(state, statement, true); },
    drop: function (state, statement) { dropOut(state, statement); },
    share: function (state, statement) { takeBorrow(state, statement, false); },
    borrow: function (state, statement) { takeBorrow(state, statement, true); },
    release: function (state, statement) { endBorrow(state, statement); }
  };

  function owner(state, statement, name) {
    const entry = state.owners[name];

    if (entry === undefined) {
      fail(state, statement, name + ' is not bound');
      return null;
    }
    if (!entry.alive) {
      fail(state, statement, name + ' was already moved out of', entry.movedAt);
      return null;
    }
    return entry;
  }

  function moveOut(state, statement) {
    const target = statement.args[0];
    const source = statement.args[1];
    const entry = owner(state, statement, source);

    if (entry === null) return;
    if (entry.shared.length > 0 || entry.mutable !== null) {
      return fail(state, statement, 'cannot move ' + source + ' while it is borrowed',
        entry.mutable === null ? entry.shared[0].line : entry.mutable.line);
    }
    entry.alive = false;
    entry.movedAt = statement.line;
    state.uses[source] += 1;
    state.owners[target] = { alive: true, line: statement.line, movedAt: -1,
      shared: [], mutable: null };
    state.uses[target] = 0;
  }

  function dropOut(state, statement) {
    const name = statement.args[0];
    const entry = owner(state, statement, name);

    if (entry === null) return;
    if (entry.shared.length > 0 || entry.mutable !== null) {
      return fail(state, statement, 'cannot drop ' + name + ' while it is borrowed',
        entry.mutable === null ? entry.shared[0].line : entry.mutable.line);
    }
    entry.alive = false;
    entry.movedAt = statement.line;
    state.uses[name] += 1;
  }

  function touch(state, statement, writing) {
    const name = statement.args[0];
    const borrowed = state.borrows[name];

    if (borrowed !== undefined) return touchBorrow(state, statement, borrowed, writing);
    const entry = owner(state, statement, name);

    if (entry === null) return;
    if (writing && entry.shared.length > 0) {
      return fail(state, statement, 'cannot mutate ' + name
        + ' while a shared borrow is live', entry.shared[0].line);
    }
    if (entry.mutable !== null) {
      return fail(state, statement, 'cannot use ' + name
        + ' while it is mutably borrowed', entry.mutable.line);
    }
    state.uses[name] += 1;
  }

  /**
   * Reading through a borrow deliberately does *not* count as a use of the
   * owner. That is the entire point of borrowing: it lets a value be reached
   * many times without spending the single use an affine or linear discipline
   * allows, which is what makes those disciplines usable at all.
   */
  function touchBorrow(state, statement, borrowed, writing) {
    if (!borrowed.live) {
      return fail(state, statement, borrowed.name + ' outlived its borrow',
        borrowed.endedAt);
    }
    if (writing && !borrowed.mutable) {
      return fail(state, statement, borrowed.name + ' is a shared borrow, not a mutable one',
        borrowed.line);
    }
  }

  function takeBorrow(state, statement, mutable) {
    const name = statement.args[0];
    const target = statement.args[1];
    const entry = owner(state, statement, target);

    if (entry === null) return;
    if (entry.mutable !== null) {
      fail(state, statement, target + ' is already mutably borrowed', entry.mutable.line);
    } else if (mutable && entry.shared.length > 0) {
      fail(state, statement, 'cannot borrow ' + target
        + ' mutably while ' + entry.shared.length + ' shared borrow'
        + (entry.shared.length > 1 ? 's are' : ' is') + ' live', entry.shared[0].line);
    }
    recordBorrow(state, statement, { name: name, target: target, mutable: mutable }, entry);
  }

  /*
   * The borrow is recorded even when it was rejected, so the statements after
   * it are checked against what the programmer meant rather than collapsing
   * into a cascade of "not bound" — the same reason a real compiler poisons a
   * binding instead of deleting it.
   */

  function recordBorrow(state, statement, spec, entry) {
    const record = { name: spec.name, target: spec.target, mutable: spec.mutable,
      live: true, line: statement.line, endedAt: -1 };

    state.borrows[spec.name] = record;
    if (spec.mutable) entry.mutable = record;
    else entry.shared.push(record);
  }

  function endBorrow(state, statement) {
    const name = statement.args[0];
    const record = state.borrows[name];

    if (record === undefined) return fail(state, statement, name + ' is not a borrow');
    if (!record.live) {
      return fail(state, statement, name + ' was already released', record.endedAt);
    }
    record.live = false;
    record.endedAt = statement.line;
    const entry = state.owners[record.target];

    if (entry === undefined) return;
    if (record.mutable) entry.mutable = null;
    else entry.shared = entry.shared.filter(function (other) { return other !== record; });
  }

  /**
   * Run the borrow checker, then apply the discipline's own two rules to what
   * is left: a name used twice breaks contraction, a name never used breaks
   * weakening. Separating the two makes it visible that borrowing is an
   * *orthogonal* mechanism — it is what buys back usability once contraction
   * is gone.
   */
  function check(program, disciplineName) {
    const statements = typeof program === 'string' ? parse(program) : program;
    const discipline = DISCIPLINES[disciplineName || 'affine'];
    const state = newState();

    statements.forEach(function (statement) {
      CHECKS[statement.kind](state, statement);
    });
    return finishCheck(state, statements, discipline, disciplineName || 'affine');
  }

  function finishCheck(state, statements, discipline, name) {
    const structural = structuralErrors(state, discipline);
    const dangling = Object.keys(state.borrows).filter(function (borrowName) {
      return state.borrows[borrowName].live;
    });

    return { discipline: name, label: discipline.label,
      statements: statements.length,
      errors: state.errors.concat(structural),
      borrowErrors: state.errors.length, structuralErrors: structural.length,
      danglingBorrows: dangling,
      accepted: state.errors.length + structural.length === 0,
      uses: Object.assign({}, state.uses) };
  }

  function structuralErrors(state, discipline) {
    const errors = [];

    Object.keys(state.uses).forEach(function (name) {
      const count = state.uses[name];

      if (!discipline.contraction && count > 1) {
        errors.push({ line: -1, text: name, blame: -1,
          message: name + ' is used ' + count + ' times, and this discipline allows at most one' });
      }
      if (!discipline.weakening && count === 0) {
        errors.push({ line: -1, text: name, blame: -1,
          message: name + ' is never used, and this discipline requires at least one use' });
      }
    });
    return errors;
  }

  /* ------------------------------------------------------------ fixtures */

  const PROGRAMS = {
    moveThenUse: { note: 'use after move — the error ownership exists to catch',
      source: 'let x = new\nlet y = move x\nuse x' },
    moveOnce: { note: 'a clean move: the source is never touched again',
      source: 'let x = new\nlet y = move x\ndrop y' },
    doubleDrop: { note: 'the double free, caught statically',
      source: 'let x = new\ndrop x\ndrop x' },
    leak: { note: 'created and never consumed — a leak, which affine types allow',
      source: 'let x = new' },
    sharedTwice: { note: 'two shared borrows at once, which is fine',
      source: 'let x = new\nlet a = &x\nlet b = &x\nuse a\nuse b\nend a\nend b\ndrop x' },
    sharedAndMutable: { note: 'a mutable borrow while a shared one is live',
      source: 'let x = new\nlet a = &x\nlet m = &mut x\nmutate m' },
    mutableTwice: { note: 'two mutable borrows — the aliasing rule',
      source: 'let x = new\nlet m = &mut x\nlet n = &mut x\nmutate n' },
    writeThroughShared: { note: 'writing through a shared borrow',
      source: 'let x = new\nlet a = &x\nmutate a\nend a\ndrop x' },
    useAfterRelease: { note: 'the borrow outlived its scope',
      source: 'let x = new\nlet a = &x\nend a\nuse a\ndrop x' },
    moveWhileBorrowed: { note: 'moving out from under a live borrow',
      source: 'let x = new\nlet a = &x\nlet y = move x\nend a' },
    mutableThenRelease: { note: 'one mutable borrow, ended before the next',
      source: 'let x = new\nlet m = &mut x\nmutate m\nend m\nlet n = &mut x\nmutate n\nend n\ndrop x' },
    useTwice: { note: 'two direct uses of an owner — legal in Rust, not in a linear system',
      source: 'let x = new\nuse x\nuse x\ndrop x' }
  };

  function analyse(name, disciplineName) {
    const entry = PROGRAMS[name];
    const result = check(entry.source, disciplineName);

    return Object.assign({ program: name, note: entry.note, source: entry.source }, result);
  }

  /** Every program against every discipline: the table the section prints. */
  function disciplineTable() {
    return Object.keys(PROGRAMS).map(function (name) {
      const row = { program: name, note: PROGRAMS[name].note, verdicts: {} };

      Object.keys(DISCIPLINES).forEach(function (discipline) {
        const result = analyse(name, discipline);

        row.verdicts[discipline] = { accepted: result.accepted,
          borrowErrors: result.borrowErrors, structuralErrors: result.structuralErrors,
          first: result.errors.length ? result.errors[0].message : '' };
      });
      row.acceptedBy = Object.keys(row.verdicts).filter(function (discipline) {
        return row.verdicts[discipline].accepted;
      });
      return row;
    });
  }

  function programNames() { return Object.keys(PROGRAMS); }

  return {
    DISCIPLINES: DISCIPLINES, STATEMENTS: STATEMENTS, PROGRAMS: PROGRAMS,
    parse: parse, check: check, analyse: analyse, disciplineTable: disciplineTable,
    programNames: programNames
  };
}));
