# バックアップ JSON フォーマット仕様

設定画面の「書き出し」で生成されるファイルの構造を説明する。  
実装の正本は `src/db/backup.ts`(`BackupFile` 型) と `src/db/types.ts`。

---

## ファイル全体の構造

```json
{
  "app": "training-memo-app",
  "formatVersion": 1,
  "exportedAt": "2026-07-08T10:00:00.000Z",
  "data": {
    "exercises":    [...],
    "tags":         [...],
    "days":         [...],
    "sets":         [...],
    "locations":    [...],
    "settings":     [...],
    "setAttributes":[...],
    "bodyParts":    [...],
    "templates":    [...]
  }
}
```

| フィールド      | 型       | 内容                                        |
| --------------- | -------- | ------------------------------------------- |
| `app`           | `string` | 常に `"training-memo-app"` (ファイル識別子) |
| `formatVersion` | `number` | 現在は `1`。互換性が壊れる変更時のみ上がる  |
| `exportedAt`    | `string` | ISO 8601 UTC (`new Date().toISOString()`)   |
| `data`          | object   | 全テーブルのスナップショット(下記)          |

---

## data の各テーブル

### exercises — 種目マスタ

```ts
interface Exercise {
  id: string // UUID
  name: string // 種目名(例: "ベンチプレス")
  bodyPart: string // 部位名(bodyParts テーブルの name と一致)
  sortOrder: number // 表示順(小さいほど上)
  isArchived: boolean // アーカイブ済みか(UI に出ない)
  createdAt: number // Unix ミリ秒
}
```

### tags — タグマスタ

タグは全種目共通。「高重量日」「軽め」など強度やバリエーションを表す。

```ts
interface Tag {
  id: string
  name: string // タグ名
  color?: string // (未使用: 将来の色分け用)
  sortOrder: number
  isArchived: boolean
  createdAt: number
}
```

### days — 日レコード

1 日 1 行。セットが 1 件でも存在する日に作成される。

```ts
interface Day {
  date: string // "YYYY-MM-DD" (端末ローカルタイムゾーン基準。主キー)
  locationId?: string // locations.id への参照。場所未設定なら undefined
  note?: string // 日メモ(現在 UI なし: 将来用)
}
```

### sets — ワークアウトセット

記録の実体。1 セット 1 行。

```ts
interface WorkoutSet {
  id: string // UUID (主キー)
  date: string // "YYYY-MM-DD" (days.date と一致)
  exerciseId: string // exercises.id への参照
  tagId: string // tags.id への参照。タグなしは "" (空文字)
  weight: number // 重量(kg または lbs)。isBodyweight=true なら「加重分」(0=純自重)
  isBodyweight?: boolean // 自重種目か
  isWarmup?: boolean // ウォームアップセットか(週間集計・MAX 判定から除外)
  reps: number // 実績レップ数
  rpe?: number // RPE (Rate of Perceived Exertion, 例: 8.5)
  attributes?: string[] // セット属性(例: ["左", "フル"])。なければ undefined または []
  unit: 'kg' | 'lbs' // 重量単位
  memo?: string // セットメモ
  orderInDay: number // 日内の表示順(0 始まり)
  createdAt: number // Unix ミリ秒

  // --- deprecated フィールド(旧データ互換のため型に残る) ---
  attribute?: string // v5 以前の単数属性。import 時に attributes[] へ正規化される
  targetReps?: number // 目標レップ(UI 撤去済み)
  isAssisted: boolean // 補助フラグ(属性 "補助" に置き換え済み)
}
```

**重要な設計ポイント:**

- `tagId` が `""` (空文字) = タグなし。`undefined` ではない(IndexedDB の複合インデックス制約)
- 分析・グラフ・MAX 判定はすべて `exerciseId + tagId` の組み合わせ単位で行う
- `isWarmup: true` のセットは週間集計・MAX 判定から除外される
- `orderInDay` は連番ではなく相対順。コピー/移動後に振り直されることがある

### locations — 場所マスタ

```ts
interface Location {
  id: string
  name: string // 場所名(例: "ホームジム", "24時間ジム")
  lastUsedAt: number // Unix ミリ秒
  sortOrder: number // 管理画面での並び順(v6 追加)
}
```

### settings — 設定

key-value ストア。`value` の型はキーによって異なる。

```ts
interface Setting {
  key: string // SettingKey(下記)
  value: unknown
}
```

