/**
 * State - a small store with path access and pub/sub.
 *
 * The only events the platform emits are `navigation`, `theme`, `progress` and
 * `runner:*`. The wiring audit fails on a subscription to anything else, which
 * is what stops the event vocabulary from growing quietly.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.createState = api.createState;
    root.StateManager = api.createState();
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createState(initial) {
    const state = Object.assign({
      currentSection: null,
      sidebarOpen: true,
      theme: 'light',
      animationSpeed: 1
    }, initial || {});

    const listeners = {};

    function subscribe(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);

      return function unsubscribe() {
        listeners[event] = listeners[event].filter(function (fn) { return fn !== callback; });
      };
    }

    function emit(event, payload) {
      const handlers = listeners[event];
      if (!handlers) return;
      handlers.slice().forEach(function (handler) { handler(payload); });
    }

    function get(path) {
      if (!path) return state;
      return String(path).split('.').reduce(function (node, key) {
        return node && node[key] !== undefined ? node[key] : undefined;
      }, state);
    }

    function set(path, value) {
      const keys = String(path).split('.');
      const last = keys.pop();
      const target = keys.reduce(function (node, key) {
        if (!node[key]) node[key] = {};
        return node[key];
      }, state);

      const previous = target[last];
      target[last] = value;
      emit('change:' + path, { previous: previous, value: value });
      return value;
    }

    function listenerCount(event) {
      return (listeners[event] || []).length;
    }

    return { subscribe: subscribe, emit: emit, get: get, set: set, listenerCount: listenerCount };
  }

  return { createState: createState };
}));
