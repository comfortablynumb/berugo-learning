/**
 * Tooltip - one absolutely-positioned node per chart host.
 *
 * Charts share this rather than each inventing a hover panel, so the styling,
 * the edge clamping and the pointer-events behaviour are decided once.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Tooltip = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function attach(host) {
    if (!host) throw new Error('Tooltip.attach requires a host element');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const node = document.createElement('div');
    node.className = 'chart-tooltip';
    host.appendChild(node);

    function show(text, x, y) {
      node.textContent = text;
      node.classList.add('visible');
      const bounds = host.getBoundingClientRect();
      const width = node.offsetWidth;
      const left = Math.min(Math.max(4, x + 12), Math.max(4, bounds.width - width - 4));
      node.style.left = left + 'px';
      node.style.top = Math.max(4, y - 8) + 'px';
      return node;
    }

    function hide() {
      node.classList.remove('visible');
      return node;
    }

    function destroy() {
      if (node.parentNode) node.parentNode.removeChild(node);
    }

    return { show: show, hide: hide, destroy: destroy, node: node };
  }

  return { attach: attach };
}));
