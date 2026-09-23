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
    "templates":    [...],
    "blockNotes":   [...],
    "conditions":   [...],
    "painRecords":  [...]
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
  note?: string // その日全体の感想メモ(体調・環境など)。未入力なら undefined
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
  memo?: string // セットメモ(ユーザーが書く欄。プラン取り込みは書き換えない)
  planMemo?: string // プラン取り込みが書いたそのセットの指示(読み取り専用表示。v1.0.24〜/ADR-013)
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

### blockNotes — 種目×タグブロックの感想メモ

その日のその種目(`date + exerciseId + tagId` の複合単位=ブロック)ごとの感想メモ。
ブロックは永続レコードを持たない(`sets` の集合)ため、感想メモだけを別テーブルに切り出し、
複合主キー `[date+exerciseId+tagId]` で持つ。

```ts
interface BlockNote {
  date: string // "YYYY-MM-DD" (days.date と一致)
  exerciseId: string // exercises.id への参照
  tagId: string // tags.id への参照。タグなしは "" (空文字, NO_TAG)
  note?: string // ブロックの感想メモ(ユーザーが書く欄)。planNote だけの行では undefined
  planNote?: string // プラン取り込みが書いた種目単位の指示(読み取り専用表示。v1.0.24〜/ADR-013)
}
```

**設計ポイント(感想メモは 3 粒度):**

- セット単位 = `sets[].memo`
- 種目×タグブロック単位 = `blockNotes[].note`(このテーブル)
- その日全体 = `days[].note`
- ブロックメモはタグ変更・種目変更・別日コピー/移動でキーを追従させ、ブロックが空になると孤児レコードを削除する(詳細は `docs/architecture.md` / ADR-011)

**プラン欄とユーザー欄の区別(ADR-013):** `sets[].planMemo` と `blockNotes[].planNote` は
プラン取り込みが書いた指示(アプリ上は読み取り専用)、`sets[].memo` / `blockNotes[].note` /
`days[].note` はユーザーが書いた内容。外部プロジェクトがこのファイルを読んで実績を分析する場合、
ユーザーの生の声は後者の 3 つに入っている

### conditions — 日ごとの体調・やる気(v1.0.27〜/ADR-014)

記録画面の「🩺 体調・痛み」から入力する 1 日 1 行のスコア。どちらか一方だけの日もある
(両方を未入力に戻すと行ごと消える)。`days` とは別テーブルで、トレーニング記録が無い日にも存在しうる。

```ts
interface DailyCondition {
  date: string // "YYYY-MM-DD"
  condition?: number // 体調 1〜10(10=絶好調)
  motivation?: number // やる気 1〜10(10=最高)
}
```

### painRecords — 痛みの記録(v1.0.27〜/ADR-014)

1 日 1 部位×左右(`date + area + side`)ごとに 1 行。人体図は入力手段で、画像は保存しない。
部位・選択肢はすべて下記の固定コードで保存される(正本は `src/lib/painRegions.ts`。コードは
保存データのキーなので変更・削除されず、追加のみ行われる)。

```ts
interface PainRecord {
  id: string
  date: string // "YYYY-MM-DD"
  area: string // 大きな部位。例 "knee" "elbow" "lowBack"
  regionIds: string[] // 細かい場所。例 ["knee.medial"]。空=不明
  side: 'R' | 'L' | 'B' | 'C' // 本人から見た 右/左/両側/中央
  intensity: number // 強さ NRS 0〜10(0=痛みなし)
  qualities: string[] // 痛みの種類。例 "sharp" "dull" "numb"
  timings: string[] // 痛む時。例 "training" "night" "morning"
  movements: string[] // 痛む動き。例 "push" "squat" "overhead"
  onset?: string // 始まり方 "sudden" | "gradual" | "unknown"
  exerciseIds: string[] // 関連しそうな種目(exercises.id)
  note?: string
  createdAt: number
  updatedAt: number
}
```

**読み方の注意:**

