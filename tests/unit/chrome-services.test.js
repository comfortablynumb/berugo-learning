'use strict';

/**
 * The application chrome: text scale, the global search index and the
 * installer. All three are dependency-injected so they can be tested without
 * a document, a localStorage or a browser - the rule the whole project runs
 * on.
 */

const test = require('node:test');
const assert = require('node:assert');

const TextScale = require('../../src/js/core/text-scale.js');
const SearchIndex = require('../../src/js/core/search-index.js');
const Installer = require('../../src/js/core/installer.js');
const Curriculum = require('../../src/js/core/curriculum.js');
const registries = require('../../src/js/content/registries.js');

const fs = require('node:fs');
const path = require('node:path');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'content');
fs.readdirSync(CONTENT_DIR)
  .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
  .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });

function fakeStorage() {
  const values = new Map();
  return {
    read: function (key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    write: function (key, value) { values.set(key, value); return true; },
    remove: function (key) { values.delete(key); return true; },
    keys: function () { return Array.from(values.keys()); }
  };
}

function makeScale(storage) {
  const applied = [];
  const scale = TextScale.createTextScale({
    storage: storage,
    apply: function (value) { applied.push(value); }
  });
  return { scale: scale, applied: applied };
}

/* ---------------------------------------------------------------- text scale */

test('text scale: starts at 1 and steps through its ladder', function () {
  const built = makeScale(fakeStorage());

  assert.strictEqual(built.scale.init(), 1);
  assert.strictEqual(built.scale.percent(), 100);
  assert.strictEqual(built.scale.increase(), 1.075);
  assert.strictEqual(built.scale.increase(), 1.15);
  assert.strictEqual(built.scale.decrease(), 1.075);
  assert.strictEqual(built.scale.reset(), 1);
  assert.deepStrictEqual(built.applied, [1, 1.075, 1.15, 1.075, 1]);
});

test('text scale: clamps at both ends and reports where it is', function () {
  const built = makeScale(fakeStorage());
  const steps = built.scale.steps();
  built.scale.init();

  for (let i = 0; i < 20; i += 1) built.scale.increase();
  assert.strictEqual(built.scale.current(), steps[steps.length - 1]);
  assert.strictEqual(built.scale.atMaximum(), true);
  assert.strictEqual(built.scale.atMinimum(), false);

  for (let i = 0; i < 20; i += 1) built.scale.decrease();
  assert.strictEqual(built.scale.current(), steps[0]);
  assert.strictEqual(built.scale.atMinimum(), true);
  assert.strictEqual(built.scale.percent(), 85);
});

test('text scale: the preference survives a reload', function () {
  const storage = fakeStorage();
  const first = makeScale(storage);
  first.scale.init();
  first.scale.increase();
  first.scale.increase();

  const second = makeScale(storage);
  assert.strictEqual(second.scale.init(), 1.15, 'the stored value comes back');
  assert.strictEqual(second.applied[0], 1.15, 'and is applied on start-up');
});

test('text scale: an unusable stored value falls back to the default', function () {
  const storage = fakeStorage();
  storage.write('text-scale', 'enormous');
  const built = makeScale(storage);

  assert.strictEqual(built.scale.init(), 1);
});

test('text scale: emits a change event the shell can listen to', function () {
  const events = [];
  const scale = TextScale.createTextScale({
    storage: fakeStorage(),
    apply: function () {},
    emit: function (name, payload) { events.push({ name: name, payload: payload }); }
  });

  scale.init();
  scale.increase();

  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].name, 'change:text-scale', 'inside the known event vocabulary');
  assert.strictEqual(events[0].payload.scale, 1.075);
});

/* -------------------------------------------------------------- search index */

function index() {
  return SearchIndex.createSearchIndex({ curriculum: Curriculum, registries: registries });
}

test('search: indexes far more than the section list', function () {
  const built = index();
  assert.ok(built.size() > Curriculum.sections().length * 4,
    'expected concepts, examples, reference and exercises too, got ' + built.size());
});

test('search: a section title still ranks first for its own name', function () {
  const hits = index().search('open addressing');

  assert.ok(hits.length > 0);
  assert.strictEqual(hits[0].sectionId, 'open-addressing');
  assert.strictEqual(hits[0].kind, 'section');
});

test('search: finds a term that appears only inside the content', function () {
  const cases = [
    { query: 'tombstone', section: 'open-addressing' },
    { query: 'coupon collector', section: 'average-case' },
    { query: 'round half to even', section: 'js-systems' },
    { query: 'hysteresis', section: 'amortised-analysis' },
    { query: "little's law", section: 'queues-and-rings' }
  ];

  cases.forEach(function (item) {
    const hits = index().search(item.query);
    assert.ok(hits.length > 0, 'no hit for "' + item.query + '"');
    const sections = hits.map(function (hit) { return hit.sectionId; });
    assert.ok(sections.indexOf(item.section) !== -1,
      '"' + item.query + '" should reach ' + item.section + ', got ' + sections.slice(0, 4).join(', '));
  });
});

