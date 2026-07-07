# STATUS — 進捗と引き継ぎ

> 毎セッション終了時に `/handoff` で更新する。新しいセッションはまずこのファイルを読むこと。

## 現在地

- **フェーズ**: 🎉 Ver 1.0.1 リリース済み(2026-07-07)。v1.0.0 リリース後のユーザーフィードバック第7弾を全実装済み
- **作業中マイルストーン**: なし。以降はバックログ(roadmap.md)とユーザーフィードバックに基づく継続開発

## 次にやること

1. 移行データ(`input/training-memo-backup-migrated.json`)を設定画面のインポートで取り込む — ユーザー側の手作業
2. 次のフィードバックまたはバックログ着手(roadmap.md の「Ver 1.0 以降のバックログ」参照)
3. デプロイは main push で自動。配信確認は `gh run list` + 配信 HTML のバンドル名一致

## 申し送り・注意点

- 2026-07-03: 設計・計画ドキュメント一式を作成(requirements / architecture / roadmap / decisions)。技術選定の根拠は decisions.md にあるので再調査不要
- 参考アプリ「筋トレmemo」の機能調査済み: 部位別種目管理、セット記録(重量/回数/補助)、前回コピー、グラフ 4 指標(総負荷量・最大RM・セット数・最大重量)、MAX 記録(王冠)、RM 自動計算、インターバルタイマー。この体験を下敷きにする
- 差分要件(種目×タグ、日付間コピー/移動、場所記録、テーマ切替、Wake Lock)は requirements.md に「差分要件」と明記してある
- GitHub リポジトリは https://github.com/kopanda418/training-memo-app (public。Pages の無料利用に public が必要)
- eslint-plugin-react-hooks v7 は flat config を `configs.flat.recommended` で参照する(`recommended-latest` はレガシー形式でエラーになる)
- PowerShell 5.1 に日本語入りスクリプトを渡すと文字コード誤読で壊れる。一時 .ps1 は ASCII のみで書く
- Pages の有効化は `gh api -X POST repos/kopanda418/training-memo-app/pages -f build_type=workflow` で有効化済み(一度きりの作業)
- デプロイは main への push で自動(Actions が gh-pages ブランチへ push → Pages が配信)。状態確認は `gh run list` / `gh run watch <id>`
- 旧 artifact 方式 (`actions/deploy-pages`) はこのリポジトリで原因不明の連続失敗。戻さないこと
- PowerShell 経由の `git commit -m` に二重引用符入りメッセージを渡すと引数が壊れる。メッセージに `"` を含めない
- データ層の使い方: `src/db/repository.ts`(addSet は日レコード作成と orderInDay 採番を内包)、バックアップは `src/db/backup.ts`。タグなしは `NO_TAG`('')に正規化される(ADR-005)
- Dexie の `toArray()` は主キー(UUID)順で返る。マスタの表示は `orderBy('sortOrder')` を使うこと
- 2026-07-03 に全履歴の author/committer を noreply アドレスへ書き換え済み(個人メール露出対策)。このリポジトリの git config user.email はリポジトリローカルで noreply に設定してある。変更しないこと
- **v1.0.1 で attributes[] に移行済み**: `sets.attribute`(単数 string)は deprecated。現行コードでは `sets.attributes`(string[])を使う。Dexie v5 マイグレーション済み。バックアップ import 側も正規化済み(`src/db/backup.ts`)
- **v1.0.1 で RPE フィールド追加**: `sets.rpe?: number`(小数可)。目標レップ(`targetReps`)は UI から撤去済み(既存データ互換のため型に残る)
- **移行データファイル**: `input/` ディレクトリは .gitignore 済みで GitHub 非公開。`input/migration-data.json`(旧アプリ export)・`input/convert.cjs`(変換スクリプト)・`input/training-memo-backup-migrated.json`(出力)はローカルのみ
- 設定画面の「属性クイックボタン」は 1 スロット 1 属性のまま(`AttributePicker` を toggle+close モードで単一選択として使用)

## セッション履歴