- 左右は**本人から見た**左右。`B`=両側、`C`=体の中心線上(首・背骨など。体幹の部位でのみ使う)
- `intensity` は医療で使われる NRS(0=痛みなし、10=想像できる最悪の痛み)。目安は 1〜3 軽い、4〜6 中くらい、7〜9 強い
- `intensity: 0` の行は「その日は痛くなかった(回復)」の記録。痛みの経過を追うときの終点になる
- 同じ `area + side` の行を日付順に並べると、その痛みの経過になる(アプリの「痛みの経過」画面と同じまとめ方)
- `onset` は基本的にその部位×左右を初めて記録した日だけに入る
- `area: "head"`(頭、v1.0.28〜)は頭痛の分類で使う場所の区分(おでこ・こめかみ・頭頂部・後頭部・目の奥・頭全体)と顎関節を持つ
- `regionIds` / `qualities` / `timings` / `movements` / `exerciseIds` は未選択なら空配列(`[]`)

#### コード一覧

**部位(`area` / `regionIds`)** — `regionIds` は `<area>.<細部>` 形式

| `area`      | 部位             | 左右の選択肢            | `regionIds`(細かい場所)                                                                                                                                                                                                                             |
| ----------- | ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `head`      | 頭               | C=中央 R=右 L=左 B=両側 | `head.frontal` おでこ(前頭部)<br>`head.temporal` こめかみ(側頭部)<br>`head.parietal` てっぺん(頭頂部)<br>`head.occipital` 後頭部(首との境目あたり)<br>`head.orbital` 目の奥・目のまわり<br>`head.whole` 頭全体<br>`head.jaw` 顎(顎関節・食いしばり) |
| `neck`      | 首(頸部)         | C=中央 R=右 L=左 B=両側 | `neck.posterior` 後ろ(うなじ)<br>`neck.lateral` 横<br>`neck.base` 付け根〜肩の上(僧帽筋上部)<br>`neck.anterior` 前                                                                                                                                  |
| `shoulder`  | 肩               | R=右 L=左 B=両側        | `shoulder.anterior` 前側<br>`shoulder.lateral` 外側(三角筋)<br>`shoulder.posterior` 後ろ側<br>`shoulder.superior` 上(肩鎖関節のあたり)<br>`shoulder.deep` 奥の方(場所がはっきりしない)                                                              |
| `upperArm`  | 上腕             | R=右 L=左 B=両側        | `upperArm.anterior` 前側(力こぶ・上腕二頭筋)<br>`upperArm.posterior` 後ろ側(上腕三頭筋)                                                                                                                                                             |
| `elbow`     | 肘               | R=右 L=左 B=両側        | `elbow.lateral` 外側(外側上顆・テニス肘の場所)<br>`elbow.medial` 内側(内側上顆・ゴルフ肘の場所)<br>`elbow.posterior` 後ろ(肘頭・肘の先)<br>`elbow.anterior` 前(肘の内側のくぼみ)                                                                    |
| `forearm`   | 前腕             | R=右 L=左 B=両側        | `forearm.flexor` 手のひら側<br>`forearm.extensor` 手の甲側                                                                                                                                                                                          |
| `wrist`     | 手首             | R=右 L=左 B=両側        | `wrist.radial` 親指側(橈側)<br>`wrist.ulnar` 小指側(尺側)<br>`wrist.dorsal` 甲側<br>`wrist.palmar` 手のひら側                                                                                                                                       |
| `hand`      | 手・指           | R=右 L=左 B=両側        | `hand.thumb` 親指<br>`hand.fingers` 指(親指以外)<br>`hand.palm` 手のひら<br>`hand.dorsum` 手の甲                                                                                                                                                    |
| `chest`     | 胸               | C=中央 R=右 L=左 B=両側 | `chest.pectoral` 胸の筋肉(大胸筋)<br>`chest.sternum` 胸の中央(胸骨)<br>`chest.ribs` 肋骨・脇                                                                                                                                                        |
| `abdomen`   | お腹             | C=中央 R=右 L=左 B=両側 | `abdomen.upper` 上の方<br>`abdomen.lower` 下の方<br>`abdomen.side` 脇腹                                                                                                                                                                             |
| `upperBack` | 背中(胸椎部)     | C=中央 R=右 L=左 B=両側 | `upperBack.spine` 背骨そのもの(胸椎)<br>`upperBack.paraspinal` 背骨のすぐ横の筋肉<br>`upperBack.interscapular` 肩甲骨の間<br>`upperBack.scapula` 肩甲骨まわり                                                                                       |
| `lowBack`   | 腰(腰椎部)       | C=中央 R=右 L=左 B=両側 | `lowBack.spine` 背骨そのもの(腰椎)<br>`lowBack.paraspinal` 背骨のすぐ横の筋肉<br>`lowBack.sacroiliac` 骨盤の付け根(仙腸関節)<br>`lowBack.sacrum` お尻の割れ目の上(仙骨・尾骨)                                                                       |
| `hip`       | 股関節           | R=右 L=左 B=両側        | `hip.anterior` 前(脚の付け根・鼠径部)<br>`hip.lateral` 外側(大転子のあたり)<br>`hip.posterior` 後ろ<br>`hip.deep` 奥の方(場所がはっきりしない)                                                                                                      |
| `buttock`   | お尻             | R=右 L=左 B=両側        | `buttock.gluteal` お尻の筋肉(臀筋)<br>`buttock.ischial` 座ると当たる骨(坐骨)                                                                                                                                                                        |
| `thigh`     | 太もも           | R=右 L=左 B=両側        | `thigh.anterior` 前(大腿四頭筋)<br>`thigh.posterior` 裏(ハムストリングス)<br>`thigh.medial` 内側(内転筋)<br>`thigh.lateral` 外側(腸脛靭帯)                                                                                                          |
| `knee`      | 膝               | R=右 L=左 B=両側        | `knee.anterior` 前(膝のお皿まわり)<br>`knee.infrapatellar` お皿のすぐ下(膝蓋腱)<br>`knee.medial` 内側<br>`knee.lateral` 外側<br>`knee.posterior` 裏(膝窩)                                                                                           |
| `lowerLeg`  | すね・ふくらはぎ | R=右 L=左 B=両側        | `lowerLeg.anterior` すね(前)<br>`lowerLeg.medial` すねの内側(シンスプリントの場所)<br>`lowerLeg.posterior` ふくらはぎ                                                                                                                               |
| `ankle`     | 足首             | R=右 L=左 B=両側        | `ankle.lateral` 外側(外くるぶしのまわり)<br>`ankle.medial` 内側(内くるぶしのまわり)<br>`ankle.anterior` 前<br>`ankle.posterior` 後ろ(アキレス腱)                                                                                                    |
| `foot`      | 足               | R=右 L=左 B=両側        | `foot.plantar` 足の裏<br>`foot.heel` かかと<br>`foot.dorsum` 足の甲<br>`foot.toes` 足の指                                                                                                                                                           |

