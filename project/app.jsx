/* global React, ReactDOM, JSZip, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showChecker": true,
  "cardBg": "cream",
  "defaultSize": "original",
  "showCaptions": true
} /*EDITMODE-END*/;

// --- Data ---
const STICKERS = [
// sheet 1
{ sheet: 1, idx: 1, id: 'mukattemasu', caption: 'むかってます…', mood: '仕事' },
{ sheet: 1, idx: 2, id: 'arigatou', caption: 'ありがとうございます', mood: '感謝' },
{ sheet: 1, idx: 3, id: 'ryoukai', caption: '了解…です…', mood: '返事' },
{ sheet: 1, idx: 4, id: 'sumimasen', caption: 'すみません…', mood: '謝罪' },
{ sheet: 1, idx: 6, id: 'tadaima', caption: 'ただいま…', mood: '日常' },
{ sheet: 1, idx: 7, id: 'oyasumi', caption: 'おやすみ…', mood: '日常' },
{ sheet: 1, idx: 8, id: 'ganbarimasu', caption: 'がんばります…', mood: '仕事' },
// sheet 2
{ sheet: 2, idx: 1, id: 'genkai', caption: '限界…です…', mood: '弱音' },
{ sheet: 2, idx: 2, id: 'shoushou-omachi', caption: '少々お待ちを…', mood: '返事' },
{ sheet: 2, idx: 3, id: 'kakunin', caption: '確認します…', mood: '仕事' },
{ sheet: 2, idx: 4, id: 'okuremasu', caption: '遅れます…', mood: '仕事' },
{ sheet: 2, idx: 5, id: 'sakini-shitsurei', caption: '先に失礼します…', mood: '仕事' },
{ sheet: 2, idx: 6, id: 'furo-cancel', caption: '風呂キャン', mood: '日常' },
{ sheet: 2, idx: 7, id: 'gohan-oishii', caption: 'ご飯おいしい…', mood: '日常' },
{ sheet: 2, idx: 8, id: 'seiippai', caption: '精一杯…', mood: '弱音' },
// sheet 3
{ sheet: 3, idx: 1, id: 'mata-ashita', caption: 'また明日…', mood: '仕事' },
{ sheet: 3, idx: 2, id: 'mou-muri', caption: 'もう…むり', mood: '弱音' },
{ sheet: 3, idx: 3, id: 'yurushite', caption: 'ゆるして', mood: '謝罪' },
{ sheet: 3, idx: 4, id: 'ganbattemasu', caption: 'がんばってます…', mood: '仕事' },
{ sheet: 3, idx: 5, id: 'gomennasai', caption: 'ごめんなさい…', mood: '謝罪' },
{ sheet: 3, idx: 6, id: 'yasumimasu', caption: '休みます…', mood: '日常' },
{ sheet: 3, idx: 7, id: 'tasukarimasu', caption: 'たすかります…', mood: '感謝' },
{ sheet: 3, idx: 8, id: 'nemui', caption: 'ねむい…', mood: '日常' },
// sheet 4 — alternate poses
{ sheet: 4, idx: 2, id: 'arigatou-v2', caption: 'ありがとうございます', mood: '感謝' },
{ sheet: 4, idx: 3, id: 'ryoukai-v2', caption: '了解…です…', mood: '返事' },
{ sheet: 4, idx: 6, id: 'tadaima-v2', caption: 'ただいま…', mood: '日常' },
{ sheet: 4, idx: 7, id: 'oyasumi-v2', caption: 'おやすみ…', mood: '日常' },
{ sheet: 4, idx: 8, id: 'ganbarimasu-v2', caption: 'がんばります…', mood: '仕事' },
{ sheet: 4, idx: 9, id: 'mou-muri-v2', caption: 'もう…むり', mood: '弱音' }];


const ASSET_VERSION = 'v4';
const stickerPath = (s) => s.isCustom ? s.url : `stickers/${s.sheet}_${String(s.idx).padStart(2, '0')}_${s.id}.png?${ASSET_VERSION}`;
const stickerFilename = (s, size) => {
  const sz = size === 'original' ? '' : `_${size}`;
  if (s.isCustom) return `${s.customId}${sz}.png`;
  return `${String(s.sheet)}_${String(s.idx).padStart(2, '0')}_${s.id}${sz}.png`;
};

