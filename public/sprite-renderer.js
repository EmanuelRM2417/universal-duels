/* Universal Duels: 2-view PNG renderer. Pure geometry + browser mounting. */
(function (global) {
  'use strict';
  // Pixel-accurate half selection, with no neighboring-view bleed.
  function frameRect(width, height, view) {
    const mid = Math.floor(width / 2);
    return view === 'back'
      ? { x: mid, y: 0, width: width - mid, height }
      : { x: 0, y: 0, width: mid, height };
  }
  function boundsFor(context, frame) {
    let pixels;
    try { pixels = context.getImageData(frame.x, frame.y, frame.width, frame.height).data; }
    catch { return { x: 0, y: 0, width: frame.width, height: frame.height }; }
    let x0 = frame.width, y0 = frame.height, x1 = -1, y1 = -1;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      if (pixels[(y * frame.width + x) * 4 + 3] <= 8) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < 0) return { x: 0, y: 0, width: frame.width, height: frame.height };
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  }
  function computeLayout(front, back, view, boxWidth, boxHeight) {
    const selected = view === 'back' ? back : front;
    // Use a shared scale across views, so changing perspective doesn't change size.
    const maxWidth = Math.max(1, front.width, back.width);
    const maxHeight = Math.max(1, front.height, back.height);
    const scale = Math.min((boxWidth * .94) / maxWidth, (boxHeight * .94) / maxHeight);
    const width = selected.width * scale, height = selected.height * scale;
    return { x: (boxWidth - width) / 2, y: (boxHeight * .97) - height,
      width, height, scale };
  }
  const cached = new Map();
  function decoded(url) {
    if (!cached.has(url)) {
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const source = document.createElement('canvas');
          source.width = image.naturalWidth; source.height = image.naturalHeight;
          const ctx = source.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(image, 0, 0);
          const front = frameRect(source.width, source.height, 'front');
          const back = frameRect(source.width, source.height, 'back');
          resolve({ source, frames: { front: {...front, bounds: boundsFor(ctx, front)}, back: {...back, bounds: boundsFor(ctx, back)} } });
        };
        image.onerror = () => reject(new Error('No se pudo cargar el PNG del personaje.'));
        image.src = url;
      });
      cached.set(url, promise);
      promise.catch(() => cached.delete(url));
    }
    return cached.get(url);
  }
  async function renderWindow(win) {
    const img = win.querySelector('.battle-sprite-sheet');
    if (!img) return;
    const url = img.getAttribute('src');
    if (!url) return;
    img.style.visibility = 'hidden';
    const view = win.dataset.view || (win.closest('.battle-unit')?.classList.contains('player') ? 'back' : 'front');
    try {
      const asset = await decoded(url);
      if (!win.isConnected || !img.isConnected) return;
      const width = win.clientWidth || 190, height = win.clientHeight || 190;
      const canvas = document.createElement('canvas');
      canvas.className = 'ud-sprite-rendered';
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      const {front,back} = asset.frames;
      const rect = asset.frames[view];
      const l = computeLayout(front.bounds,back.bounds,view,canvas.width,canvas.height);
      ctx.drawImage(asset.source,rect.x+rect.bounds.x,rect.y+rect.bounds.y,rect.bounds.width,rect.bounds.height,
        Math.round(l.x),Math.round(l.y),Math.max(1,Math.round(l.width)),Math.max(1,Math.round(l.height)));
      // Apply status tint to the exact visible pixels, never the entire bounding square.
      if (win.style.getPropertyValue('--sprite-mask')) {
        try {
          win.style.setProperty('--sprite-mask', `url("${canvas.toDataURL('image/png')}")`);
          win.style.setProperty('--mask-pos', 'center');
        } catch { /* An image failing canvas security is never a reason to hide the sprite. */ }
      }
      img.style.display = 'none';
      win.querySelector('.ud-sprite-rendered')?.remove();
      win.append(canvas);
    } catch { img.style.visibility = 'visible'; /* Keep the original image as a fallback. */ }
  }
  function mount(root = document) {
    for (const win of root.querySelectorAll('.battle-sprite-window,.ud-sprite-preview')) renderWindow(win);
  }
  global.UDSprites = { mount, frameRect, computeLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = { frameRect, computeLayout };
})(typeof window === 'undefined' ? globalThis : window);
