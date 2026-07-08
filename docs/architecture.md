# 技術構成・データモデル・画面設計

## 全体構成

```
iPhone Safari (PWA / standalone)
 ├─ React SPA (Vite ビルド、静的ファイルのみ)
 ├─ Service Worker (Workbox precache → オフライン完結)
 └─ IndexedDB (Dexie.js) ← 全データはここ。サーバーなし
        ↑
GitHub リポジトリ → GitHub Actions → GitHub Pages (静的配信のみ)
```

- 記録の読み書きはすべて端末内 IndexedDB。ネットワークは初回ロードとアプリ更新時のみ
- これにより「費用ゼロ」「オフライン動作」「入力遅延なし」を構造的に満たす

## 技術スタック

| 領域         | 採用                             | 備考                                                                               |
| ------------ | -------------------------------- | ---------------------------------------------------------------------------------- |
| ビルド       | Vite                             | GitHub Pages 配下パス用に `base` 設定必須                                          |
| UI           | React 18+ + TypeScript (strict)  |                                                                                    |
| スタイル     | Tailwind CSS                     | ダークモードは `class` 戦略。`<html>` に `dark` クラスを付け外し                   |
| データ       | Dexie.js + dexie-react-hooks     | `useLiveQuery` で書き込み→UI 反映を自動化                                          |
| PWA          | vite-plugin-pwa                  | `registerType: 'autoUpdate'`。manifest は日本語名・アイコン・`display: standalone` |
| グラフ       | Chart.js + react-chartjs-2       | 折れ線のみ。遅延 import でメイングラフ画面以外のバンドルに含めない                 |
| ルーティング | react-router (hash ルーティング) | GitHub Pages は SPA フォールバックがないため hash が安全                           |
| テスト       | Vitest + @testing-library/react  | ロジック(RM 計算・MAX 判定・コピー/移動)を優先的にテスト                           |
| Lint         | ESLint + Prettier                |                                                                                    |
| CI/CD        | GitHub Actions                   | push → lint + test + build → Pages デプロイ                                        |

## データモデル(Dexie スキーマ)

日付キーは端末ローカルの `YYYY-MM-DD` 文字列。ID は `crypto.randomUUID()`。

```ts
// db.version(3) 時点
exercises: 'id, name, bodyPart, sortOrder'
// { id, name, bodyPart(部位名の文字列), sortOrder, isArchived, createdAt }
tags: 'id, name, sortOrder'
// { id, name, color?, sortOrder, isArchived, createdAt }
// タグは全種目共通のマスタ(高重量日・中重量日・低重量日 など)
days: 'date'
// { date, locationId?, note? }  … 1日1レコード。場所はここに持つ
sets: 'id, date, [exerciseId+tagId], exerciseId'
// { id, date, exerciseId, tagId (なし時は '' 固定),
//   weight(isBodyweight 時は加重分), isBodyweight?, reps, targetReps?,
//   attribute?(セット属性・任意テキスト), isAssisted(deprecated→attribute),
//   unit ('kg'|'lbs'), memo?, orderInDay, createdAt }
locations: 'id, name'
// { id, name, lastUsedAt, sortOrder } … 場所マスタ(v6: sortOrder 追加)
setAttributes: 'id, name' // v2 追加
// { id, name, lastUsedAt, sortOrder } … セット属性バンク(v6: sortOrder 追加)
bodyParts: 'id, name, sortOrder' // v3 追加
// { id, name, sortOrder } … 部位マスタ(追加可能。デフォルト7部位をシード)
settings: 'key'
// { key, value } … bodyWeight / quickSetAttributes / quickExerciseTagIds / theme など
//                   (キー一覧は src/db/settings.ts の SettingKey)
```

設計上の要点:

- **種目×タグが分析の基本単位。** `sets` の複合インデックス `[exerciseId+tagId]` で履歴・グラフ・MAX をすべて引く。`tagId` は「タグなし」を空文字 `''` で正規化する(IndexedDB の複合インデックスは `undefined` を含むレコードを引けないため)
- **MAX 記録はテーブルに持たず都度計算。** データ量が数万件規模なので `[exerciseId+tagId]` インデックスで十分速い。キャッシュテーブルはコピー/移動・編集・削除との整合性維持コストの方が高い(遅くなったら導入を検討 → decisions.md)
- **日付間コピー/移動**は `sets` の `date` 書き換え(移動)/複製(コピー)+ 対象日の `days` レコード作成。1 トランザクションで行う
- スキーマ変更は必ず `db.version(n+1).stores(...).upgrade(...)` を追加し、この表を同時更新する

