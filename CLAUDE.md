# kitaku-stamp

きたくったりん スタンプ配布サイト。透過PNG形式のスタンプをダウンロードできる静的サイト。

## リポジトリ

**GitHub:** https://github.com/sakerice/kitaku

## プロジェクト構成

```
project/
  index.html        # エントリーポイント（Babel + React、ビルド不要）
  app.jsx           # メインアプリ（スタンプ一覧・モーダル・DL）
  tweaks-panel.jsx  # デザイン調整パネル
  extractor.jsx     # スタンプシート切り出しロジック
  uploader.jsx      # シート画像アップロードUI
  stickers/         # 透過PNG
```

## ワークフロー

```
Claude Design → エクスポート → Claude Code セッション → git push → GitHub
```

**Claude Design での変更 → Claude Code への反映は手動エクスポートが必要。**
**Claude Code での変更 → Claude Design への反映は存在しない（一方通行）。**

## 実装メモ

- React 18 + Babel standalone（ビルドツール不要、ブラウザで直接動作）
- JSZip で一括DL（ZIP）
- スタンプ画像は `stickers/{sheet}_{idx:02}_{id}.png?v4` の命名規則
- Tweaksパネル: `useTweaks(TWEAK_DEFAULTS)` → `[values, setTweak]` のタプル形式
- カスタムスタンプは IndexedDB（`kitaku-custom`）に blob で永続化

---

## Claude Design 向け：デプロイ手順

Claude Design セッションからpushする場合（クラウドで動くため認証が必要）：

```bash
git remote set-url origin https://<TOKEN>@github.com/sakerice/kitaku.git
git push -u origin main
```