const MOODS = ['すべて', '仕事', '日常', '感謝', '謝罪', '弱音', '返事', 'カスタム'];
const SIZES = [
{ value: 'original', label: 'オリジナル' },
{ value: '512', label: '512px' },
{ value: '256', label: '256px' }];


// --- Utilities ---
async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeToBlob(src, targetMax) {
  const img = await loadImage(src);
  if (!targetMax || targetMax === 'original') {
    // Just refetch as blob
    const r = await fetch(src);
    return await r.blob();
  }
  const max = parseInt(targetMax, 10);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement('canvas');
  c.width = w;c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise((res) => c.toBlob(res, 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// --- Components ---

function Hero({ onDownloadAll, downloading, progress, total }) {
  return (
    <header style={heroStyles.wrap}>
      <div style={heroStyles.inner}>
        <div style={heroStyles.eyebrowRow}>
          <span style={heroStyles.eyebrow} className="mono">FREE STICKER PACK / v1.0</span>
          <span style={heroStyles.dot}></span>
          <span style={heroStyles.eyebrow} className="mono">{STICKERS.length} STICKERS · PNG · 透過</span>
        </div>
        <h1 className="maru" style={{ ...heroStyles.title, borderStyle: "solid", borderRadius: "0px", borderWidth: "0px", padding: "0px", opacity: "1.08", gap: "3px" }}>
          きたくったりん
          <span style={heroStyles.titleSub}>KITAKUTTARIN STAMP</span>
        </h1>
        <p style={heroStyles.lede}>
          ネクタイをしめたまま、ちょっと疲れたあの子の<br />
          スタンプ24種を、背景透過のPNGで配布します。
        </p>
        <div style={heroStyles.ctaRow}>
          <button
            style={{ ...heroStyles.cta, ...(downloading ? heroStyles.ctaBusy : null) }}
            onClick={onDownloadAll}
            disabled={downloading}>
            
            {downloading ?
            <>
                <span className="mono" style={{ fontSize: 13 }}>圧縮中… {progress}/{total}</span>
              </> :

            <>
                <DownloadIcon /> ぜんぶダウンロード <span style={heroStyles.ctaMeta} className="mono">.zip</span>
              </>
            }
          </button>
          <a href="#gallery" style={heroStyles.ctaGhost}>1枚ずつ見る ↓</a>
        </div>
        <dl style={heroStyles.metaGrid}>
          <div style={heroStyles.metaCell}>
            <dt className="mono" style={heroStyles.metaKey}>ライセンス</dt>
            <dd style={heroStyles.metaVal}>個人利用OK</dd>
          </div>
          <div style={heroStyles.metaCell}>
            <dt className="mono" style={heroStyles.metaKey}>形式</dt>
            <dd style={heroStyles.metaVal}>PNG / アルファ付き</dd>
          </div>
          <div style={heroStyles.metaCell}>
            <dt className="mono" style={heroStyles.metaKey}>サイズ</dt>
            <dd style={heroStyles.metaVal}>原寸 〜 約420px</dd>
          </div>
          <div style={heroStyles.metaCell}>
            <dt className="mono" style={heroStyles.metaKey}>更新</dt>
            <dd style={heroStyles.metaVal}>2026.04</dd>
          </div>
        </dl>
      </div>
      <div style={heroStyles.peekRow} aria-hidden="true">
        {[0, 5, 13, 17, 21].map((i) =>
        <img key={i} src={stickerPath(STICKERS[i])} style={heroStyles.peek} alt="" />
        )}
      </div>
    </header>);

}

function FilterBar({ mood, setMood, query, setQuery, size, setSize, count, total }) {
  return (
    <div style={filterStyles.wrap} id="gallery">
      <div style={filterStyles.row}>
        <div style={filterStyles.searchWrap}>
          <SearchIcon />
          <input
            type="search"
            placeholder="セリフで検索 (例: ねむい)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={filterStyles.search} />
          
        </div>
        <div style={filterStyles.sizeWrap}>
          <span className="mono" style={filterStyles.sizeLabel}>SIZE</span>
          {SIZES.map((s) =>
          <button
            key={s.value}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => { setSize(s.value); e.currentTarget.blur(); }}
            style={{
              ...filterStyles.sizeBtn,
              ...(size === s.value ? filterStyles.sizeBtnOn : null)
            }}>

              {s.label}
            </button>
          )}
        </div>
      </div>
      <div style={filterStyles.chipRow}>
        {MOODS.map((m) =>
        <button
          key={m}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => { setMood(m); e.currentTarget.blur(); }}
          style={{
            ...filterStyles.chip,
            ...(mood === m ? filterStyles.chipOn : null)
          }}>

            {m}
          </button>
        )}
        <span style={filterStyles.spacer}></span>
        <span className="mono" style={filterStyles.count}>{count} / {total}</span>
      </div>
    </div>);

}

function StickerCard({ sticker, size, showChecker, cardBg, showCaption, onOpen, onDownload, onDelete }) {
  const path = stickerPath(sticker);
  const bgClass = showChecker ? 'checker' : '';
  const bgStyle = !showChecker ?
  cardBg === 'green' ? { background: '#22C55E' } :
  cardBg === 'dark' ? { background: '#2B2620' } :
  cardBg === 'pink' ? { background: '#F0D6CB' } :
  { background: 'var(--card)' } :
  null;

  return (
    <article style={cardStyles.wrap}>
      {sticker.isCustom && onDelete && (
        <button
          style={cardStyles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(sticker.customId); }}
          title="削除">
          ×
        </button>
      )}
      <button
        className={bgClass}
        style={{ ...cardStyles.thumb, ...bgStyle }}
        onClick={() => onOpen(sticker)}
        aria-label={`${sticker.caption} を拡大`}>

        <img src={path} alt={sticker.caption} style={cardStyles.img} />
        <span style={cardStyles.zoom}><ZoomIcon /></span>
      </button>
      <div style={cardStyles.meta}>
        <div style={cardStyles.metaText}>
          {showCaption && <div className="maru" style={cardStyles.caption}>{sticker.caption}</div>}
          <div style={cardStyles.subline}>
            <span className="mono" style={cardStyles.id}>
              {sticker.isCustom ? sticker.customId : `${String(sticker.sheet)}-${String(sticker.idx).padStart(2, '0')}`}
            </span>
            <span style={cardStyles.tag}>{sticker.mood}</span>
          </div>
        </div>
        <button
          onClick={(e) => {e.stopPropagation();onDownload(sticker, size);}}
          style={cardStyles.dlBtn}
          title={`${sticker.caption} をダウンロード`}>

          <DownloadIcon />
        </button>
      </div>
    </article>);

}

