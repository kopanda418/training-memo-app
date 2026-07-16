---
name: verify
description: UI 変更を実ブラウザで検証する手順。dev サーバー + Playwright(Edge)で UI を駆動し、スクリーンショットとアサーションで確認する。
---

# 動作検証 (verify)

UI に触れる変更は test/build 通過だけで完了とせず、実ブラウザで該当フローを駆動して確認する。

## 手順

1. `npm run dev` をバックグラウンド起動 → `http://localhost:5173/training-memo-app/`(base パス付き)
2. scratchpad に Node スクリプトを書き、Playwright で駆動する:
   - scratchpad で `npm init -y && npm install playwright --no-save`(グローバル npx では import できない)
   - `chromium.launch({ channel: 'msedge', headless: true })` + viewport 390×700(iPhone 相当)
   - ルーティングは HashRouter: `page.goto(BASE + '#/record?date=YYYY-MM-DD')` で直接遷移できる
3. アサーション付きで検証し、要所で `page.screenshot()`。`page.on('console')` / `page.on('pageerror')` でエラー監視

## ハマりどころ

- **スクロールは `<main>` 要素上で発生**(window ではない)。位置は `document.querySelector('main').scrollTop` で取得
- **IndexedDB が実行間で残る**。再現性のため冒頭で `indexedDB.databases()` → 全 `deleteDatabase()` → reload してから UI 操作でデータ投入する
- **モーダル(ポータル)のセレクタは `div.z-50` でスコープする**。`.fixed` はアプリ本体にも一致して誤爆する。ボトムシートのアニメーション中はクリックが intercept されるので開閉後に 300〜400ms 待つ
- 日付ラベルは `formatDateLabel` 形式 = `7/15(水)`(同年なら年なし)。「7月15日」ではない
- 種目追加フロー: 「＋ 種目を追加」→ モーダルで種目名タップ → 「タグなし」or タグ選択。セットは「＋ セット追加」(複数ブロックあると複数一致するので `.last()` 等で指定)

## 過去の実績

- v1.0.11(スワイプ削除)・v1.0.17(戻り動線+スクロール復元)をこの方法で検証
