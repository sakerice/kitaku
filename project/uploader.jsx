/* global React, JSZip, StickerExtractor */
// uploader.jsx
// Drag-and-drop / file-picker UI for turning a multi-sticker sheet into individual
// transparent PNGs with white outlines. Now with an interactive grid editor:
// users can drag column/row dividers and outer margins to fine-tune cell bounds
// before processing. Session-only — refresh wipes results.

const { useState, useRef, useCallback, useEffect, useMemo } = React;

function canvasToBlob(canvas) {
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}

// ── Per-sticker crop editor modal ───────────────────────────────────────────

function CropEditor({ canvas, onConfirm, onCancel }) {
  // Expand canvas with transparent padding so crop lines can reach outside the sticker
  const EXPAND = Math.max(40, Math.round(Math.min(canvas.width, canvas.height) * 0.25));
  const expanded = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = canvas.width + EXPAND * 2;
    c.height = canvas.height + EXPAND * 2;
    c.getContext('2d').drawImage(canvas, EXPAND, EXPAND);
    return c;
  }, [canvas]);

  const W = expanded.width, H = expanded.height;

  // iOS SafariはinnerHeightが不安定なため、幅だけで算出
  const MAXDIM = Math.min(window.innerWidth - 80, 480);
  const scale = Math.min(1, MAXDIM / Math.max(W, H));
  const dispW = Math.round(W * scale);
  const dispH = Math.round(H * scale);

  const imgSrc = useMemo(() => expanded.toDataURL('image/png'), [expanded]);
  // Initial crop = original sticker bounds inside the expanded canvas
  const initCrop = { l: EXPAND, t: EXPAND, r: W - EXPAND, b: H - EXPAND };
  const [crop, setCrop] = useState(initCrop);

  const startDrag = (edge) => (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const sv = crop[edge];
    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      setCrop(prev => {
        const next = { ...prev };
        if (edge === 'l') next.l = Math.max(0, Math.min(Math.round(sv + dx), prev.r - 8));
        if (edge === 'r') next.r = Math.max(prev.l + 8, Math.min(Math.round(sv + dx), W));
        if (edge === 't') next.t = Math.max(0, Math.min(Math.round(sv + dy), prev.b - 8));
        if (edge === 'b') next.b = Math.max(prev.t + 8, Math.min(Math.round(sv + dy), H));
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleConfirm = () => {
    const cw = crop.r - crop.l, ch = crop.b - crop.t;
    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(expanded, crop.l, crop.t, cw, ch, 0, 0, cw, ch);
    onConfirm(out);
  };

  // Handle size: 20px for easier touch on mobile
  const HS = 20;

  return (
    <div style={cropStyles.backdrop} onClick={onCancel}>
      <div style={cropStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={cropStyles.header}>
          <span className="maru" style={{ fontSize: 16, fontWeight: 700 }}>トリミング</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
            {crop.r - crop.l} × {crop.b - crop.t} px
          </span>
        </div>
        <div style={{ ...cropStyles.stageWrap, minHeight: dispH + 64 }}>
          <div
            className="checker"
            style={{ position: 'relative', width: dispW, height: dispH,
                     userSelect: 'none', touchAction: 'none', flexShrink: 0 }}
          >
            <img src={imgSrc} draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                       objectFit: 'fill', pointerEvents: 'none' }}
            />
            {/* Dark overlay outside crop region */}
            <div style={{
              position: 'absolute',
              left: crop.l * scale, top: crop.t * scale,
              width: (crop.r - crop.l) * scale, height: (crop.b - crop.t) * scale,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              border: '1.5px solid rgba(255,255,255,0.9)',
              pointerEvents: 'none',
            }} />
            {/* Drag handles: 20px hit area, clamped within image */}
            {[
              { edge: 'l', s: { left: Math.max(0, crop.l * scale - HS/2), top: 0, bottom: 0, width: HS, cursor: 'ew-resize' },
                           v: { left: HS/2 - 1, top: 0, bottom: 0, width: 2 } },
              { edge: 'r', s: { left: Math.min(dispW - HS, crop.r * scale - HS/2), top: 0, bottom: 0, width: HS, cursor: 'ew-resize' },
                           v: { left: HS/2 - 1, top: 0, bottom: 0, width: 2 } },
              { edge: 't', s: { top: Math.max(0, crop.t * scale - HS/2), left: 0, right: 0, height: HS, cursor: 'ns-resize' },
                           v: { top: HS/2 - 1, left: 0, right: 0, height: 2 } },
              { edge: 'b', s: { top: Math.min(dispH - HS, crop.b * scale - HS/2), left: 0, right: 0, height: HS, cursor: 'ns-resize' },
                           v: { top: HS/2 - 1, left: 0, right: 0, height: 2 } },
            ].map(({ edge, s, v }) => (
              <div key={edge} onPointerDown={startDrag(edge)}
                style={{ position: 'absolute', ...s }}>
                <div style={{ position: 'absolute', background: 'white',
                              boxShadow: '0 0 4px rgba(0,0,0,0.7)', ...v }} />
              </div>
            ))}
          </div>
        </div>
        <div style={cropStyles.footer}>
          <button style={cropStyles.cancelBtn} onClick={onCancel}>キャンセル</button>
          <button style={cropStyles.resetBtn} onClick={() => setCrop(initCrop)}>リセット</button>
          <button style={cropStyles.confirmBtn} onClick={handleConfirm}>確定</button>
        </div>
      </div>
    </div>
  );
}

const cropStyles = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(43,38,32,0.65)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--bg)', border: '1px solid var(--line)',
    borderRadius: 20, overflow: 'hidden',
    maxWidth: 600, width: '100%',
    boxShadow: '0 32px 80px -20px rgba(43,38,32,0.5)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid var(--line)',
  },
  stageWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 32, background: '#1a1612', overflow: 'auto',
  },
  footer: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
    padding: '12px 16px', borderTop: '1px solid var(--line)',
    background: 'var(--card)',
  },
  cancelBtn: {
    padding: '9px 16px', border: '1px solid var(--line)', borderRadius: 999,
    background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)',
  },
  resetBtn: {
    padding: '9px 16px', border: '1px solid var(--line)', borderRadius: 999,
    background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink-2)',
  },
  confirmBtn: {
    padding: '9px 20px', border: 'none', borderRadius: 999,
    background: 'var(--accent)', fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', cursor: 'pointer', color: 'white',
  },
};

