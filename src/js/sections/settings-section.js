/** Settings page: appearance, progress export/import and reset. */
(function (root) {
  'use strict';

  const SECTION_ID = 'settings';

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID) return;
      render(app);
    });

    app.state.subscribe('progress', function () {
      if (app.navigation.current() === SECTION_ID) root.SettingsView.renderSummary(app);
    });
  }

  function render(app) {
    const $host = root.jQuery('#' + SECTION_ID + '-content');
    $host.html(root.SettingsView.markup());
    root.SettingsView.mount(app);
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
