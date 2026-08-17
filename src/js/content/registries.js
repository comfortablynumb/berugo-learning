/**
 * Content registries.
 *
 * Concepts, worked examples, reference entries and exercises are data keyed by
 * section id, not markup. That is what makes coverage testable: the content
 * test walks the curriculum and fails on a teaching section that registered
 * nothing, or registered an entry missing a required field.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.createContentRegistry = api.createContentRegistry;
    root.ConceptRegistry = api.ConceptRegistry;
    root.ExampleRegistry = api.ExampleRegistry;
    root.ReferenceRegistry = api.ReferenceRegistry;
    root.ExerciseRegistry = api.ExerciseRegistry;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createContentRegistry(name) {
    const entries = new Map();

    function register(map) {
      Object.keys(map).forEach(function (id) {
        if (entries.has(id)) {
          throw new Error(name + ': duplicate entry for section ' + id);
        }
        entries.set(id, map[id]);
      });
      return entries.size;
    }

    return {
      name: name,
      register: register,
      get: function (id) { return entries.get(id) || null; },
      has: function (id) { return entries.has(id); },
      ids: function () { return Array.from(entries.keys()); },
      size: function () { return entries.size; },
      clear: function () { entries.clear(); }
    };
  }

  return {
    createContentRegistry: createContentRegistry,
    ConceptRegistry: createContentRegistry('concepts'),
    ExampleRegistry: createContentRegistry('examples'),
    ReferenceRegistry: createContentRegistry('reference'),
    ExerciseRegistry: createContentRegistry('exercises')
  };
}));