function StickerModal({ sticker, size, onClose, onDownload, onCopy, copyState, showChecker }) {
  useEffect(() => {
    const onKey = (e) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!sticker) return null;
  const path = stickerPath(sticker);

  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <div style={modalStyles.card} onClick={(e) => e.stopPropagation()}>
        <button style={modalStyles.close} onClick={onClose} aria-label="閉じる">×</button>
        <div className={showChecker ? 'checker' : ''} style={{ ...modalStyles.stage, background: showChecker ? undefined : 'var(--card)' }}>
          <img src={path} alt={sticker.caption} style={modalStyles.img} />
        </div>
        <div style={modalStyles.info}>
          <div style={modalStyles.infoTop}>
            <div>
              <div className="mono" style={modalStyles.infoId}>STICKER {String(sticker.sheet)}-{String(sticker.idx).padStart(2, '0')}</div>
              <h2 className="maru" style={modalStyles.infoTitle}>{sticker.caption}</h2>
            </div>
            <span style={modalStyles.infoTag}>{sticker.mood}</span>
          </div>
          <div style={modalStyles.actions}>
            <div style={modalStyles.sizePicker}>
              {SIZES.map((s) =>
              <button
                key={s.value}
                onClick={() => onDownload(sticker, s.value)}
                style={modalStyles.sizeChoice}>
                
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>ダウンロード</span>
                </button>
              )}
            </div>
            <button
              style={modalStyles.copyBtn}
              onClick={() => onCopy(sticker)}>
              
              {copyState === 'copied' ? '✓ コピーしました' :
              copyState === 'error' ? 'コピー非対応…' :
              'クリップボードにコピー'}
            </button>
          </div>
        </div>
      </div>
    </div>);

}