// Build evenly-spaced lines across [0, total] with `count`+1 endpoints.
function evenLines(count, total) {
  const out = [];
  for (let i = 0; i <= count; i++) out.push(Math.round((i * total) / count));
  return out;
}

// ── Interactive grid editor ─────────────────────────────────────────────────
// Renders the source image with overlaid draggable lines (the outer margins
// are the first/last entries of xs/ys, so dragging them tightens/loosens the
// crop bounds). Returns absolute pixel positions in source-image coordinates.

function GridEditor({ image, imgW, imgH, rows, cols, xs, ys, setXs, setYs }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const dragRef = useRef(null);

  // Compute display scale from the wrapper width
  useEffect(() => {
    if (!wrapRef.current || !imgW) return;
    const ro = new ResizeObserver(() => {
      const w = wrapRef.current.clientWidth;
      setScale(w / imgW);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [imgW]);

  const dispH = imgH * scale;

  const startDrag = (axis, idx) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startVal = axis === 'x' ? xs[idx] : ys[idx];
    const min = idx === 0 ? 0 : (axis === 'x' ? xs[idx - 1] + 4 : ys[idx - 1] + 4);
    const max = (axis === 'x' ? (idx === xs.length - 1 ? imgW : xs[idx + 1] - 4)
                              : (idx === ys.length - 1 ? imgH : ys[idx + 1] - 4));
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const delta = (axis === 'x' ? dx : dy) / scale;
      const next = Math.max(min, Math.min(max, Math.round(startVal + delta)));
      if (axis === 'x') {
        setXs((prev) => {
          const arr = [...prev];
          arr[idx] = next;
          return arr;
        });
      } else {
        setYs((prev) => {
          const arr = [...prev];
          arr[idx] = next;
          return arr;
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (!image) return null;

  return (
    <div ref={wrapRef} style={{ ...gridStyles.wrap, height: dispH }}>
      <img src={image} alt="" style={gridStyles.img} draggable={false} />
      {/* Cell highlight rectangles */}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <div
            key={`cell-${r}-${c}`}
            style={{
              ...gridStyles.cellRect,
              left: xs[c] * scale,
              top: ys[r] * scale,
              width: (xs[c + 1] - xs[c]) * scale,
              height: (ys[r + 1] - ys[r]) * scale,
            }}
          />
        ))
      )}
      {/* Vertical lines */}
      {xs.map((x, i) => {
        const isEdge = i === 0 || i === xs.length - 1;
        return (
          <div
            key={`vx-${i}`}
            onPointerDown={startDrag('x', i)}
            style={{
              ...gridStyles.vLine,
              left: x * scale,
              background: isEdge ? '#C8654A' : '#2B2620',
            }}
          >
            <span style={{
              ...gridStyles.handle,
              top: dispH / 2 - 12,
              cursor: 'ew-resize',
              background: isEdge ? '#C8654A' : '#2B2620',
            }}>↔</span>
          </div>
        );
      })}
      {/* Horizontal lines */}
      {ys.map((y, i) => {
        const isEdge = i === 0 || i === ys.length - 1;
        return (
          <div
            key={`hy-${i}`}
            onPointerDown={startDrag('y', i)}
            style={{
              ...gridStyles.hLine,
              top: y * scale,
              background: isEdge ? '#C8654A' : '#2B2620',
            }}
          >
            <span style={{
              ...gridStyles.handle,
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'ns-resize',
              background: isEdge ? '#C8654A' : '#2B2620',
            }}>↕</span>
          </div>
        );
      })}
    </div>
  );
}

const gridStyles = {
  wrap: {
    position: 'relative',
    width: '100%',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 14,
    overflow: 'hidden',
    userSelect: 'none',
    touchAction: 'none',
  },
  img: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',
    objectFit: 'fill',
  },
  cellRect: {
    position: 'absolute',
    border: '1px dashed rgba(43,38,32,0.4)',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },
  vLine: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 1,
    cursor: 'ew-resize',
  },
  hLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 1,
    cursor: 'ns-resize',
  },
  handle: {
    position: 'absolute',
    width: 24, height: 24,
    borderRadius: 999,
    color: 'white',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
};

