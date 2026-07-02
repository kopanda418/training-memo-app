# STATUS — 進捗と引き継ぎ

> 毎セッション終了時に `/handoff` で更新する。新しいセッションはまずこのファイルを読むこと。

## 現在地

- **フェーズ**: M0(プロジェクト基盤)実装済み。デプロイのみ未完
- **作業中マイルストーン**: M0 — 残タスクは「GitHub への push と Pages デプロイ確認」だけ

## 次にやること

1. **[ユーザー待ち]** gh トークンに `workflow` スコープがなく push が拒否された。ユーザーに `gh auth refresh -h github.com -s workflow` を実行してもらう
2. `git push -u origin main` → Actions の実行を `gh run watch` で確認 → https://kopanda418.github.io/training-memo-app/ が開けることを確認
3. 実機 iPhone でホーム画面追加 → 機内モードで起動確認(ユーザーに依頼)→ M0 完了、roadmap.md のチェックを ✅ に
4. 次は M1(データ層): Dexie スキーマ v1 + repository + エクスポート/インポート

## 申し送り・注意点

- 2026-07-03: 設計・計画ドキュメント一式を作成(requirements / architecture / roadmap / decisions)。技術選定の根拠は decisions.md にあるので再調査不要
- 参考アプリ「筋トレmemo」の機能調査済み: 部位別種目管理、セット記録(重量/回数/補助)、前回コピー、グラフ 4 指標(総負荷量・最大RM・セット数・最大重量)、MAX 記録(王冠)、RM 自動計算、インターバルタイマー。この体験を下敷きにする
- 差分要件(種目×タグ、日付間コピー/移動、場所記録、テーマ切替、Wake Lock)は requirements.md に「差分要件」と明記してある
- GitHub リポジトリは https://github.com/kopanda418/training-memo-app (public。Pages の無料利用に public が必要)
- eslint-plugin-react-hooks v7 は flat config を `configs.flat.recommended` で参照する(`recommended-latest` はレガシー形式でエラーになる)
- PowerShell 5.1 に日本語入りスクリプトを渡すと文字コード誤読で壊れる。一時 .ps1 は ASCII のみで書く

## セッション履歴

| 日付       | 内容                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------- |
| 2026-07-03 | 要件定義・技術設計・開発計画・体制ドキュメント作成。git リポジトリ初期化                        |
| 2026-07-03 | M0 実装(雛形・PWA・タブ4画面・CI/CD)。lint/test/build 通過。push は workflow スコープ不足で保留 |