| 日付       | 内容                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-03 | 要件定義・技術設計・開発計画・体制ドキュメント作成。git リポジトリ初期化                                                                                                                                                                          |
| 2026-07-03 | M0 実装(雛形・PWA・タブ4画面・CI/CD)。lint/test/build 通過。Pages デプロイ成功、公開 URL 応答確認。残りは実機確認のみ                                                                                                                             |
| 2026-07-03 | 実機報告のタブバー沈み込みを修正(safe-area padding の位置)。M1 完了: Dexie v1・repository・JSON バックアップ・テスト 12 件                                                                                                                        |
| 2026-07-03 | M2 実装: 記録画面(ブロック・ステッパー・前回コピー・場所)+ repository 拡張。テスト 20 件。デプロイを gh-pages 方式に切替して公開成功                                                                                                              |
| 2026-07-03 | M3 完了: カレンダー(記録日マーク・日サマリ)、種目別履歴(タグフィルタ)、日/種目単位のコピー・移動(transferSets)。テスト 29 件                                                                                                                      |
| 2026-07-03 | 実機フィードバック G1〜G5 対応: レイアウト修正、セット行刷新(目標/1RM/メモ/↺/自重)、属性システム(Dexie v2)、前回パネル・並べ替え、ダーク化                                                                                                        |
| 2026-07-03 | 第2弾 R2-G1〜G4: 全選択・余白詰め、自重フラグ化(effectiveLoad)、前回パネル1行+履歴遷移、マスタ管理(部位=Dexie v3・種目CRUD・削除ブロック・クイックボタンピッカー)                                                                                 |
| 2026-07-04 | 第3弾 R3-G1〜G5: タブバーフラット化、1RM空欄非表示、属性バンクバグ修正、ブロックタグ変更、種目並替、セット長押しドラッグ(@dnd-kit)、テンプレート(Dexie v4)                                                                                        |
| 2026-07-05 | 週間ビュー要件確定(M4再定義)。M4a ウォームアップフラグ + M4b 週間ビュー(サマリ・基準週・種目別内訳・12週バー)実装。テスト45件                                                                                                                     |
| 2026-07-05 | M4c 折れ線グラフ(Chart.js遅延ロード・種目×タグ・4指標)+ M4d MAX一覧と更新トースト(detectMaxUpdate)。M4完了、テスト46件                                                                                                                            |
| 2026-07-05 | 第5弾 R5: 週次バー非表示バグ修正(親高さ)、MAX達成日+詳細モーダル(lib/maxStats)、グラフ期間切替・縦軸固定。テスト48件                                                                                                                              |
| 2026-07-05 | R6: タブバー下空間の根本対処(iOSキーボード後のスクロール残留→focusout/visualViewportでscrollTo復帰)、Modalのポータル化(半透明行からの透け解消)                                                                                                    |
| 2026-07-06 | v0.0.1〜0.0.5: バージョン表示導入、タブバー問題の真因=black-translucentのWebView短縮バグ→ステータスバー不透過化で解決+7px調整、バックアップUI前倒し、補正スライダー、Pages障害(スロットリング)をartifact方式切替+クールダウンで復旧               |
| 2026-07-06 | v0.0.6 M5完了: タブバー中央の⏱からタイマー(プリセット/任意秒/+30秒/終了音3連ビープ)、Wake Lock(設定でオンオフ・visibilitychange再取得)。次はM6(テーマ・単位・仕上げ)                                                                              |
| 2026-07-06 | v0.0.7 M6(テーマ・単位・場所管理・永続化)、v0.0.8 タイマー終了音選択(上昇メロディ・試聴)。🎉 Ver 1.0.0 リリース(全マイルストーン完了)                                                                                                             |
| 2026-07-07 | v1.0.1: セット属性複数化(Dexie v5)・RPE欄・セット追加プリフィル(属性/RPE)・グラフ改善(タグ工程廃止→全タグ合算+チップ)・MAX改善(最終日順+並替+検索)・ブロックヘッダ改善・属性管理追加欄。移行データ変換スクリプト更新(メモ→属性/RPE)。デプロイ完了 |
