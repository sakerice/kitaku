/* global React */
// extractor.jsx
// Browser-side sticker sheet → individual transparent PNGs with a white outline.
//
// Pipeline:
//   1. Drop image onto a canvas.
//   2. Slice into a grid (rows × cols).
//   3. For each cell:
//      a. Flood-fill from the 4 edges to mark "background" pixels.
//         Background match uses LAB-ish distance with a tolerance — works for
//         pure white sheets, off-white AI-generated sheets, and green-screen.
//      b. Make those background pixels fully transparent; soften the boundary
//         with a 1px alpha feather so the edge isn't aliased.
//      c. Trim to opaque bounding box (with a small padding so the outline fits).
//      d. Add a white outline by dilating the alpha mask N pixels and painting
//         white where the dilation grew but the original was empty.
//   4. Return a Blob per cell.
//
// All work is sync canvas math; no workers (sheets are small).

const STICKER_OUTLINE_RATIO = 0.031; // ~3% of the cell's max dimension (matches existing 13/421)

// ─── color helpers ──────────────────────────────────────────────────────────

function colorDist(r1, g1, b1, r2, g2, b2) {
  // Weighted RGB distance, "redmean" — cheap perceptual approx.
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  );
}

// Sample the corners + edge midpoints to detect background color automatically.
function detectBgColor(imgData) {
  const { data, width, height } = imgData;
  const samples = [];
  const pts = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  for (const [x, y] of pts) {
    const i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  // Most common cluster (simple averaging — corners are usually consistent)
  const r = samples.reduce((s, p) => s + p[0], 0) / samples.length;
  const g = samples.reduce((s, p) => s + p[1], 0) / samples.length;
  const b = samples.reduce((s, p) => s + p[2], 0) / samples.length;
  return [Math.round(r), Math.round(g), Math.round(b)];
}

// ─── per-cell processing ────────────────────────────────────────────────────

// Returns a new ImageData where bg-matching pixels (reachable from edges) have
// alpha 0, and edge pixels have a soft alpha based on color distance.
function removeBackground(imgData, bgRGB, tolerance) {
  const { data, width, height } = imgData;
  const out = new Uint8ClampedArray(data); // copy
  const visited = new Uint8Array(width * height);

  // Distance map: how close each pixel's color is to bg (0 = exact bg, ≥1 = far)
  const closeness = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const dist = colorDist(data[o], data[o + 1], data[o + 2], bgRGB[0], bgRGB[1], bgRGB[2]);
    closeness[i] = dist; // 0…~764
  }

  // Flood-fill from all edge pixels that are within tolerance.
  const stack = [];
  const seedTol = tolerance * 1.0;
  function trySeed(x, y) {
    const idx = y * width + x;
    if (visited[idx]) return;
    if (closeness[idx] <= seedTol) {
      stack.push(idx);
      visited[idx] = 1;
    }
  }
  for (let x = 0; x < width; x++) { trySeed(x, 0); trySeed(x, height - 1); }
  for (let y = 0; y < height; y++) { trySeed(0, y); trySeed(width - 1, y); }

  // 4-conn flood. Looser tolerance during expansion to handle gradients.
  const expandTol = tolerance * 1.4;
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width, y = (idx / width) | 0;
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < width - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - width);
    if (y < height - 1) neighbors.push(idx + width);
    for (const n of neighbors) {
      if (!visited[n] && closeness[n] <= expandTol) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }

  // Apply: visited pixels → alpha 0. Pixels close to bg but not visited (interior
  // light shadows) keep their alpha. Soften the boundary: any visited pixel that
  // borders an unvisited pixel gets a partial alpha based on closeness.
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (visited[i]) {
      // soft edge: if closeness is within (tolerance, expandTol], and a neighbor
      // is non-bg, keep some alpha.
      const x = i % width, y = (i / width) | 0;
      let touchesFg = false;
      if (x > 0 && !visited[i - 1]) touchesFg = true;
      else if (x < width - 1 && !visited[i + 1]) touchesFg = true;
      else if (y > 0 && !visited[i - width]) touchesFg = true;
      else if (y < height - 1 && !visited[i + width]) touchesFg = true;
      if (touchesFg) {
        // closeness ranges 0..expandTol — map to alpha 0..0.6 outward
        const t = Math.min(1, closeness[i] / expandTol);
        out[o + 3] = Math.round(t * 160); // soft up to ~60%
      } else {
        out[o + 3] = 0;
      }
    }
  }
  return new ImageData(out, width, height);
}

