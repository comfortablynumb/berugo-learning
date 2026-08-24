/**
 * BlockImageView — draws a byte array as a greyscale bitmap.
 *
 * This exists for one argument that no table makes as well: encrypt a picture
 * in ECB and the picture is still there. The bytes are drawn as pixels, so the
 * plaintext, the ECB ciphertext and the CBC ciphertext sit side by side and the
 * eye does the measurement the distinct-block count only quantifies.
 *
 * Greys come from the data itself rather than from the palette — the whole
 * point is that the value at each position is what is being shown — while every
 * chrome colour (frame, caption) comes from the theme variables like anywhere
 * else.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BlockImageView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const GAP = 12;

  function frameColour() {
    if (!scope || !scope.getComputedStyle) return '#888888';
    const value = scope.getComputedStyle(document.documentElement)
      .getPropertyValue('--border').trim();

    return value || '#888888';
  }

  /** One panel: a width × height grid of bytes drawn at `scale` device pixels. */
  function drawPanel(ctx, panel) {
    const image = panel.image;

    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const byte = image.data[y * image.width + x] & 0xff;

        ctx.fillStyle = 'rgb(' + byte + ',' + byte + ',' + byte + ')';
        ctx.fillRect(panel.x + x * panel.scale, panel.y + y * panel.scale,
          panel.scale, panel.scale);
      }
    }
    ctx.strokeStyle = frameColour();
    ctx.lineWidth = 1;
    ctx.strokeRect(panel.x + 0.5, panel.y + 0.5,
      image.width * panel.scale - 1, image.height * panel.scale - 1);
  }

  function labelPanels(ctx, layout) {
    ctx.fillStyle = frameColour();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    layout.panels.forEach(function (panel, index) {
      ctx.fillText(layout.titles[index], panel.x + layout.side / 2, layout.top - 6);
    });
  }

  /** Lay `count` square panels out across the available width. */
  function layoutFor(dims, config) {
    const count = config.images.length;
    const side = Math.max(40, Math.min(config.maxSide || 160,
      Math.floor((dims.width - GAP * (count + 1)) / count)));
    const top = 18;
    const panels = config.images.map(function (image, index) {
      return {
        image: image,
        x: GAP + index * (side + GAP),
        y: top,
        scale: side / image.width
      };
    });

    return { panels: panels, titles: config.titles, side: side, top: top,
      height: top + side + 8 };
  }

  function render(host, config) {
    if (!host) return null;
    const surface = scope.CanvasSurface.create({
      host: host,
      height: config.height || 190,
      ariaLabel: config.ariaLabel || 'the same bytes drawn as a picture, before and after encryption'
    });

    surface.render(function (ctx, dims) {
      const layout = layoutFor(dims, config);

      layout.panels.forEach(function (panel) { drawPanel(ctx, panel); });
      labelPanels(ctx, layout);
    });
    return surface;
  }

  /** How many of the drawn blocks are distinct — the number the picture shows. */
  function distinctBlocks(bytes, blockSize) {
    const seen = new Set();

    for (let i = 0; i + blockSize <= bytes.length; i += blockSize) {
      seen.add(bytes.slice(i, i + blockSize).join(','));
    }
    return seen.size;
  }

  return { render: render, layoutFor: layoutFor, distinctBlocks: distinctBlocks, GAP: GAP };
}));
