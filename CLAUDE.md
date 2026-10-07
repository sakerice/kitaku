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

<!-- 作業ルール: ここから（元は ~/.claude/templates/CLAUDE.work-rules.md。直すときは元のファイルと、これを入れた各リポジトリを直す） -->
## 作業ルール（このリポジトリで作業する Claude へ）

このリポジトリの **main は本番に自動で公開される**（Cloudflare Pages / https://kitaku.srapps.us）。
この Mac の外（Claude Code のクラウド、他の人の手元）でも同じルールで動けるよう、ここに書いている。

### 必ず止まって確認を取る

- **main への push・マージ。** 本番に出るため。作業は別ブランチで行い、PR を作るところまでは進めてよい
- 取り返しのつかない削除（履歴の書き換え、force push、データの削除）
- 前提が崩れていて、どの解釈で進めても手戻りが確定する場合

### 進め方

- 合意した作業は、1つごとに「進めていいですか」と確認せず、最後まで進めてからまとめて報告する
- 作業中に見つけた不具合は、報告して止まるのではなくその場で直す。
  ただし、仕様の変更にあたる場合・影響が依頼の範囲を大きく超える場合・原因が推測にとどまる場合は、先に相談する

### 止まって質問するとき

読み手はあなたの思考過程もツールの出力も見ていない。作業中に自分で作った略語や、ログの断片だけで済ませず、次の3点を書く。

1. **現状** — どこまで進み、何が分かったか
2. **判断してほしいこと** — 選択肢ごとの違いと、勧める方
3. **なぜ止まったのか** — 自分で進めずに確認を求める理由

### 報告するとき

- 依頼された項目ごとに、今どうなったかを書く。やっていないものは「やっていない」と明示する
- 何をしたかより、**相手にとって何が変わるのか**を書く。作業の列挙で埋めない

### 言葉

- 利用者に見える文章はすべて日本語で書く（ツール実行の説明文も含む）
<!-- 作業ルール: ここまで -->