## 画面構成

下部タブ 4 つ + モーダル群。

| 画面                 | 内容                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **記録**(ホーム)     | 当日(または選択日)の記録。日付ヘッダ、場所チップ、種目×タグブロックのリスト、セット行(重量/回数ステッパー)、「前回コピー」、種目追加ボタン。右上にタイマー起動 |
| 種目選択モーダル     | 部位タブ → 種目リスト → タグ選択(なし/既存/新規)の 2 段階                                                                                                      |
| **履歴**             | カレンダー(記録日マーク)+ 種目別履歴(タグフィルタチップ付き)。日単位のコピー/移動はここから(日を選択 → コピー or 移動 → 対象日選択)                            |
| **グラフ**           | 種目×タグセレクタ + 指標切替(最大重量/推定1RM/総負荷量/セット数)の折れ線。MAX 記録(王冠)一覧もこのタブ                                                         |
| **設定**             | テーマ / 単位 / タイマー設定(Wake Lock ON/OFF)/ マスタ管理(種目・タグ・場所)/ エクスポート・インポート                                                         |
| タイマーオーバーレイ | どの画面からも被せて表示。プリセット秒 + カウントダウン + Wake Lock 取得                                                                                       |

### 入力 UX の原則(応答速度要件)

- セット追加は前回値(同一種目×タグの直近セット)をプリフィルし、ステッパー(±2.5kg / ±1rep)中心でキーボードを出さない
- 書き込みは楽観的に即時反映(`useLiveQuery` が自動でやる)。保存ボタンは置かず、行単位で自動保存
- グラフ・履歴集計はメインスレッドで同期計算(数万件で問題化したら Web Worker 化)

## iOS 制約メモ(実装時に必ず参照)

| API / 挙動                 | 状況と対策                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Screen Wake Lock           | iOS 16.4+ で利用可。`visibilitychange` で解除されるので復帰時に再取得。取得失敗時は「画面ロックを無効にできません」と表示                                                                                                                                                                                                                                                                                          |
| プッシュ通知               | ロック中のタイマー通知は事実上不可 → Wake Lock + Web Audio の音で代替(要件で確定済み)。ロック中も確実に鳴らしたい場合は任意で iOS ショートカット連携(下記)                                                                                                                                                                                                                                                         |
| iOS 標準タイマー連携(任意) | 設定 `nativeTimerEnabled` ON で、タイマー開始時に `shortcuts://run-shortcut?name=<名前>&input=<秒>` を開き、ユーザー作成のショートカット経由で標準の時計アプリのタイマーを起動。**画面ロック中でも鳴る**。ショートカットはユーザーが手動作成(名前は `nativeTimerShortcutName` と一致)。実装は `features/timer/nativeTimer.ts`。ON 時は PWA 側の Web Audio/Wake Lock/カウントダウンは動かさず完全にネイティブへ委譲 |
| バイブレーション           | `navigator.vibrate` は iOS 非対応。使わない                                                                                                                                                                                                                                                                                                                                                                        |
| 音の再生                   | ユーザー操作起点でないと再生不可 → タイマー開始タップ時に AudioContext を resume しておく                                                                                                                                                                                                                                                                                                                          |
| IndexedDB 永続性           | ホーム画面追加した PWA なら Safari の 7 日間 ITP 削除の対象外だが、`navigator.storage.persist()` を要求 + JSON バックアップ導線を設ける                                                                                                                                                                                                                                                                            |
| 100vh 問題・セーフエリア   | `dvh` 単位と `env(safe-area-inset-*)` を使用                                                                                                                                                                                                                                                                                                                                                                       |
| ホーム画面追加             | `display: standalone`、`apple-touch-icon`、ステータスバー配色は theme-color をライト/ダークで切替                                                                                                                                                                                                                                                                                                                  |

## ディレクトリ構成(予定)

```
src/
  db/           # Dexie スキーマ・マイグレーション・repository 関数
  features/
    record/     # 記録画面・種目選択・セット入力
    history/    # カレンダー・種目別履歴・コピー/移動
    analytics/  # グラフ・MAX 記録・RM 計算
    timer/      # タイマー・Wake Lock
    settings/   # 設定・マスタ管理・エクスポート/インポート
  components/   # 共通 UI(ステッパー、モーダル、チップ等)
  lib/          # 日付・単位変換・1RM 計算などの純粋関数(テスト対象の中心)
  app/          # ルーティング・タブ・テーマ Provider
```
