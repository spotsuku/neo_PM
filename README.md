# NEO PM v2

応援資本主義のためのプロジェクトマネジメントダッシュボード。
**テーマ出題者（企業）** と **テーマ挑戦者（若者）** が共創する場を支える。

> v1 は単一 `index.html` の vanilla JS 実装でした。`legacy/v1-vanilla` ブランチに保管されています。

## 技術スタック

- **Next.js 15** (App Router)
- **TypeScript** / **Tailwind CSS** / **shadcn-style** UI コンポーネント
- **Supabase** (Postgres + Auth + Realtime + Storage)
- **Anthropic Claude API** (AI 伴走者の対話 + 提案カード生成)
- **Vercel** デプロイ

## マルチ組織対応

1人のユーザーが複数の組織に所属可能。組織ごとにテーマ・プロジェクト・チームが分離されます（RLS で保護）。

- 新規サインアップ時に自動的に個人組織が作成されます (`auth.users` の trigger)
- ヘッダー右上の組織スイッチャーで切替
- URL は `/[orgSlug]/...` で組織がパスに含まれる

## ローカル開発

```bash
cp .env.example .env.local
# Supabase の URL/KEY と Anthropic API Key を設定

npm install
npm run dev
```

`http://localhost:3000` で起動します。

## Supabase セットアップ

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. SQL Editor で `supabase/migrations/0001_initial.sql` を実行
3. **Auth → Providers**:
   - Email Magic Link を有効化
   - Google OAuth を有効化（Google Cloud Console で Client ID/Secret を作成）
4. **Auth → URL Configuration**:
   - Site URL: `http://localhost:3000`（本番では Vercel ドメイン）
   - Redirect URLs に `/auth/callback` を追加

## ディレクトリ構成

```
neo_pm/
├── app/
│   ├── layout.tsx          # ルートレイアウト（フォント + mesh-blue 背景）
│   ├── page.tsx            # ルート: 認証状態で /login or /orgs に redirect
│   ├── login/              # ログインページ（magic link + Google）
│   ├── auth/callback/      # Supabase OAuth コールバック
│   ├── orgs/               # 組織一覧 + 新規作成
│   └── [orgSlug]/          # 組織スコープのすべての画面
│       ├── layout.tsx      # 9 タブナビ + 浮遊 AI
│       ├── page.tsx        # 🏆 ランキング（実装済み）
│       ├── dashboard/      # 🚀 プロジェクトダッシュボード（stub）
│       ├── plan/           # 🎯 実行計画（stub）
│       ├── wbs/            # 📋 WBS/ガント（stub）
│       ├── budget/         # 💴 収支計画（stub）
│       ├── diag/           # 🔍 診断レポート（stub）
│       ├── fund/           # 📨 NEO基金申請（stub）
│       ├── ai/             # ✨ AI伴走者（stub）
│       └── theme/          # 📣 テーマ出題（stub）
├── components/
│   ├── ui/                 # GlassCard / RingV2 / HexRadar / Sparkline / FloatingAI 等
│   ├── shell/              # Header / OrgSwitcher
│   ├── login/              # LoginForm
│   └── orgs/               # CreateOrgForm
├── lib/
│   ├── supabase/           # クライアント（browser / server / middleware）
│   ├── orgs.ts             # 組織 helper
│   ├── types/database.ts   # DB 型
│   └── utils.ts
├── supabase/
│   └── migrations/0001_initial.sql  # 全スキーマ + RLS + trigger
├── middleware.ts           # auth セッションリフレッシュ + ガード
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## デザイントークン

`app/globals.css` に Cool Glass / Frosted / Festive のトークン一式が入っています：

- `--c-accent` / `--c-accent-deep` / `--c-accent-soft` / `--c-accent-bright`
- `--glass-bg` / `--glass-blur` / `--glass-shadow`
- `--c-mesh-a/b/c` / `--c-bg-1/2`
- 角丸 `--r-sm/md/lg/xl/pill`

ユーティリティクラス: `.glass` / `.glass-strong` / `.glass-dark` / `.mesh-blue` / `.lift`
タイポ: `.t-h2 / .t-h3 / .t-big / .t-cap / .t-label / .t-mono`

詳細は `handoff/01-design-tokens.md` 参照。

## 実装ロードマップ

| 順 | 画面 | 状態 |
|---|---|---|
| 1 | 認証 + 組織管理 + シェル | ✅ 完了 |
| 2 | 🏆 ランキング | ✅ 基本版 |
| 3 | ＋ 新規プロジェクトウィザード | ⏳ stub |
| 4 | 🚀 ダッシュボード | ⏳ stub |
| 5 | 🎯 実行計画 | ⏳ stub |
| 6 | 📋 WBS/ガント | ⏳ stub |
| 7 | 💴 収支計画（月次PL） | ⏳ stub |
| 8 | 🔍 診断レポート | ⏳ stub |
| 9 | 📨 NEO基金申請 | ⏳ stub |
| 10 | ✨ AI 伴走者 + 提案カード | ⏳ stub |
| 11 | 📣 テーマ出題 + 公開プレビュー | ⏳ stub |

各画面の仕様は `handoff/02-screens.md` を参照。