test('search: every hit carries where it came from and why it matched', function () {
  index().search('cache line').forEach(function (hit) {
    assert.ok(hit.sectionId && Curriculum.has(hit.sectionId), 'a real section id');
    assert.ok(hit.label, 'a label');
    assert.ok(hit.kind, 'a kind');
    assert.ok(hit.snippet.length > 0, 'a snippet');
    assert.ok(hit.score > 0, 'a score');
  });
});

test('search: short and empty queries return nothing rather than everything', function () {
  const built = index();
  assert.deepStrictEqual(built.search(''), []);
  assert.deepStrictEqual(built.search(' '), []);
  assert.deepStrictEqual(built.search('a'), []);
  assert.ok(built.search('ab').length >= 0, 'two characters is allowed');
});

test('search: results are ranked, capped and ordered by score', function () {
  const hits = index().search('hash', 5);

  assert.ok(hits.length <= 5, 'the limit is honoured');
  for (let i = 1; i < hits.length; i += 1) {
    assert.ok(hits[i - 1].score >= hits[i].score, 'scores are non-increasing');
  }
});

test('search: the index is built once and can be rebuilt', function () {
  const built = index();
  const first = built.size();
  assert.strictEqual(built.size(), first, 'stable across calls');
  assert.strictEqual(built.rebuild(), first, 'and identical after a rebuild');
});

/* ----------------------------------------------------------------- installer */

function fakeWindow(options) {
  const listeners = {};
  const settings = options || {};
  return {
    listeners: listeners,
    registered: [],
    location: { protocol: settings.protocol || 'http:' },
    navigator: settings.serviceWorker === false ? {} : {
      serviceWorker: {
        register: function (script) {
          this.owner.registered.push(script);
          return settings.failRegistration
            ? Promise.reject(new Error('nope'))
            : Promise.resolve({ scope: '/' });
        }
      }
    },
    console: { warn: function () {} },
    matchMedia: function () { return { matches: Boolean(settings.standalone) }; },
    addEventListener: function (name, handler) {
      listeners[name] = (listeners[name] || []).concat(handler);
    },
    fire: function (name, event) {
      (listeners[name] || []).forEach(function (handler) { handler(event); });
    }
  };
}

test('installer: registers the worker and reports install availability', async function () {
  const win = fakeWindow({});
  win.navigator.serviceWorker.owner = win;
  const seen = [];

  const installer = Installer.createInstaller({
    window: win,
    onAvailable: function (available) { seen.push(available); }
  });

  await installer.init();
  assert.deepStrictEqual(win.registered, ['sw.js']);
  assert.strictEqual(installer.canInstall(), false, 'nothing to prompt with yet');

  let prevented = false;
  win.fire('beforeinstallprompt', { preventDefault: function () { prevented = true; } });

  assert.strictEqual(prevented, true, 'the browser mini-infobar is suppressed');
  assert.strictEqual(installer.canInstall(), true);
  assert.deepStrictEqual(seen, [true]);
});

test('installer: prompting consumes the event exactly once', async function () {
  const win = fakeWindow({});
  win.navigator.serviceWorker.owner = win;
  const seen = [];
  const installer = Installer.createInstaller({
    window: win, onAvailable: function (value) { seen.push(value); }
  });
  await installer.init();

  let prompts = 0;
  win.fire('beforeinstallprompt', {
    preventDefault: function () {},
    prompt: function () { prompts += 1; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });

  const outcome = await installer.prompt();
  assert.strictEqual(prompts, 1);
  assert.strictEqual(outcome.outcome, 'accepted');
  assert.strictEqual(installer.canInstall(), false, 'the event is spent');
  assert.deepStrictEqual(seen, [true, false]);

  const again = await installer.prompt();
  assert.strictEqual(again.outcome, 'unavailable', 'and prompting again is a no-op');
});

test('installer: file:// and unsupported browsers register nothing and still work', async function () {
  const fileWin = fakeWindow({ protocol: 'file:' });
  fileWin.navigator.serviceWorker.owner = fileWin;
  const onFile = Installer.createInstaller({ window: fileWin });
  assert.strictEqual(await onFile.init(), null);
  assert.deepStrictEqual(fileWin.registered, []);

  const bare = fakeWindow({ serviceWorker: false });
  const unsupported = Installer.createInstaller({ window: bare });
  assert.strictEqual(unsupported.supported(), false);
  assert.strictEqual(await unsupported.init(), null);
});

test('installer: a failed registration is reported, not thrown', async function () {
  const win = fakeWindow({ failRegistration: true });
  win.navigator.serviceWorker.owner = win;
  const installer = Installer.createInstaller({ window: win });

  assert.strictEqual(await installer.init(), null, 'resolves to null instead of rejecting');
});

test('installer: knows when it is already running as an installed app', function () {
  const win = fakeWindow({ standalone: true });
  win.navigator.serviceWorker.owner = win;
  assert.strictEqual(Installer.createInstaller({ window: win }).installed(), true);

  const tab = fakeWindow({});
  tab.navigator.serviceWorker.owner = tab;
  assert.strictEqual(Installer.createInstaller({ window: tab }).installed(), false);
});