function Footer() {
  return (
    <footer style={footerStyles.wrap}>
      <div style={footerStyles.inner}>
        <div className="maru" style={footerStyles.brand}>帰宅スタンプ</div>
        <p style={footerStyles.note}>
          すべての画像は背景透過PNGで配布しています。<br />
          チャットアプリ・SNS・社内資料などでご自由にお使いください。<br />
          二次配布・再販売・素材集への収録はご遠慮ください。
        </p>
        <p className="mono" style={footerStyles.foot}>
          © 2026 kitaku-stamp · made with care
        </p>
      </div>
    </footer>);

}

// --- Icons ---
const DownloadIcon = () =>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><path d="m6 11 6 6 6-6" /><path d="M5 21h14" />
  </svg>;

const ZoomIcon = () =>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 8V3h5" /><path d="M21 8V3h-5" /><path d="M3 16v5h5" /><path d="M21 16v5h-5" />
  </svg>;

const SearchIcon = () =>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>;


// --- Main App ---
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [mood, setMood] = useState('すべて');
  const [query, setQuery] = useState('');
  const [size, setSize] = useState(tweaks.defaultSize);
  const [open, setOpen] = useState(null);
  const [copyState, setCopyState] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [customStickers, setCustomStickers] = useState([]);
  const customCounter = useRef(0);

  const handleDeleteCustom = useCallback((customId) => {
    setCustomStickers(prev => prev.filter(s => s.customId !== customId));
  }, []);

  const handleAddToGallery = useCallback((extracted) => {
    const id = `custom_${++customCounter.current}`;
    const freshUrl = URL.createObjectURL(extracted.blob);
    setCustomStickers(prev => [...prev, {
      customId: id,
      id,
      caption: `カスタム ${customCounter.current}`,
      mood: 'カスタム',
      url: freshUrl,
      isCustom: true,
      width: extracted.width,
      height: extracted.height,
    }]);
    setMood('カスタム');
    setTimeout(() => document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const allStickers = useMemo(() => [...STICKERS, ...customStickers], [customStickers]);

  // sync size when tweak default changes
  useEffect(() => {setSize(tweaks.defaultSize);}, [tweaks.defaultSize]);

  const filtered = useMemo(() => {
    return allStickers.filter((s) => {
      if (mood !== 'すべて' && s.mood !== mood) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!s.caption.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [mood, query, allStickers]);

  const handleDownload = useCallback(async (sticker, sz) => {
    try {
      const blob = await resizeToBlob(stickerPath(sticker), sz);
      downloadBlob(blob, stickerFilename(sticker, sz));
    } catch (e) {console.error(e);}
  }, []);

  const handleCopy = useCallback(async (sticker) => {
    try {
      const blob = await resizeToBlob(stickerPath(sticker), 'original');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopyState('copied');
      setTimeout(() => setCopyState(null), 1600);
    } catch (e) {
      console.warn(e);
      setCopyState('error');
      setTimeout(() => setCopyState(null), 1600);
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    setProgress(0);
    try {
      const zip = new JSZip();
      const folder = zip.folder('kitaku-stamp');
      for (let i = 0; i < STICKERS.length; i++) {
        const s = STICKERS[i];
        const blob = await resizeToBlob(stickerPath(s), size);
        folder.file(stickerFilename(s, size), blob);
        setProgress(i + 1);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `kitaku-stamp_${size}.zip`);
    } catch (e) {
      console.error(e);
      alert('ダウンロードに失敗しました');
    } finally {
      setDownloading(false);
      setProgress(0);
    }
  }, [size]);

  return (
    <>
      <Hero
        onDownloadAll={handleDownloadAll}
        downloading={downloading}
        progress={progress}
        total={STICKERS.length} />
      
      <main style={mainStyles.wrap}>
        <FilterBar
          mood={mood} setMood={setMood}
          query={query} setQuery={setQuery}
          size={size} setSize={setSize}
          count={filtered.length}
          total={allStickers.length} />
        
        <div style={mainStyles.grid}>
          {filtered.map((s) =>
          <StickerCard
            key={s.isCustom ? s.customId : `${s.sheet}-${s.idx}`}
            sticker={s}
            size={size}
            showChecker={tweaks.showChecker}
            cardBg={tweaks.cardBg}
            showCaption={tweaks.showCaptions}
            onOpen={setOpen}
            onDownload={handleDownload}
            onDelete={handleDeleteCustom} />

          )}
          {filtered.length === 0 &&
          <div style={mainStyles.empty}>
              <p className="maru" style={{ fontSize: 22, margin: 0 }}>該当するスタンプがありません…</p>
              <p className="mono" style={{ color: 'var(--ink-2)', fontSize: 13, marginTop: 8 }}>filter / search を見直してください</p>
            </div>
          }
        </div>
      </main>
      <StickerUploader onAddToGallery={handleAddToGallery} />
      <Footer />

      {open &&
      <StickerModal
        sticker={open}
        size={size}
        onClose={() => setOpen(null)}
        onDownload={handleDownload}
        onCopy={handleCopy}
        copyState={copyState}
        showChecker={tweaks.showChecker} />

      }

      <TweaksPanel title="Tweaks">
        <TweakSection label="表示">
          <TweakToggle label="透過チェッカー" value={tweaks.showChecker} onChange={(v) => setTweak('showChecker', v)} />
          <TweakToggle label="セリフを表示" value={tweaks.showCaptions} onChange={(v) => setTweak('showCaptions', v)} />
          <TweakRadio label="カード背景 (チェッカーOFF時)" value={tweaks.cardBg} onChange={(v) => setTweak('cardBg', v)} options={[
          { value: 'cream', label: 'クリーム' },
          { value: 'pink', label: 'ピンク' },
          { value: 'green', label: 'グリーン' },
          { value: 'dark', label: 'ダーク' }]
          } />
        </TweakSection>
        <TweakSection label="ダウンロード">
          <TweakRadio label="既定サイズ" value={tweaks.defaultSize} onChange={(v) => setTweak('defaultSize', v)} options={[
          { value: 'original', label: 'オリジナル' },
          { value: '512', label: '512px' },
          { value: '256', label: '256px' }]
          } />
        </TweakSection>
      </TweaksPanel>
    </>);

}

// --- Styles ---

const heroStyles = {
  wrap: {
    padding: '56px 32px 40px',
    background: 'linear-gradient(180deg, #FAF6EE 0%, #F5EEDD 100%)',
    borderBottom: '1px solid var(--line)',
    position: 'relative',
    overflow: 'hidden'
  },
  inner: { maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 2 },
  eyebrowRow: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 },
  eyebrow: {
    fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-2)',
    textTransform: 'uppercase'
  },
  dot: { width: 4, height: 4, borderRadius: 4, background: 'var(--accent)' },
  title: {
    fontSize: 'clamp(56px, 9vw, 112px)',
    fontWeight: 900,
    margin: 0,
    lineHeight: 0.95,
    letterSpacing: '-0.02em',
    color: 'var(--ink)',
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 'clamp(12px, 2vw, 24px)'
  },
  titleSub: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 'clamp(14px, 1.6vw, 20px)',
    fontWeight: 400,
    color: 'var(--ink-2)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  lede: {
    fontSize: 'clamp(15px, 1.6vw, 18px)',
    color: 'var(--ink)',
    lineHeight: 1.75,
    maxWidth: 540,
    margin: '24px 0 32px'
  },
  ctaRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  cta: {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '14px 22px',
    background: 'var(--ink)',
    color: 'var(--bg)',
    border: 'none', borderRadius: 999,
    fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'transform 120ms ease, background 120ms ease',
    boxShadow: '0 6px 18px -8px rgba(43,38,32,0.4)'
  },
  ctaBusy: { background: 'var(--ink-2)', cursor: 'wait' },
  ctaMeta: {
    fontSize: 11, padding: '2px 8px', borderRadius: 999,
    background: 'rgba(250,246,238,0.18)', color: 'var(--bg)', marginLeft: 4
  },
  ctaGhost: {
    color: 'var(--ink)', fontSize: 14, textDecoration: 'none',
    padding: '14px 8px', fontWeight: 500,
    borderBottom: '1px solid transparent'
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 0, margin: '48px 0 0', padding: 0,
    borderTop: '1px solid var(--line)'
  },
  metaCell: {
    padding: '20px 16px 0 0'
  },
  metaKey: { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)', margin: 0 },
  metaVal: { fontSize: 15, fontWeight: 500, margin: '6px 0 0', color: 'var(--ink)' },
  peekRow: {
    position: 'absolute',
    top: 24, right: -40,
    display: 'flex', gap: 4,
    opacity: 0.55,
    pointerEvents: 'none',
    zIndex: 1
  },
  peek: {
    width: 'clamp(70px, 9vw, 110px)',
    height: 'auto',
    transform: 'rotate(-6deg)'
  }
};

const mainStyles = {
  wrap: { maxWidth: 1240, margin: '0 auto', padding: '40px 32px 80px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 20,
    marginTop: 28
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center', padding: '80px 20px',
    color: 'var(--ink)'
  }
};

const filterStyles = {
  wrap: {
    position: 'sticky', top: 0, zIndex: 20,
    background: 'rgba(250,246,238,0.92)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    margin: '0 -32px',
    padding: '20px 32px 16px',
    borderBottom: '1px solid var(--line)'
  },
  row: {
    display: 'flex', gap: 16, alignItems: 'center',
    flexWrap: 'wrap', marginBottom: 12
  },
  searchWrap: {
    flex: '1 1 240px',
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 999, padding: '10px 18px',
    color: 'var(--ink-2)'
  },
  search: {
    flex: 1, border: 'none', outline: 'none', background: 'transparent',
    fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)'
  },
  sizeWrap: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 999, padding: 4
  },
  sizeLabel: {
    fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-2)',
    padding: '0 10px'
  },
  sizeBtn: {
    border: 'none', background: 'transparent',
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', color: 'var(--ink-2)',
    fontWeight: 500, outline: 'none'
  },
  sizeBtnOn: {
    background: 'var(--ink)', color: 'var(--bg)'
  },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'
  },
  chip: {
    border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--ink)',
    padding: '7px 14px', borderRadius: 999,
    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 120ms ease', outline: 'none'
  },
  chipOn: {
    background: 'var(--accent)', borderColor: 'var(--accent)',
    color: 'white'
  },
  spacer: { flex: 1 },
  count: { fontSize: 12, color: 'var(--ink-2)', letterSpacing: '0.06em' }
};