**痛みの種類(`qualities`)**

| コード        | 意味                   |
| ------------- | ---------------------- |
| `sharp`       | 鋭い(ズキッ)           |
| `throbbing`   | ズキズキ               |
| `dull`        | 鈍い・重だるい         |
| `tight`       | 張り・こわばり         |
| `numb`        | しびれ                 |
| `radiating`   | 電気が走る・響く       |
| `burning`     | 焼けるよう             |
| `catching`    | 引っかかる             |
| `instability` | 抜ける・ぐらつく       |
| `swelling`    | 腫れ                   |
| `heat`        | 熱っぽい               |
| `stiff`       | 動かしにくい           |
| `pressing`    | 締め付けられる・圧迫感 |

**痛む時(`timings`)**

| コード     | 意味             |
| ---------- | ---------------- |
| `training` | 運動中           |
| `after`    | 運動後           |
| `daily`    | 日常の動作       |
| `rest`     | じっとしていても |
| `night`    | 夜・寝ている時   |
| `morning`  | 朝起きた時       |
| `pressure` | 押すと痛い       |

**痛む動き(`movements`)**

| コード     | 意味               |
| ---------- | ------------------ |
| `push`     | 押す               |
| `pull`     | 引く               |
| `overhead` | 腕を上げる         |
| `grip`     | 握る               |
| `squat`    | しゃがむ           |
| `hinge`    | 前かがみ           |
| `extend`   | 反らす             |
| `twist`    | ひねる             |
| `load`     | 体重をかける・着地 |

