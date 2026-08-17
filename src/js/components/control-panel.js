/**
 * ControlPanel - a card of controls built from a spec.
 *
 * Sections declare what the learner can change; this builds the markup, reads
 * the values and calls back on change. Without it every section reinvents
 * label/input/readout plumbing, and with ~600 sections planned that is the
 * difference between a template being ten lines and a hundred.
 *
 * Spec entry: { id, kind: 'range'|'select'|'checkbox'|'number'|'button',
 *               label, value, min, max, step, options, suffix, note }
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ControlPanel = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function esc(value) {
    return scope.Helpers.escapeHtml(value);
  }

  function rangeMarkup(control) {
    return '<div class="field-row">' +
      '<label class="field-label" for="' + control.id + '">' + esc(control.label) +
      ': <span id="' + control.id + '-value">' + esc(control.value) + '</span>' +
      (control.suffix ? ' ' + esc(control.suffix) : '') + '</label>' +
      '<input type="range" id="' + control.id + '" min="' + control.min + '" max="' + control.max +
      '" step="' + (control.step || 1) + '" value="' + control.value + '">' +
      note(control) + '</div>';
  }

  function selectMarkup(control) {
    const options = (control.options || []).map(function (option) {
      const selected = option.value === control.value ? ' selected' : '';
      return '<option value="' + esc(option.value) + '"' + selected + '>' + esc(option.label) + '</option>';
    }).join('');
    return '<div class="field-row">' +
      '<label class="field-label" for="' + control.id + '">' + esc(control.label) + '</label>' +
      '<select id="' + control.id + '">' + options + '</select>' + note(control) + '</div>';
  }

  function checkboxMarkup(control) {
    return '<div class="field-row"><label class="field-label" for="' + control.id + '">' +
      '<input type="checkbox" id="' + control.id + '"' + (control.value ? ' checked' : '') + '> ' +
      esc(control.label) + '</label>' + note(control) + '</div>';
  }

  function numberMarkup(control) {
    return '<div class="field-row">' +
      '<label class="field-label" for="' + control.id + '">' + esc(control.label) + '</label>' +
      '<input type="number" id="' + control.id + '" value="' + esc(control.value) + '"' +
      (control.min !== undefined ? ' min="' + control.min + '"' : '') +
      (control.max !== undefined ? ' max="' + control.max + '"' : '') +
      (control.step !== undefined ? ' step="' + control.step + '"' : '') + '>' +
      note(control) + '</div>';
  }

  /** A free-text field. Two sections need one - the trie search box and the
   *  fuzzy-search box - and both want the demo to answer on every keystroke,
   *  so it binds `input` rather than `change`. */
  function textMarkup(control) {
    return '<div class="field-row">' +
      '<label class="field-label" for="' + control.id + '">' + esc(control.label) + '</label>' +
      '<input type="text" id="' + control.id + '" value="' + esc(control.value || '') + '"' +
      (control.placeholder ? ' placeholder="' + esc(control.placeholder) + '"' : '') +
      (control.maxLength ? ' maxlength="' + control.maxLength + '"' : '') +
      ' autocomplete="off" spellcheck="false">' + note(control) + '</div>';
  }

  function buttonMarkup(control) {
    return '<button type="button" class="btn ' + (control.primary ? 'btn-primary' : '') +
      '" id="' + control.id + '" style="margin-right:.375rem;margin-bottom:.375rem">' +
      esc(control.label) + '</button>';
  }

  function note(control) {
    return control.note ? '<p class="note">' + esc(control.note) + '</p>' : '';
  }

  const BUILDERS = {
    range: rangeMarkup, select: selectMarkup, checkbox: checkboxMarkup,
    number: numberMarkup, button: buttonMarkup, text: textMarkup
  };

  function markup(options) {
    const controls = (options.controls || []).map(function (control) {
      return (BUILDERS[control.kind] || selectMarkup)(control);
    }).join('');

    return '<div class="card"><div class="card-header">' + esc(options.title || 'Controls') + '</div>' +
      '<div class="card-body">' + controls + (options.footer || '') + '</div></div>';
  }

  function readOne($, control) {
    const $node = $('#' + control.id);
    if (!$node.length) return control.value;
    if (control.kind === 'checkbox') return $node.is(':checked');
    if (control.kind === 'range' || control.kind === 'number') return Number($node.val());
    return String($node.val());
  }

  /** Binds change handlers and returns { values(), set(id, value), refresh() }. */
  function mount(options) {
    const $ = scope.jQuery;
    const controls = options.controls || [];
    const onChange = options.onChange || function () {};

    function values() {
      return controls.reduce(function (acc, control) {
        if (control.kind !== 'button') acc[control.id] = readOne($, control);
        return acc;
      }, {});
    }

    controls.forEach(function (control) {
      const $node = $('#' + control.id);
      if (!$node.length) return;

      if (control.kind === 'button') {
        $node.on('click', function () { onChange(control.id, null, values()); });
        return;
      }

      const live = control.kind === 'range' || control.kind === 'number' || control.kind === 'text';
      const event = live ? 'input' : 'change';
      $node.on(event, function () {
        const value = readOne($, control);
        if (control.kind === 'range') $('#' + control.id + '-value').text(String(value));
        onChange(control.id, value, values());
      });
    });

    return {
      values: values,
      set: function (id, value) {
        $('#' + id).val(value).trigger('change');
        $('#' + id + '-value').text(String(value));
      },
      disable: function (id, flag) { $('#' + id).prop('disabled', Boolean(flag)); }
    };
  }

  return { markup: markup, mount: mount };
}));
