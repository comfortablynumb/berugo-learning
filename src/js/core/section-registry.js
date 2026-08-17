/**
 * SectionRegistry - sections register themselves; app.js never lists them.
 *
 * The reference platform this replaces kept a 200-line init list in app.js and
 * a matching list of script tags; the two drifted. Here a duplicate id throws
 * at load and the wiring audit fails on a registered id that the curriculum
 * does not know about, or a curriculum id that nothing registered.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.createSectionRegistry = api.createSectionRegistry;
    root.SectionRegistry = api.createSectionRegistry();
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createSectionRegistry() {
    const modules = new Map();

    function register(definition) {
      if (!definition || !definition.id) {
        throw new Error('SectionRegistry.register requires an { id, init } definition');
      }
      if (modules.has(definition.id)) {
        throw new Error('Duplicate section registration: ' + definition.id);
      }
      if (typeof definition.init !== 'function') {
        throw new Error('Section ' + definition.id + ' has no init function');
      }

      modules.set(definition.id, definition);
      return definition;
    }

    function initAll(context) {
      const failures = [];

      modules.forEach(function (definition, id) {
        try {
          definition.init(context);
        } catch (error) {
          failures.push({ id: id, error: error });
        }
      });

      return failures;
    }

    return {
      register: register,
      initAll: initAll,
      get: function (id) { return modules.get(id) || null; },
      ids: function () { return Array.from(modules.keys()); },
      size: function () { return modules.size; },
      clear: function () { modules.clear(); }
    };
  }

  return { createSectionRegistry: createSectionRegistry };
}));