**始まり方(`onset`)**

| コード    | 意味               |
| --------- | ------------------ |
| `sudden`  | 急に(きっかけあり) |
| `gradual` | だんだん           |
| `unknown` | わからない         |

---

## 旧バックアップとの互換性

| フィールド / テーブル   | 追加バージョン | 旧データでの扱い                                                             |
| ----------------------- | -------------- | ---------------------------------------------------------------------------- |
| `setAttributes`         | Dexie v2       | 省略可。import 時は空配列として扱う                                          |
| `bodyParts`             | Dexie v3       | 省略可。import 時はデフォルト 7 部位 + 種目の部位名から再構築                |
| `templates`             | Dexie v4       | 省略可。import 時は空配列として扱う                                          |
| `sets[].attributes[]`   | Dexie v5       | 旧 `attribute`(単数 string)は import 時に `attributes: [attribute]` へ正規化 |
| `locations[].sortOrder` | Dexie v6       | 旧データは `lastUsedAt` 降順で自動採番                                       |
| `blockNotes`            | Dexie v7       | 省略可。import 時は空配列として扱う                                          |
| `conditions`            | Dexie v8       | 省略可。import 時は空配列として扱う                                          |
| `painRecords`           | Dexie v8       | 省略可。import 時は空配列として扱う                                          |

---

## データの関係図

```
bodyParts ──← exercises ──────────────────┐
                                           │ exerciseId
tags ──────────────────────────────────── sets ── (主記録)
                                           │ tagId
                                           │ date ──→ days ──→ locations
blockNotes  ([date+exerciseId+tagId] の感想メモ)
setAttributes  (属性名の候補プール)         │
templates      (exerciseId + tagId のリスト)│
settings       (ユーザー設定)              │

conditions   (date ごとの体調・やる気。days とは独立)
painRecords  (date × area × side の痛み) ── exerciseIds[] ──→ exercises
```

- `sets` が中心テーブル。1 セット 1 行
- `exerciseId + tagId` の組み合わせが分析の基本単位
- `days` は 1 日 1 行のメタ情報(場所・その日全体の感想メモ)
- `blockNotes` は `date + exerciseId + tagId` 単位の感想メモ。ブロック(その日のその種目)に紐づく
- `conditions` / `painRecords` は日付で `days`・`sets` と突き合わせられるが、トレーニングしていない日の記録もある

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
    "days": [{ "date": "2026-07-08", "locationId": "loc-001", "note": "体調良好。少し暑かった" }],
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
    "templates": [],
    "blockNotes": [
      {
        "date": "2026-07-08",
        "exerciseId": "ex-001",
        "tagId": "tag-001",
        "note": "フォーム安定。次回は102.5kgに挑戦"
      }
    ],
    "conditions": [{ "date": "2026-07-08", "condition": 7, "motivation": 8 }],
    "painRecords": [
      {
        "id": "pain-001",
        "date": "2026-07-08",
        "area": "elbow",
        "regionIds": ["elbow.medial"],
        "side": "R",
        "intensity": 4,
        "qualities": ["sharp"],
        "timings": ["training", "pressure"],
        "movements": ["push"],
        "onset": "gradual",
        "exerciseIds": ["ex-001"],
        "note": "ラックアップの瞬間に痛む",
        "createdAt": 1720000000000,
        "updatedAt": 1720000000000
      }
    ]
  }
}
```