// Find opaque bounding box (alpha >= threshold).
function opaqueBBox(imgData, alphaThreshold = 16) {
  const { data, width, height } = imgData;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// Crop and pad: returns a new ImageData of size (w + 2*pad) × (h + 2*pad)
// with the bbox content centered inside, surrounded by transparent pixels.
function cropPad(imgData, bbox, pad) {
  const newW = bbox.w + 2 * pad;
  const newH = bbox.h + 2 * pad;
  const c = document.createElement('canvas');
  c.width = imgData.width;
  c.height = imgData.height;
  c.getContext('2d').putImageData(imgData, 0, 0);

  const c2 = document.createElement('canvas');
  c2.width = newW;
  c2.height = newH;
  const ctx2 = c2.getContext('2d');
  ctx2.drawImage(c, bbox.x, bbox.y, bbox.w, bbox.h, pad, pad, bbox.w, bbox.h);
  return ctx2.getImageData(0, 0, newW, newH);
}

// Add a white outline of `radius` pixels by dilating the alpha mask.
// Uses a 2-pass separable distance transform-ish (chebyshev), good enough.
function addWhiteOutline(imgData, radius) {
  const { data, width, height } = imgData;
  const W = width, H = height;
  // Build binary opaque mask
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] >= 64) mask[i] = 1;
  }
  // Distance to nearest opaque pixel via two-pass approximation (Chebyshev)
  const INF = 1e6;
  const dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = mask[i] ? 0 : INF;
  // Forward pass
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let m = dist[i];
      if (x > 0) m = Math.min(m, dist[i - 1] + 1);
      if (y > 0) m = Math.min(m, dist[i - W] + 1);
      if (x > 0 && y > 0) m = Math.min(m, dist[i - W - 1] + 1.41421);
      if (x < W - 1 && y > 0) m = Math.min(m, dist[i - W + 1] + 1.41421);
      dist[i] = m;
    }
  }
  // Backward pass
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let m = dist[i];
      if (x < W - 1) m = Math.min(m, dist[i + 1] + 1);
      if (y < H - 1) m = Math.min(m, dist[i + W] + 1);
      if (x < W - 1 && y < H - 1) m = Math.min(m, dist[i + W + 1] + 1.41421);
      if (x > 0 && y < H - 1) m = Math.min(m, dist[i + W - 1] + 1.41421);
      dist[i] = m;
    }
  }

  // Composite white where 0 < dist <= radius. Original opaque pixels stay on top.
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < W * H; i++) {
    const d = dist[i];
    if (d > 0 && d <= radius) {
      const o = i * 4;
      // soft falloff in the last 1.5px so the outline edge doesn't alias
      const edgeFalloff = Math.min(1, radius - d + 0.5);
      const a = Math.round(255 * Math.min(1, edgeFalloff));
      // place white underneath any existing alpha; here pixel was empty so just set.
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = a;
    }
  }
  return new ImageData(out, W, H);
}

// ─── full pipeline for one cell ─────────────────────────────────────────────

function processCell(srcCanvas, sx, sy, sw, sh, opts) {
  const cell = document.createElement('canvas');
  cell.width = sw;
  cell.height = sh;
  const ctx = cell.getContext('2d');
  ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  let imgData = ctx.getImageData(0, 0, sw, sh);

  // Detect or use provided bg color
  const bg = opts.bgColor || detectBgColor(imgData);
  imgData = removeBackground(imgData, bg, opts.tolerance);

  // Use a higher threshold so the soft edge fade doesn't pull the bbox outward
  // — the outline is rebuilt later from the firm-alpha mask anyway.
  const bbox = opaqueBBox(imgData, 96);
  if (!bbox) return null; // empty cell

  // Reject tiny artifacts (< 12% of cell) — likely just noise
  const minSide = Math.min(sw, sh);
  if (bbox.w < minSide * 0.12 && bbox.h < minSide * 0.12) return null;

  // Pad enough for the outline + a touch of breathing room
  const outlineRadius = Math.max(2, Math.round(Math.max(bbox.w, bbox.h) * STICKER_OUTLINE_RATIO));
  const pad = outlineRadius + 4;
  const padded = cropPad(imgData, bbox, pad);
  const withOutline = addWhiteOutline(padded, outlineRadius);

  // Render to a canvas blob
  const out = document.createElement('canvas');
  out.width = withOutline.width;
  out.height = withOutline.height;
  out.getContext('2d').putImageData(withOutline, 0, 0);
  return out;
}

function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

// ─── extract a sheet ────────────────────────────────────────────────────────

async function extractSheet(image, { rows, cols, bgColor, tolerance, xLines, yLines }) {
  const W = image.naturalWidth || image.width;
  const H = image.naturalHeight || image.height;
  const src = document.createElement('canvas');
  src.width = W;
  src.height = H;
  src.getContext('2d').drawImage(image, 0, 0);

  // xLines: array of length (cols+1) with x positions in [0..W], sorted ascending.
  // yLines: array of length (rows+1) with y positions in [0..H], sorted ascending.
  // If not provided, fall back to a uniform grid.
  let xs = xLines;
  let ys = yLines;
  if (!xs || xs.length !== cols + 1) {
    xs = [];
    for (let i = 0; i <= cols; i++) xs.push(Math.round((i * W) / cols));
  }
  if (!ys || ys.length !== rows + 1) {
    ys = [];
    for (let i = 0; i <= rows; i++) ys.push(Math.round((i * H) / rows));
  }

  const results = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = Math.max(0, Math.min(W - 1, Math.round(xs[c])));
      const sy = Math.max(0, Math.min(H - 1, Math.round(ys[r])));
      const ex = Math.max(sx + 1, Math.min(W, Math.round(xs[c + 1])));
      const ey = Math.max(sy + 1, Math.min(H, Math.round(ys[r + 1])));
      const sw = ex - sx;
      const sh = ey - sy;
      const canvas = processCell(src, sx, sy, sw, sh, { bgColor, tolerance });
      if (!canvas) {
        results.push({ row: r, col: c, empty: true });
        continue;
      }
      const blob = await canvasToBlob(canvas);
      const url = URL.createObjectURL(blob);
      results.push({
        row: r, col: c,
        blob, url, canvas,
        width: canvas.width, height: canvas.height,
      });
    }
  }
  return results;
}

window.StickerExtractor = { extractSheet, detectBgColor };