| key                       | value の型 | 内容                                             | デフォルト           |
| ------------------------- | ---------- | ------------------------------------------------ | -------------------- |
| `bodyWeight`              | `number`   | 自重(kg)。自重種目の 1RM 換算に使う              | —                    |
| `theme`                   | `'light'   | 'dark'                                           | 'system'`            | UI テーマ | `'dark'` |
| `defaultUnit`             | `'kg'      | 'lbs'`                                           | 新規セットの重量単位 | `'kg'`    |
| `wakeLockEnabled`         | `boolean`  | タイマー中の画面ロック防止                       | `true`               |
| `timerSound`              | `string`   | タイマー終了音の ID                              | `'rising'`           |
| `nativeTimerEnabled`      | `boolean`  | iOS ショートカット経由でネイティブタイマーを使う | `false`              |
| `nativeTimerShortcutName` | `string`   | 呼び出すショートカット名                         | `'筋トレタイマー'`   |
| `defaultLocationId`       | `string`   | ホームジム(自動付与する場所の ID)。`''` で無効   | —                    |
| `quickSetAttributes`      | `string[]` | 属性クイックボタン(最大 3)                       | `['左','右','フル']` |
| `quickExerciseTagIds`     | `string[]` | 種目タグのクイックボタン(tag id、最大 3)         | —                    |

### setAttributes — セット属性バンク

ユーザーが過去に使った属性名の入力候補プール。

```ts
interface SetAttribute {
  id: string
  name: string // 属性名(例: "左", "フル", "DS")
  lastUsedAt: number
  sortOrder: number // v6 追加
}
```

### bodyParts — 部位マスタ

```ts
interface BodyPartRow {
  id: string
  name: string // 部位名(例: "胸", "背中", "脚")
  sortOrder: number
}
```

デフォルト 7 部位: `胸 / 背中 / 脚 / 肩 / 腕 / 腹 / その他`  
ユーザーが追加可能。種目の `bodyPart` 文字列はこの `name` を参照する。

### templates — メニューテンプレート

```ts
interface Template {
  id: string
  name: string
  items: { exerciseId: string; tagId: string }[]
  createdAt: number
}
```

---

## 旧バックアップとの互換性

| フィールド / テーブル   | 追加バージョン | 旧データでの扱い                                                             |
| ----------------------- | -------------- | ---------------------------------------------------------------------------- |
| `setAttributes`         | Dexie v2       | 省略可。import 時は空配列として扱う                                          |
| `bodyParts`             | Dexie v3       | 省略可。import 時はデフォルト 7 部位 + 種目の部位名から再構築                |
| `templates`             | Dexie v4       | 省略可。import 時は空配列として扱う                                          |
| `sets[].attributes[]`   | Dexie v5       | 旧 `attribute`(単数 string)は import 時に `attributes: [attribute]` へ正規化 |
| `locations[].sortOrder` | Dexie v6       | 旧データは `lastUsedAt` 降順で自動採番                                       |

---

## データの関係図

```
bodyParts ──← exercises ──────────────────┐
                                           │ exerciseId
tags ──────────────────────────────────── sets ── (主記録)
                                           │ tagId
                                           │ date ──→ days ──→ locations
setAttributes  (属性名の候補プール)         │
templates      (exerciseId + tagId のリスト)│
settings       (ユーザー設定)              │
```

- `sets` が中心テーブル。1 セット 1 行
- `exerciseId + tagId` の組み合わせが分析の基本単位
- `days` は 1 日 1 行のメタ情報(場所・メモ)

---

## 実際のデータ例

```json
{
  "app": "training-memo-app",
  "formatVersion": 1,
  "exportedAt": "2026-07-08T10:30:00.000Z",
  "data": {
    "exercises": [
      {
        "id": "ex-001",
        "name": "ベンチプレス",
        "bodyPart": "胸",
        "sortOrder": 0,
        "isArchived": false,
        "createdAt": 1720000000000
      }
    ],
    "tags": [
      {
        "id": "tag-001",
        "name": "高重量",
        "sortOrder": 0,
        "isArchived": false,
        "createdAt": 1720000000000
      }
    ],
    "days": [{ "date": "2026-07-08", "locationId": "loc-001" }],
    "sets": [
      {
        "id": "set-001",
        "date": "2026-07-08",
        "exerciseId": "ex-001",
        "tagId": "tag-001",
        "weight": 100,
        "reps": 5,
        "rpe": 8.5,
        "attributes": ["フル"],
        "isBodyweight": false,
        "isWarmup": false,
        "isAssisted": false,
        "unit": "kg",
        "orderInDay": 0,
        "createdAt": 1720000000000
      },
      {
        "id": "set-002",
        "date": "2026-07-08",
        "exerciseId": "ex-001",
        "tagId": "",
        "weight": 60,
        "reps": 10,
        "isBodyweight": false,
        "isWarmup": true,
        "isAssisted": false,
        "unit": "kg",
        "orderInDay": 1,
        "createdAt": 1720000001000
      }
    ],
    "locations": [
      { "id": "loc-001", "name": "ホームジム", "lastUsedAt": 1720000000000, "sortOrder": 0 }
    ],
    "settings": [
      { "key": "theme", "value": "dark" },
      { "key": "defaultUnit", "value": "kg" }
    ],
    "setAttributes": [
      { "id": "attr-001", "name": "フル", "lastUsedAt": 1720000000000, "sortOrder": 0 }
    ],
    "bodyParts": [{ "id": "bp-001", "name": "胸", "sortOrder": 0 }],
    "templates": []
  }
}
```
