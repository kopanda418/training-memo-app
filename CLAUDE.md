# 筋トレ記録メモアプリ (Training Memo App)

iPhone で使う筋トレ記録 PWA。既存アプリ「筋トレmemo」(https://kintorememo.jp/) をベースに、独自の差分機能を加えたもの。サーバーレス・完全ローカル・費用ゼロ構成。

## セッション開始時に必ず行うこと

1. `docs/STATUS.md` を読む — 現在の進捗・作業中のマイルストーン・次のタスクが書いてある
2. 着手するマイルストーンの完了条件を `docs/roadmap.md` で確認する

## ドキュメント構成

| ファイル | 内容 | 更新タイミング |
|---|---|---|
| `docs/requirements.md` | 要件定義(機能・非機能・除外事項) | 要件変更時のみ |
| `docs/architecture.md` | 技術構成・データモデル・画面設計 | スキーマ/構成変更時に同時更新 |
| `docs/roadmap.md` | 開発計画(マイルストーンと完了条件) | マイルストーン完了時 |
| `docs/decisions.md` | 設計判断の記録(ADR) | 技術選定・設計を変更する前に追記 |
| `docs/STATUS.md` | 進捗と引き継ぎメモ | 毎セッション終了時(/handoff) |

## 技術スタック(要点)

- Vite + React + TypeScript / Tailwind CSS(ダークモードは `class` 戦略)
- データ: Dexie.js (IndexedDB) + dexie-react-hooks の `useLiveQuery`
- PWA: vite-plugin-pwa (Workbox precache、オフライン完結)
- グラフ: Chart.js (react-chartjs-2)
- ホスティング: GitHub Pages(GitHub Actions で main への push 時に自動デプロイ)
- バックエンドなし。全データは端末内 IndexedDB。バックアップは JSON エクスポート/インポート

選定理由と却下案は `docs/decisions.md` を参照。

## コマンド(M0 完了後に有効)

```
npm run dev      # 開発サーバー
npm run build    # 本番ビルド(tsc --noEmit を含む)
npm run test     # Vitest
npm run lint     # ESLint + Prettier チェック
```

## 開発ルール

- **記録入力の応答速度が最優先。** 入力操作の経路にネットワーク・重い再レンダリングを挟まない。書き込みは IndexedDB へ直行し、UI は `useLiveQuery` で即時反映
- 種目×タグ(variant)がデータモデルの根幹。履歴・グラフ・MAX 判定はすべてこの複合単位で扱う(`docs/architecture.md` 参照)
- Dexie のスキーマ変更は必ず `db.version(n+1)` でマイグレーションを書き、`docs/architecture.md` のデータモデル表を同時に更新する
- 技術選定や設計を変える場合は、先に `docs/decisions.md` に ADR を追記してから実施
- コミットは機能単位で小さく。Conventional Commits(`feat:` `fix:` `docs:` `refactor:` `chore:` `test:`)
- UI テキストは日本語。日付キーは `YYYY-MM-DD` 文字列(端末ローカルタイムゾーン基準)
- iOS Safari (16.4+) が動作基準。PC の Chrome で動いても iOS で動かない API がある(Wake Lock・通知・vibration 等は `docs/architecture.md` の「iOS 制約」を確認)
- **セッション終了時は `/handoff` を実行**(STATUS.md 更新 + コミット)