const cardStyles = {
  wrap: {
    display: 'flex', flexDirection: 'column',
    background: 'var(--card)',
    border: '1px solid var(--line)',
    borderRadius: 18, overflow: 'hidden',
    boxShadow: 'var(--shadow)',
    transition: 'transform 160ms ease, box-shadow 160ms ease',
    position: 'relative',
  },
  deleteBtn: {
    position: 'absolute', top: 6, left: 6, zIndex: 10,
    width: 24, height: 24, borderRadius: 999,
    background: 'rgba(43,38,32,0.7)', color: 'white',
    border: 'none', cursor: 'pointer',
    fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  },
  thumb: {
    position: 'relative',
    aspectRatio: '1 / 1',
    border: 'none', padding: 0,
    cursor: 'zoom-in',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%'
  },
  img: {
    maxWidth: '78%', maxHeight: '78%',
    objectFit: 'contain',
    filter: 'drop-shadow(0 6px 12px rgba(43,38,32,0.12))'
  },
  zoom: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 999,
    background: 'rgba(43,38,32,0.85)',
    color: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0, transition: 'opacity 160ms ease'
  },
  meta: {
    display: 'flex', alignItems: 'center',
    padding: '12px 14px', gap: 10,
    borderTop: '1px solid var(--line)',
    background: 'var(--card)'
  },
  metaText: { flex: 1, minWidth: 0 },
  caption: {
    fontSize: 15, fontWeight: 700, color: 'var(--ink)',
    margin: 0, lineHeight: 1.3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  subline: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  id: {
    fontSize: 10, color: 'var(--ink-2)', letterSpacing: '0.08em'
  },
  tag: {
    fontSize: 10, padding: '2px 8px', borderRadius: 999,
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    fontWeight: 600
  },
  dlBtn: {
    flex: 'none',
    width: 36, height: 36, borderRadius: 999,
    background: 'var(--ink)', color: 'var(--bg)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 120ms ease'
  }
};

