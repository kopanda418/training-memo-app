# STATUS — 進捗と引き継ぎ

> 毎セッション終了時に `/handoff` で更新する。新しいセッションはまずこのファイルを読むこと。

## 現在地

- **フェーズ**: M0・M1・M3 完了。実機フィードバック対応(G1〜G5、docs/feedback-2026-07-03.md)も実装・デプロイ済み
- **作業中マイルストーン**: なし。次はフィードバック反映の実機再確認 → M4(グラフ・MAX 記録)

## 次にやること

1. **[ユーザー待ち]** 実機で第2弾(feedback-2026-07-03-r2.md)の再確認: 下部余白、入力全選択、自重トグル(自重/自重+Nkg 表示・1RM 換算)、前回パネル 1 行表示+履歴遷移、設定→マスタ管理(種目・部位・タグ・属性)、クイックボタンのピッカー設定。OK なら M2 を ✅ に
2. M4 に着手: Chart.js(react-chartjs-2、遅延 import)でグラフ 4 指標(最大重量/推定1RM/総負荷量/セット数)、種目×タグ選択、MAX 記録一覧、MAX 更新トースト。`docs/roadmap.md` の M4 完了条件を参照。グラフ・MAX の 1RM/負荷計算は自重セットを考慮すること(lib/setFormat.ts の effectiveLoad を使う)
3. G5(デザイン)は第1弾のみ。実機の見た目フィードバックを受けて磨き込みを継続する

## 申し送り・注意点

- 2026-07-03: 設計・計画ドキュメント一式を作成(requirements / architecture / roadmap / decisions)。技術選定の根拠は decisions.md にあるので再調査不要
- 参考アプリ「筋トレmemo」の機能調査済み: 部位別種目管理、セット記録(重量/回数/補助)、前回コピー、グラフ 4 指標(総負荷量・最大RM・セット数・最大重量)、MAX 記録(王冠)、RM 自動計算、インターバルタイマー。この体験を下敷きにする
- 差分要件(種目×タグ、日付間コピー/移動、場所記録、テーマ切替、Wake Lock)は requirements.md に「差分要件」と明記してある
- GitHub リポジトリは https://github.com/kopanda418/training-memo-app (public。Pages の無料利用に public が必要)
- eslint-plugin-react-hooks v7 は flat config を `configs.flat.recommended` で参照する(`recommended-latest` はレガシー形式でエラーになる)
- PowerShell 5.1 に日本語入りスクリプトを渡すと文字コード誤読で壊れる。一時 .ps1 は ASCII のみで書く
- Pages の有効化は Actions の `configure-pages` (enablement: true) では権限不足で失敗する。`gh api -X POST repos/kopanda418/training-memo-app/pages -f build_type=workflow` で有効化済み(一度きりの作業、再実行不要)
- デプロイは main への push で自動(Actions が gh-pages ブランチへ push → Pages が配信。ADR-008)。状態確認は `gh run list` / `gh run watch <id>`、配信確認は `gh api repos/kopanda418/training-memo-app/pages/builds/latest`
- 旧 artifact 方式 (`actions/deploy-pages`) はこのリポジトリで原因不明の連続失敗。戻さないこと
- PowerShell 経由の `git commit -m` に二重引用符入りメッセージを渡すと引数が壊れる。メッセージに `"` を含めない
- データ層の使い方: `src/db/repository.ts`(addSet は日レコード作成と orderInDay 採番を内包)、バックアップは `src/db/backup.ts`。タグなしは `NO_TAG`('')に正規化される(ADR-005)
- Dexie の `toArray()` は主キー(UUID)順で返る。マスタの表示は `orderBy('sortOrder')` を使うこと
- 実機フィードバックの要件・決定事項は docs/feedback-2026-07-03.md に集約(自重=設定の体重、セット属性は1つ、並べ替えは↑↓、ダーク基調)
- 現在ダークがデフォルト(index.html の `<html class="dark">`)。M6 のテーマ切替はこのクラスを設定値で付け外しする
- `sets.isAssisted` は deprecated(Dexie v2 で属性「補助」へ移行済み)。新規コードでは `attribute` を使う
- 2026-07-03 に全履歴の author/committer を noreply アドレスへ書き換え済み(個人メール露出対策)。このリポジトリの git config user.email はリポジトリローカルで noreply に設定してある。変更しないこと

## セッション履歴

| 日付       | 内容                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-03 | 要件定義・技術設計・開発計画・体制ドキュメント作成。git リポジトリ初期化                                                                                          |
| 2026-07-03 | M0 実装(雛形・PWA・タブ4画面・CI/CD)。lint/test/build 通過。Pages デプロイ成功、公開 URL 応答確認。残りは実機確認のみ                                             |
| 2026-07-03 | 実機報告のタブバー沈み込みを修正(safe-area padding の位置)。M1 完了: Dexie v1・repository・JSON バックアップ・テスト 12 件                                        |
| 2026-07-03 | M2 実装: 記録画面(ブロック・ステッパー・前回コピー・場所)+ repository 拡張。テスト 20 件。デプロイを gh-pages 方式に切替して公開成功                              |
| 2026-07-03 | M3 完了: カレンダー(記録日マーク・日サマリ)、種目別履歴(タグフィルタ)、日/種目単位のコピー・移動(transferSets)。テスト 29 件                                      |
| 2026-07-03 | 実機フィードバック G1〜G5 対応: レイアウト修正、セット行刷新(目標/1RM/メモ/↺/自重)、属性システム(Dexie v2)、前回パネル・並べ替え、ダーク化                        |
| 2026-07-03 | 第2弾 R2-G1〜G4: 全選択・余白詰め、自重フラグ化(effectiveLoad)、前回パネル1行+履歴遷移、マスタ管理(部位=Dexie v3・種目CRUD・削除ブロック・クイックボタンピッカー) |
