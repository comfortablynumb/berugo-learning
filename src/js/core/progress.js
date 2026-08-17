/**
 * Progress - per-section status, lab results and the export/import file.
 *
 * A section is `unvisited`, `visited` (opened) or `done` (every lab it carries
 * passed). "Unknown" and "not done" stay distinct: a section with no labs can
 * only ever reach `visited`, and the summary reports it that way rather than
 * pretending it was mastered.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.createProgress = api.createProgress;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KEY = 'progress';
  const VERSION = 1;

  function emptyState() {
    return { version: VERSION, sections: {}, labs: {} };
  }

  function createProgress(options) {
    const settings = options || {};
    const storage = settings.storage;
    const emit = settings.emit || function () {};

    if (!storage) throw new Error('createProgress requires a storage adapter');

    let data = normalise(storage.read(KEY, null));

    function normalise(raw) {
      if (!raw || typeof raw !== 'object') return emptyState();
      return {
        version: VERSION,
        sections: raw.sections && typeof raw.sections === 'object' ? raw.sections : {},
        labs: raw.labs && typeof raw.labs === 'object' ? raw.labs : {}
      };
    }

    function persist() {
      storage.write(KEY, data);
      emit('progress', summary());
    }

    function markVisited(sectionId) {
      const entry = data.sections[sectionId] || {};
      if (entry.status === 'done') return entry;
      data.sections[sectionId] = Object.assign(entry, { status: 'visited', visitedAt: entry.visitedAt || 0 });
      persist();
      return data.sections[sectionId];
    }

    function recordLab(sectionId, labId, result) {
      const key = sectionId + '::' + labId;
      const previous = data.labs[key] || { attempts: 0, passed: false };
      data.labs[key] = {
        attempts: previous.attempts + 1,
        passed: previous.passed || Boolean(result && result.passed),
        lastPassed: Boolean(result && result.passed),
        total: result && result.total ? result.total : 0,
        passedCount: result && result.passedCount ? result.passedCount : 0
      };
      if (data.labs[key].passed) refreshSectionStatus(sectionId, settings.labIdsFor);
      persist();
      return data.labs[key];
    }

    function refreshSectionStatus(sectionId, labIdsFor) {
      const labIds = typeof labIdsFor === 'function' ? labIdsFor(sectionId) : [];
      if (!labIds.length) return;

      const allPassed = labIds.every(function (labId) {
        const entry = data.labs[sectionId + '::' + labId];
        return Boolean(entry && entry.passed);
      });

      const entry = data.sections[sectionId] || {};
      data.sections[sectionId] = Object.assign(entry, { status: allPassed ? 'done' : (entry.status || 'visited') });
    }

    function statusOf(sectionId) {
      const entry = data.sections[sectionId];
      return entry && entry.status ? entry.status : 'unvisited';
    }

    function labResult(sectionId, labId) {
      return data.labs[sectionId + '::' + labId] || null;
    }

    function summary() {
      const statuses = Object.keys(data.sections).reduce(function (acc, id) {
        const status = data.sections[id].status || 'unvisited';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const labKeys = Object.keys(data.labs);
      return {
        visited: statuses.visited || 0,
        done: statuses.done || 0,
        labsAttempted: labKeys.length,
        labsPassed: labKeys.filter(function (key) { return data.labs[key].passed; }).length
      };
    }

    function exportAll() {
      return JSON.parse(JSON.stringify(data));
    }

    function importAll(raw) {
      data = normalise(raw);
      persist();
      return exportAll();
    }

    function reset(sectionId) {
      if (!sectionId) {
        data = emptyState();
      } else {
        delete data.sections[sectionId];
        Object.keys(data.labs).forEach(function (key) {
          if (key.indexOf(sectionId + '::') === 0) delete data.labs[key];
        });
      }
      persist();
    }

    return {
      markVisited: markVisited,
      recordLab: recordLab,
      statusOf: statusOf,
      labResult: labResult,
      summary: summary,
      exportAll: exportAll,
      importAll: importAll,
      reset: reset
    };
  }

  return { createProgress: createProgress };
}));
