# STATUS — 進捗と引き継ぎ

> 毎セッション終了時に `/handoff` で更新する。新しいセッションはまずこのファイルを読むこと。

## 現在地

- **フェーズ**: M0・M1 完了。M2(記録入力画面)実装済み・テスト通過・push 済み
- **作業中マイルストーン**: M2 — 残タスクは「デプロイ成功の確認」と「ユーザーの実機 UX 確認」

## 次にやること

1. **[デプロイ再試行中]** Pages デプロイが「Deployment failed, try again later」で連続失敗(GitHub ステータスは正常、ビルドは成功、M1 までは同一設定でデプロイ成功済み → Pages 側の一時エラーと判断)。時間をおいて `gh workflow run deploy.yml` を再実行する
2. デプロイ成功後、ユーザーに実機で記録入力の一通り(種目追加→タグ→セット入力→前回コピー→場所設定)を試してもらう。タブバー沈み込み修正の目視確認も一緒に
3. フィードバックを反映して M2 完了 → 次は M3(履歴: カレンダー・種目別履歴・日付間コピー/移動)

## 申し送り・注意点

- 2026-07-03: 設計・計画ドキュメント一式を作成(requirements / architecture / roadmap / decisions)。技術選定の根拠は decisions.md にあるので再調査不要
- 参考アプリ「筋トレmemo」の機能調査済み: 部位別種目管理、セット記録(重量/回数/補助)、前回コピー、グラフ 4 指標(総負荷量・最大RM・セット数・最大重量)、MAX 記録(王冠)、RM 自動計算、インターバルタイマー。この体験を下敷きにする
- 差分要件(種目×タグ、日付間コピー/移動、場所記録、テーマ切替、Wake Lock)は requirements.md に「差分要件」と明記してある
- GitHub リポジトリは https://github.com/kopanda418/training-memo-app (public。Pages の無料利用に public が必要)
- eslint-plugin-react-hooks v7 は flat config を `configs.flat.recommended` で参照する(`recommended-latest` はレガシー形式でエラーになる)
- PowerShell 5.1 に日本語入りスクリプトを渡すと文字コード誤読で壊れる。一時 .ps1 は ASCII のみで書く
- Pages の有効化は Actions の `configure-pages` (enablement: true) では権限不足で失敗する。`gh api -X POST repos/kopanda418/training-memo-app/pages -f build_type=workflow` で有効化済み(一度きりの作業、再実行不要)
- デプロイは main への push で自動。状態確認は `gh run list` / `gh run watch <id>`
- データ層の使い方: `src/db/repository.ts`(addSet は日レコード作成と orderInDay 採番を内包)、バックアップは `src/db/backup.ts`。タグなしは `NO_TAG`('')に正規化される(ADR-005)
- Dexie の `toArray()` は主キー(UUID)順で返る。マスタの表示は `orderBy('sortOrder')` を使うこと

## セッション履歴

| 日付       | 内容                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-03 | 要件定義・技術設計・開発計画・体制ドキュメント作成。git リポジトリ初期化                                                       |
| 2026-07-03 | M0 実装(雛形・PWA・タブ4画面・CI/CD)。lint/test/build 通過。Pages デプロイ成功、公開 URL 応答確認。残りは実機確認のみ          |
| 2026-07-03 | 実機報告のタブバー沈み込みを修正(safe-area padding の位置)。M1 完了: Dexie v1・repository・JSON バックアップ・テスト 12 件     |
| 2026-07-03 | M2 実装: 記録画面(ブロック・ステッパー・前回コピー・場所)+ repository 拡張。テスト 20 件。Pages デプロイが一時エラーで再試行中 |
