# 社畜妖精きたくったりん スタンプ

社畜妖精きたくったりんのスタンプを配布する静的サイト。  
透過PNG形式のスタンプをブラウザから直接ダウンロードできます。

**公開URL:** https://kitaku.srapps.us/

---

## 特徴

- 透過PNG / 白フチつき / 約420px
- 個別ダウンロード・まとめてZIPダウンロード
- ムード別タブフィルター（仕事・日常・感謝・謝罪・弱音・返事）
- シート画像から自動切り出し（グリッド編集・背景除去・白フチ生成）
- 切り出したカスタムスタンプはブラウザ（IndexedDB）に保存され、リロード後も維持

## プロジェクト構成

```
project/
  index.html        # エントリーポイント（Babel + React、ビルド不要）
  app.jsx           # メインアプリ（スタンプ一覧・モーダル・DL）
  tweaks-panel.jsx  # デザイン調整パネル
  extractor.jsx     # スタンプシート切り出しロジック
  uploader.jsx      # シート画像アップロードUI
  stickers/         # 透過PNG画像・manifest.json
  uploads/          # シート画像の作業ファイル（参考用）
chats/              # Claude Designとの会話ログ（設計経緯）
```

## 技術スタック

- React 18 + Babel standalone（ビルドツール不要）
- JSZip（ZIPダウンロード）
- IndexedDB（カスタムスタンプの永続化）
- Canvas API（シート切り出し・背景除去・白フチ生成）

## ローカルで動かす

ビルド不要。`project/` をローカルサーバーで配信するだけで動きます。

```bash
# 例: Python
cd project
python3 -m http.server 8080
# → http://localhost:8080
```

## スタンプの追加

1. `project/stickers/` に透過PNGを追加（命名規則: `{sheet}_{idx:02}_{id}.png`）
2. `project/app.jsx` の `STICKERS` 配列にエントリを追記

または「シート画像から自動切り出し」機能でブラウザ上から追加できます。

## ライセンス

スタンプ画像は個人利用OK。二次配布・再販売・素材集への収録はご遠慮ください。
