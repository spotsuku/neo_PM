# NEO PM Dashboard

NEO福岡プロジェクト管理ダッシュボード - Supabase + Vercelデプロイ版

## 機能

- 📊 **ダッシュボード** - KPI・進捗率・直近タスク・次のイベントをひと目で
- 📋 **WBS・タスク管理** - カテゴリ別タスク管理、ステータス更新（クリックでサイクル）
- 📅 **スケジュール管理** - タイムライン表示、必須/任意区分
- 💰 **収支計画** - Best/Good/Worst 3シナリオ対応、売上・原価・販管費
- 👥 **組織体制** - メンバーカード表示
- 📝 **議事録** - アジェンダ形式の議事録作成
- 🤖 **AIコーチ** - Claude APIによるプロジェクトコーチング（リアルタイムデータ連携）
- 🔄 **リアルタイム更新** - Supabase Realtime対応

## セットアップ

### 1. Supabase設定

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. SQL EditorでSQLスキーマを実行:
   ```
   supabase_schema.sql の内容をSQL Editorに貼り付けて実行
   ```
3. Settings > API から以下を取得:
   - Project URL
   - anon/public Key

### 2. Vercelデプロイ

```bash
# 方法1: Vercel CLI
npm i -g vercel
cd neo-pm-dashboard
vercel

# 方法2: GitHub経由
# このフォルダをGitHubにpush → Vercelでインポート
```

### 3. 初期設定

1. デプロイしたURLにアクセス
2. 左メニュー「設定」からSupabase URL・Keyを入力
3. 「保存して接続」をクリック
4. 「新規プロジェクト作成」からプロジェクトを作成

### 4. Excelデータのインポート（オプション）

既存のXLSXファイルからデータをインポートする場合は、
Supabaseのテーブルエディタから直接CSVインポートが可能。

## ディレクトリ構成

```
neo-pm-dashboard/
├── index.html          # メインアプリ（単一ファイル）
├── supabase_schema.sql # DBスキーマ
├── README.md
└── vercel.json         # Vercel設定
```

## AIコーチについて

- Claude API (claude-sonnet-4-20250514) を使用
- プロジェクトの現在データ（タスク・スケジュール・収支・チーム）を自動でコンテキストに含めて質問
- クイックボタン: 進捗レビュー、リスク分析、WBS改善提案、次のアクション、予算チェック、チームアドバイス

## Supabase Realtime

以下のテーブルがリアルタイム同期対応:
- `tasks` - タスクの追加・更新・削除
- `schedule_events` - イベントの追加・更新
- `budget_items` - 収支項目の更新

複数ユーザーが同時編集しても自動で画面が更新されます。