const modalStyles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(43,38,32,0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 100,
    animation: 'fadeIn 160ms ease'
  },
  card: {
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 28, overflow: 'hidden',
    width: '100%', maxWidth: 720,
    display: 'grid',
    gridTemplateColumns: '1fr',
    boxShadow: '0 32px 80px -20px rgba(43,38,32,0.5)',
    position: 'relative'
  },
  close: {
    position: 'absolute', top: 14, right: 14, zIndex: 2,
    width: 36, height: 36, borderRadius: 999,
    border: 'none', background: 'rgba(255,252,245,0.9)',
    fontSize: 20, cursor: 'pointer',
    color: 'var(--ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  stage: {
    aspectRatio: '4 / 3',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 32
  },
  img: {
    maxWidth: '70%', maxHeight: '70%',
    objectFit: 'contain',
    filter: 'drop-shadow(0 8px 18px rgba(43,38,32,0.18))'
  },
  info: {
    padding: '24px 28px 28px',
    borderTop: '1px solid var(--line)',
    background: 'var(--card)'
  },
  infoTop: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 16, marginBottom: 20
  },
  infoId: {
    fontSize: 11, letterSpacing: '0.12em',
    color: 'var(--ink-2)', textTransform: 'uppercase'
  },
  infoTitle: {
    fontSize: 28, fontWeight: 700, margin: '4px 0 0',
    color: 'var(--ink)'
  },
  infoTag: {
    fontSize: 12, padding: '4px 12px', borderRadius: 999,
    background: 'var(--accent-soft)', color: 'var(--accent)',
    fontWeight: 600, flex: 'none'
  },
  actions: {
    display: 'flex', flexDirection: 'column', gap: 10
  },
  sizePicker: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8
  },
  sizeChoice: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: 2,
    padding: '12px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--line)',
    borderRadius: 12, cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
    transition: 'all 120ms ease',
    color: 'var(--ink)'
  },
  copyBtn: {
    padding: '12px 14px',
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 12, cursor: 'pointer',
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    color: 'var(--ink)'
  }
};

const footerStyles = {
  wrap: {
    background: 'var(--bg-2)',
    borderTop: '1px solid var(--line)',
    padding: '48px 32px 56px'
  },
  inner: { maxWidth: 980, margin: '0 auto' },
  brand: { fontSize: 24, fontWeight: 900, marginBottom: 16, color: 'var(--ink)' },
  note: {
    fontSize: 13, lineHeight: 1.9, color: 'var(--ink-2)',
    margin: '0 0 24px'
  },
  foot: {
    fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.08em',
    paddingTop: 20, borderTop: '1px solid var(--line)'
  }
};

// --- Mount ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// global hover: card lift + zoom-pip reveal
const styleEl = document.createElement('style');
styleEl.textContent = `
  article:hover { transform: translateY(-2px); box-shadow: 0 1px 0 rgba(43,38,32,0.04), 0 16px 30px -14px rgba(43,38,32,0.28) !important; }
  article:hover [data-zoom] { opacity: 1; }
  button { outline: none; }
  a:focus-visible, input:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  button:hover [stroke] { stroke: currentColor; }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
`;
document.head.appendChild(styleEl);