// ── Main uploader component ─────────────────────────────────────────────────

function StickerUploader({ onAddToGallery }) {
  const [imageURL, setImageURL] = useState(null);
  const [imageEl, setImageEl] = useState(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [xs, setXs] = useState([]);
  const [ys, setYs] = useState([]);
  const [tolerance, setTolerance] = useState(80);
  const [bgMode, setBgMode] = useState('auto');
  const [pickedColor, setPickedColor] = useState('#ffffff');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // When image loads, initialize evenly-spaced grid lines
  useEffect(() => {
    if (!imageURL) return;
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      setXs(evenLines(cols, img.naturalWidth));
      setYs(evenLines(rows, img.naturalHeight));
    };
    img.src = imageURL;
  }, [imageURL]);

  // Rebuild grid when row/col counts change
  useEffect(() => {
    if (!imgDims.w) return;
    setXs(evenLines(cols, imgDims.w));
  }, [cols, imgDims.w]);
  useEffect(() => {
    if (!imgDims.h) return;
    setYs(evenLines(rows, imgDims.h));
  }, [rows, imgDims.h]);

  const onPick = (f) => {
    if (!f) return;
    setError(null);
    setResults([]);
    if (imageURL) URL.revokeObjectURL(imageURL);
    setImageURL(URL.createObjectURL(f));
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  };

  const resolveBg = () => {
    if (bgMode === 'white') return [255, 255, 255];
    if (bgMode === 'green') return [40, 200, 90];
    if (bgMode === 'pick') {
      const hex = pickedColor.replace('#', '');
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  };

  const resetGrid = () => {
    if (!imgDims.w) return;
    setXs(evenLines(cols, imgDims.w));
    setYs(evenLines(rows, imgDims.h));
  };

  const run = useCallback(async () => {
    if (!imageEl) return;
    setBusy(true);
    setError(null);
    try {
      const out = await StickerExtractor.extractSheet(imageEl, {
        rows, cols,
        bgColor: resolveBg(),
        tolerance,
        xLines: xs,
        yLines: ys,
      });
      setResults(out.map(r => r.empty ? r : { ...r, originalCanvas: r.canvas, aspect: 'original' }));
    } catch (e) {
      console.error(e);
      setError(e.message || '処理に失敗しました');
    } finally {
      setBusy(false);
    }
  }, [imageEl, rows, cols, tolerance, bgMode, pickedColor, xs, ys]);

  const [cropTarget, setCropTarget] = useState(null);

  const applyCropTo = useCallback(async (idx, croppedCanvas) => {
    const blob = await canvasToBlob(croppedCanvas);
    const url = URL.createObjectURL(blob);
    setResults(prev => {
      const next = [...prev];
      const r = next[idx];
      if (r.url) URL.revokeObjectURL(r.url);
      next[idx] = { ...r, canvas: croppedCanvas, blob, url, width: croppedCanvas.width, height: croppedCanvas.height };
      return next;
    });
    setCropTarget(null);
  }, []);

  const downloadOne = (r, idx) => {
    const a = document.createElement('a');
    a.href = r.url;
    a.download = `extracted_${String(idx + 1).padStart(2, '0')}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder('extracted-stickers');
    let i = 0;
    for (const r of results) {
      if (r.empty) continue;
      i++;
      folder.file(`extracted_${String(i).padStart(2, '0')}.png`, r.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted-stickers.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  };

  const successCount = results.filter((r) => !r.empty).length;

  return (
    <section style={uStyles.wrap}>
      <div style={uStyles.head}>
        <span className="mono" style={uStyles.eyebrow}>SHEET → STICKERS</span>
        <h2 className="maru" style={uStyles.title}>シート画像から自動切り出し</h2>
        <p style={uStyles.lede}>
          複数キャラが並んだ1枚のシート画像をアップロードすると、グリッドに沿って切り出し、背景を透過にして、白フチをつけて個別PNGにします。
          赤いハンドルで外周、黒いハンドルで内側の区切りを<strong>ドラッグして微調整</strong>できます。
        </p>
      </div>

      {!imageURL && (
        <div
          style={uStyles.dropEmpty}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onPick(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
          <div style={uStyles.dropIcon}>＋</div>
          <div style={uStyles.dropPrimary}>シート画像をドロップ または クリックして選択</div>
          <div className="mono" style={uStyles.dropMeta}>PNG / JPG / WEBP</div>
        </div>
      )}

      {imageURL && (
        <div style={uStyles.body}>
          <div style={uStyles.editorCol}>
            <GridEditor
              image={imageURL}
              imgW={imgDims.w}
              imgH={imgDims.h}
              rows={rows}
              cols={cols}
              xs={xs}
              ys={ys}
              setXs={setXs}
              setYs={setYs}
            />
            <div style={uStyles.editorActions}>
              <button style={uStyles.linkBtn} onClick={() => inputRef.current?.click()}>
                別の画像を選ぶ
              </button>
              <button style={uStyles.linkBtn} onClick={resetGrid}>
                グリッドをリセット
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onPick(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
            </div>
            <div className="mono" style={uStyles.dimsLine}>
              {imgDims.w} × {imgDims.h}px / セル {cols}列 × {rows}行
            </div>
          </div>

          <div style={uStyles.controls}>
            <div style={uStyles.controlRow}>
              <label style={uStyles.label}>
                <span className="mono" style={uStyles.labelKey}>ROWS</span>
                <div style={uStyles.stepperWrap}>
                  <button style={uStyles.step} onClick={() => setRows((r) => Math.max(1, r - 1))}>−</button>
                  <span style={uStyles.stepperVal}>{rows}</span>
                  <button style={uStyles.step} onClick={() => setRows((r) => Math.min(8, r + 1))}>+</button>
                </div>
              </label>
              <label style={uStyles.label}>
                <span className="mono" style={uStyles.labelKey}>COLS</span>
                <div style={uStyles.stepperWrap}>
                  <button style={uStyles.step} onClick={() => setCols((c) => Math.max(1, c - 1))}>−</button>
                  <span style={uStyles.stepperVal}>{cols}</span>
                  <button style={uStyles.step} onClick={() => setCols((c) => Math.min(8, c + 1))}>+</button>
                </div>
              </label>
            </div>

            <div style={uStyles.controlRow}>
              <label style={{ ...uStyles.label, flex: 1 }}>
                <span className="mono" style={uStyles.labelKey}>背景色</span>
                <div style={uStyles.bgRow}>
                  {[
                    { v: 'auto', label: '自動' },
                    { v: 'white', label: '白' },
                    { v: 'green', label: '緑' },
                    { v: 'pick', label: '指定' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setBgMode(o.v)}
                      style={{
                        ...uStyles.bgBtn,
                        ...(bgMode === o.v ? uStyles.bgBtnOn : null),
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                  {bgMode === 'pick' && (
                    <input
                      type="color"
                      value={pickedColor}
                      onChange={(e) => setPickedColor(e.target.value)}
                      style={uStyles.colorInput}
                    />
                  )}
                </div>
              </label>
            </div>

            <div style={uStyles.controlRow}>
              <label style={{ ...uStyles.label, flex: 1 }}>
                <span className="mono" style={uStyles.labelKey}>
                  しきい値 <span style={uStyles.toleranceVal}>{tolerance}</span>
                </span>
                <input
                  type="range"
                  min={20}
                  max={200}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  style={uStyles.slider}
                />
                <div className="mono" style={uStyles.hint}>
                  小さいほど厳密 / 大きいほど許容範囲が広い
                </div>
              </label>
            </div>

            <div style={uStyles.actions}>
              <button
                style={{ ...uStyles.run, ...(busy ? uStyles.runDisabled : null) }}
                onClick={run}
                disabled={busy}
              >
                {busy ? '処理中…' : '切り出して処理'}
              </button>
              {successCount > 0 && (
                <button style={uStyles.zipBtn} onClick={downloadZip}>
                  {successCount}個まとめて .zip
                </button>
              )}
            </div>

            {error && <div style={uStyles.error}>{error}</div>}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div style={uStyles.resultsWrap}>
          <div style={uStyles.resultsHead}>
            <span className="mono" style={uStyles.eyebrow}>OUTPUT</span>
            <span className="mono" style={uStyles.resultsCount}>
              {successCount} / {results.length} 抽出成功
            </span>
          </div>
          <div style={uStyles.resultsGrid}>
            {results.map((r, i) =>
              r.empty ? (
                <div key={i} style={uStyles.resultEmpty}>
                  <span className="mono">空</span>
                </div>
              ) : (
                <div key={i} style={uStyles.resultCard}>
                  <div className="checker" style={uStyles.resultThumb}>
                    <img src={r.url} alt={`sticker ${i + 1}`} style={uStyles.resultImg} />
                  </div>
                  <button
                    onClick={() => downloadOne(r, i)}
                    style={uStyles.resultDl}
                    title="ダウンロード"
                  >
                    ↓
                  </button>
                  <span className="mono" style={uStyles.resultMeta}>
                    {r.width}×{r.height}
                  </span>
                  <div style={uStyles.cardFooter}>
                    <button
                      onClick={() => setCropTarget({ idx: i })}
                      style={uStyles.trimBtn}
                    >
                      トリミング
                    </button>
                    {onAddToGallery && (
                      <button
                        onClick={() => onAddToGallery(r)}
                        style={uStyles.addToGalleryBtn}
                      >
                        ＋ 追加
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
          <p style={uStyles.warning}>
            ※ ギャラリーに追加したスタンプはブラウザに保存されます。ダウンロードしておくと別の端末でも使えます。
          </p>
        </div>
      )}
      {cropTarget !== null && results[cropTarget.idx] && !results[cropTarget.idx].empty && (
        <CropEditor
          canvas={results[cropTarget.idx].originalCanvas}
          onConfirm={(c) => applyCropTo(cropTarget.idx, c)}
          onCancel={() => setCropTarget(null)}
        />
      )}
    </section>
  );
}

const uStyles = {
  wrap: {
    maxWidth: 1240,
    margin: '0 auto',
    padding: '60px 32px 40px',
    borderTop: '1px solid var(--line)',
  },
  head: { maxWidth: 720, marginBottom: 32 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.12em',
    color: 'var(--ink-2)',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 40px)',
    fontWeight: 900,
    margin: '8px 0 12px',
    letterSpacing: '-0.01em',
  },
  lede: {
    fontSize: 14,
    lineHeight: 1.8,
    color: 'var(--ink-2)',
    margin: 0,
  },
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1.4fr) minmax(280px, 1fr)',
    gap: 28,
    alignItems: 'start',
  },
  editorCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  editorActions: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: 0,
    textDecoration: 'underline',
  },
  dimsLine: { fontSize: 11, color: 'var(--ink-2)' },
  dropEmpty: {
    minHeight: 280,
    border: '2px dashed var(--line)',
    borderRadius: 20,
    background: 'var(--card)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--ink-2)',
    padding: 40,
  },
  dropIcon: {
    fontSize: 48,
    fontWeight: 200,
    color: 'var(--ink-2)',
    marginBottom: 8,
  },
  dropPrimary: { fontSize: 14, color: 'var(--ink)', fontWeight: 500 },
  dropMeta: { fontSize: 11, color: 'var(--ink-2)', marginTop: 6 },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  controlRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  label: { display: 'flex', flexDirection: 'column', gap: 8 },
  labelKey: {
    fontSize: 11,
    letterSpacing: '0.1em',
    color: 'var(--ink-2)',
    textTransform: 'uppercase',
  },
  toleranceVal: {
    color: 'var(--ink)',
    fontWeight: 600,
    marginLeft: 6,
  },
  stepperWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 999,
    padding: 4,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16,
    fontFamily: 'inherit',
    color: 'var(--ink)',
  },
  stepperVal: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  bgRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  bgBtn: {
    border: '1px solid var(--line)',
    background: 'transparent',
    color: 'var(--ink)',
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  bgBtnOn: {
    background: 'var(--ink)',
    color: 'var(--bg)',
    borderColor: 'var(--ink)',
  },
  colorInput: {
    width: 32,
    height: 32,
    border: '1px solid var(--line)',
    borderRadius: 8,
    cursor: 'pointer',
    padding: 0,
    background: 'transparent',
  },
  slider: { width: '100%', accentColor: 'var(--accent)' },
  hint: { fontSize: 10, color: 'var(--ink-2)' },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  run: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 999,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 6px 18px -8px rgba(200,101,74,0.5)',
  },
  runDisabled: { opacity: 0.4, cursor: 'not-allowed', boxShadow: 'none' },
  zipBtn: {
    background: 'var(--ink)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 999,
    padding: '12px 18px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  error: {
    color: 'var(--accent)',
    fontSize: 12,
    padding: '8px 12px',
    background: 'var(--accent-soft)',
    borderRadius: 8,
  },
  resultsWrap: { marginTop: 40 },
  resultsHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingTop: 24,
    borderTop: '1px solid var(--line)',
  },
  resultsCount: { fontSize: 11, color: 'var(--ink-2)' },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14,
  },
  resultCard: {
    position: 'relative',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  },
  resultThumb: {
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  resultImg: {
    maxWidth: '85%',
    maxHeight: '85%',
    objectFit: 'contain',
  },
  resultDl: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 999,
    border: 'none',
    background: 'var(--ink)',
    color: 'var(--bg)',
    cursor: 'pointer',
    fontSize: 16,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultMeta: {
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 10,
    color: 'var(--ink-2)',
    background: 'rgba(255,252,245,0.85)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  cardFooter: {
    display: 'flex',
    borderTop: '1px solid var(--line)',
  },
  trimBtn: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    borderRight: '1px solid var(--line)',
    background: 'var(--card)',
    color: 'var(--ink-2)',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  addToGalleryBtn: {
    flex: 1,
    padding: '7px 0',
    border: 'none',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  resultEmpty: {
    aspectRatio: '1 / 1',
    border: '1px dashed var(--line)',
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ink-2)',
    fontSize: 11,
  },
  warning: {
    fontSize: 11,
    color: 'var(--ink-2)',
    marginTop: 16,
    lineHeight: 1.6,
  },
};

window.StickerUploader = StickerUploader;
