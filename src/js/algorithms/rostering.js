/**
 * A real requirement, written down twice, and the gap between the two.
 *
 * Nurse rostering is the standard example of "model it as a known problem and
 * call a solver", and it is also the standard example of the failure mode: the
 * model quietly does not say what the requirement said. That failure is not a
 * slow solver. It is a solver returning, quickly and correctly, the answer to a
 * different question — and nothing downstream can tell.
 *
 * So this module holds the requirement in TWO forms that share no code:
 *
 *   - `encode(scenario)` builds a CNF. This is the model.
 *   - `validate(scenario, schedule)` reads a schedule and checks every stated
 *     requirement directly, in the language of the requirement. This is the
 *     specification.
 *
 * A schedule the solver returns is then run through `validate`, and any
 * requirement it fails is an encoding bug rather than an infeasible instance.
 * That check is the only defence there is against a model that has drifted,
 * and it is the discipline the whole section is about.
 *
 * The scenario also carries requirements the CNF **cannot** express, marked
 * `soft`. A hard constraint is a clause; a preference is an objective, and SAT
 * has no objective. Listing them next to the ones that were encoded — rather
 * than dropping them — is what stops "the solver said yes" from being read as
 * "the roster is acceptable".
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Rostering = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Sat = scope && scope.SatBasics ? scope.SatBasics : require('./sat-basics.js');
  const Encodings = scope && scope.Encodings ? scope.Encodings : require('./encodings.js');

  const SHIFTS = ['day', 'evening', 'night'];

  /* -------------------------------------------------------- the scenario */

  /**
   * `demand[shift]` nurses on every shift of every day, at most one shift per
   * nurse per day, no day shift after a night shift, at most `maxShifts` in
   * the horizon, and at least one rest day in every window of `restWindow`.
   */
  function scenario(options) {
    const settings = options || {};

    return { nurses: settings.nurses === undefined ? 9 : settings.nurses,
      days: settings.days === undefined ? 7 : settings.days,
      shifts: SHIFTS.slice(),
      demand: settings.demand === undefined ? [2, 2, 1] : settings.demand,
      maxShifts: settings.maxShifts === undefined ? 5 : settings.maxShifts,
      restWindow: settings.restWindow === undefined ? 4 : settings.restWindow,
      soft: settings.soft === undefined ? defaultPreferences() : settings.soft };
  }

  /** The requirements a Boolean model cannot carry, kept rather than dropped. */
  function defaultPreferences() {
    return [
      { id: 'weekend-fairness', text: 'weekend shifts should be shared evenly',
        why: 'this is an objective over the whole roster, and SAT has no objective — it needs MaxSAT, ILP or a cardinality constraint per nurse plus a search over the bound' },
      { id: 'shift-continuity', text: 'a nurse prefers to keep the same shift type across a run of days',
        why: 'expressible as a penalty, not as a clause; encoding it hard would make many feasible rosters infeasible' },
      { id: 'requested-leave', text: 'honour requested days off where possible',
        why: '"where possible" is the whole difficulty — as a hard clause it can make the instance unsatisfiable with no indication of which request caused it' }
    ];
  }

  /* ---------------------------------------------------------- the model */

  /** Variable for (nurse, day, shift), one-based as `sat-basics` expects. */
  function shiftVar(spec, nurse, day, shift) {
    return nurse * spec.days * spec.shifts.length + day * spec.shifts.length + shift + 1;
  }

  function encode(spec, options) {
    const settings = options || {};
    const counter = { next: spec.nurses * spec.days * spec.shifts.length };
    const groups = [];

    addOneShiftPerDay(spec, counter, groups, settings);
    addDemand(spec, counter, groups);
    addNoDayAfterNight(spec, groups);
    addWorkloadCap(spec, counter, groups);
    addRestWindow(spec, counter, groups);
    const clauses = groups.reduce(function (all, group) {
      return all.concat(group.clauses);
    }, []);
    return { formula: Sat.createFormula(counter.next, clauses), groups: groups,
      variables: counter.next, decisionVariables: spec.nurses * spec.days * spec.shifts.length,
      clauses: clauses.length, encoding: settings.encoding === undefined
        ? 'pairwise' : settings.encoding };
  }

  function addOneShiftPerDay(spec, counter, groups, settings) {
    const clauses = [];
    let auxiliary = 0;

    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
      for (let day = 0; day < spec.days; day += 1) {
        const literals = spec.shifts.map(function (unused, shift) {
          return shiftVar(spec, nurse, day, shift);
        });
        const built = Encodings.atMostOne(literals, counter, settings);
        built.clauses.forEach(function (clause) { clauses.push(clause); });
        auxiliary += built.auxiliary;
      }
    }
    groups.push({ id: 'one-shift-per-day', text: 'a nurse works at most one shift per day',
      clauses: clauses, auxiliary: auxiliary });
  }

  function addDemand(spec, counter, groups) {
    const clauses = [];
    let auxiliary = 0;

    for (let day = 0; day < spec.days; day += 1) {
      for (let shift = 0; shift < spec.shifts.length; shift += 1) {
        const literals = [];
        for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
          literals.push(shiftVar(spec, nurse, day, shift));
        }
        const need = spec.demand[shift];
        [Encodings.atLeastK(literals, need, counter),
          Encodings.atMostK(literals, need, counter)].forEach(function (built) {
          built.clauses.forEach(function (clause) { clauses.push(clause); });
          auxiliary += built.auxiliary;
        });
      }
    }
    groups.push({ id: 'demand', text: 'every shift is covered by exactly its required headcount',
      clauses: clauses, auxiliary: auxiliary });
  }

  function addNoDayAfterNight(spec, groups) {
    const clauses = [];
    const night = spec.shifts.indexOf('night');
    const day = spec.shifts.indexOf('day');

    /* A scenario without both shift kinds has nothing to forbid. Without this
       guard the missing index is -1, shiftVar computes a variable one slot
       below the row, and the model constrains a nurse nobody named — which is
       precisely the drift `validate` exists to catch, and did. */
    if (night === -1 || day === -1) {
      groups.push({ id: 'no-day-after-night', text: 'no day shift after a night shift (not applicable: this scenario has no ' + (night === -1 ? 'night' : 'day') + ' shift)', clauses: [], auxiliary: 0 });
      return;
    }
    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
      for (let d = 0; d + 1 < spec.days; d += 1) {
        clauses.push([-shiftVar(spec, nurse, d, night), -shiftVar(spec, nurse, d + 1, day)]);
      }
    }
    groups.push({ id: 'no-day-after-night', text: 'no day shift on the morning after a night shift',
      clauses: clauses, auxiliary: 0 });
  }

  function addWorkloadCap(spec, counter, groups) {
    const clauses = [];
    let auxiliary = 0;

    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
      const literals = [];
      for (let day = 0; day < spec.days; day += 1) {
        for (let shift = 0; shift < spec.shifts.length; shift += 1) {
          literals.push(shiftVar(spec, nurse, day, shift));
        }
      }
      const built = Encodings.atMostK(literals, spec.maxShifts, counter);
      built.clauses.forEach(function (clause) { clauses.push(clause); });
      auxiliary += built.auxiliary;
    }
    groups.push({ id: 'workload', text: 'no nurse works more than ' + spec.maxShifts +
      ' shifts in the horizon', clauses: clauses, auxiliary: auxiliary });
  }

  /**
   * At least one rest day in every window: for each window, at most
   * `restWindow − 1` of the window's shift variables are true. A nurse works
   * at most one shift a day, so counting shifts and counting worked days are
   * the same number here — and that equivalence is exactly the kind of step
   * that stops being true when a requirement changes, which is why `validate`
   * checks worked DAYS directly rather than trusting it.
   */
  function addRestWindow(spec, counter, groups) {
    const clauses = [];
    let auxiliary = 0;

    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
      for (let start = 0; start + spec.restWindow <= spec.days; start += 1) {
        const literals = [];
        for (let day = start; day < start + spec.restWindow; day += 1) {
          for (let shift = 0; shift < spec.shifts.length; shift += 1) {
            literals.push(shiftVar(spec, nurse, day, shift));
          }
        }
        const built = Encodings.atMostK(literals, spec.restWindow - 1, counter);
        built.clauses.forEach(function (clause) { clauses.push(clause); });
        auxiliary += built.auxiliary;
      }
    }
    groups.push({ id: 'rest', text: 'at least one rest day in every window of ' +
      spec.restWindow + ' days', clauses: clauses, auxiliary: auxiliary });
  }

  /* -------------------------------------------------------- the decoder */

  /** A schedule is `schedule[nurse][day] = shift index, or −1 for a rest day`. */
  function decode(spec, assignment) {
    const schedule = [];

    for (let nurse = 0; nurse < spec.nurses; nurse += 1) {
      const row = [];
      for (let day = 0; day < spec.days; day += 1) {
        let chosen = -1;
        for (let shift = 0; shift < spec.shifts.length; shift += 1) {
          if (assignment[shiftVar(spec, nurse, day, shift) - 1] !== 1) continue;
          chosen = chosen === -1 ? shift : -2;   /* two shifts in one day: a broken model */
        }
        row.push(chosen);
      }
      schedule.push(row);
    }
    return schedule;
  }

  /* ---------------------------------------------------- the specification */

  /**
   * Every requirement, checked against the schedule directly. This shares no
   * code with `encode` on purpose: a checker written from the model checks the
   * model, and would agree with a wrong model exactly as happily.
   */
  function validate(spec, schedule) {
    const checks = [
      checkOneShift(spec, schedule), checkDemand(spec, schedule),
      checkNoDayAfterNight(spec, schedule), checkWorkload(spec, schedule),
      checkRest(spec, schedule)
    ];

    return { checks: checks, satisfied: checks.every(function (check) { return check.ok; }),
      unmodelled: spec.soft.slice(), stats: rosterStats(spec, schedule) };
  }

  function checkOneShift(spec, schedule) {
    const failures = [];

    schedule.forEach(function (row, nurse) {
      row.forEach(function (shift, day) {
        if (shift !== -2) return;
        failures.push('nurse ' + nurse + ' has two shifts on day ' + day);
      });
    });
    return finish('one-shift-per-day', 'a nurse works at most one shift per day', failures);
  }

  function checkDemand(spec, schedule) {
    const failures = [];

    for (let day = 0; day < spec.days; day += 1) {
      for (let shift = 0; shift < spec.shifts.length; shift += 1) {
        let count = 0;
        schedule.forEach(function (row) { if (row[day] === shift) count += 1; });
        if (count === spec.demand[shift]) continue;
        failures.push('day ' + day + ' ' + spec.shifts[shift] + ': ' + count +
          ' nurses against a demand of ' + spec.demand[shift]);
      }
    }
    return finish('demand', 'every shift is covered by exactly its required headcount', failures);
  }

  function checkNoDayAfterNight(spec, schedule) {
    const failures = [];
    const night = spec.shifts.indexOf('night');
    const dayShift = spec.shifts.indexOf('day');

    /* Without both kinds there is nothing to forbid — and the missing index is
       -1, which is also the rest-day marker, so an unguarded comparison reports
       a violation for every rest day followed by a day shift. */
    if (night === -1 || dayShift === -1) {
      return finish('no-day-after-night',
        'no day shift after a night shift (not applicable to this scenario)', failures);
    }
    schedule.forEach(function (row, nurse) {
      for (let day = 0; day + 1 < spec.days; day += 1) {
        if (row[day] !== night || row[day + 1] !== dayShift) continue;
        failures.push('nurse ' + nurse + ' works nights on day ' + day + ' and days on day ' +
          (day + 1));
      }
    });
    return finish('no-day-after-night', 'no day shift on the morning after a night shift', failures);
  }

  function checkWorkload(spec, schedule) {
    const failures = [];

    schedule.forEach(function (row, nurse) {
      const worked = row.filter(function (shift) { return shift >= 0; }).length;
      if (worked <= spec.maxShifts) return;
      failures.push('nurse ' + nurse + ' works ' + worked + ' shifts against a cap of ' +
        spec.maxShifts);
    });
    return finish('workload', 'no nurse works more than ' + spec.maxShifts + ' shifts', failures);
  }

  function checkRest(spec, schedule) {
    const failures = [];

    schedule.forEach(function (row, nurse) {
      for (let start = 0; start + spec.restWindow <= spec.days; start += 1) {
        const window = row.slice(start, start + spec.restWindow);
        if (window.some(function (shift) { return shift < 0; })) continue;
        failures.push('nurse ' + nurse + ' works days ' + start + '–' +
          (start + spec.restWindow - 1) + ' without a break');
      }
    });
    return finish('rest', 'at least one rest day in every window of ' + spec.restWindow + ' days',
      failures);
  }

  function finish(id, text, failures) {
    return { id: id, text: text, ok: failures.length === 0, failures: failures.slice(0, 6),
      failureCount: failures.length };
  }

  /** The numbers a preference would be scored on, reported even though the
   *  model does not constrain them — so the gap is visible. */
  function rosterStats(spec, schedule) {
    const perNurse = schedule.map(function (row) {
      return row.filter(function (shift) { return shift >= 0; }).length;
    });
    const weekend = schedule.map(function (row) {
      let count = 0;
      row.forEach(function (shift, day) { if (shift >= 0 && day % 7 >= 5) count += 1; });
      return count;
    });
    const nights = schedule.map(function (row) {
      return row.filter(function (shift) { return spec.shifts[shift] === 'night'; }).length;
    });
    return { perNurse: perNurse, weekend: weekend, nights: nights,
      workedSpread: Math.max.apply(null, perNurse) - Math.min.apply(null, perNurse),
      weekendSpread: Math.max.apply(null, weekend) - Math.min.apply(null, weekend),
      nightSpread: Math.max.apply(null, nights) - Math.min.apply(null, nights) };
  }

  return {
    SHIFTS: SHIFTS, scenario: scenario, defaultPreferences: defaultPreferences,
    shiftVar: shiftVar, encode: encode, decode: decode, validate: validate,
    rosterStats: rosterStats
  };
}));
