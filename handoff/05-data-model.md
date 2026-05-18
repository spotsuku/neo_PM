# 05 — データモデル想定スキーマ

実装側の自由ですが、UI を満たすには **最低これだけ** 必要、という想定スキーマ。Postgres / Prisma を想定。

---

## Project（プロジェクト本体）

```prisma
model Project {
  id          String    @id @default(cuid())
  name        String                          // "みんなの通学路マップ"
  teamName    String                          // "NEW LINE"
  leadUserId  String
  memberIds   String[]                        // 5 名
  status      ProjectStatus                   // active / paused / completed / archived
  startedAt   DateTime
  dueAt       DateTime
  themeId     String?                         // 出題テーマからの紐付け

  // ─ ランキング用集計（updatedAt で再計算 or マテビュー） ─
  progressPct Int       @default(0)           // 0-100
  streakDays  Int       @default(0)           // 連続更新日
  badges      String[]                        // ["MVP伴走","現場主義",…]

  executionPlan ExecutionPlan?
  milestones    Milestone[]
  tasks         Task[]
  budgetItems   BudgetItem[]
  diagnoses     DiagnosisEntry[]
  applications  FundApplication[]
  proposals     Proposal[]
  events        Event[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum ProjectStatus { active paused completed archived }
```

ライブラリ表示は `status != active` のものをまとめる（プロト 1. ランキング画面）。

---

## ExecutionPlan（実行計画）

```prisma
model ExecutionPlan {
  id        String   @id @default(cuid())
  projectId String   @unique
  project   Project  @relation(fields:[projectId], references:[id])

  // Why/Who/What/How
  why       String   @default("")
  who       String   @default("")
  what      String   @default("")
  how       String   @default("")

  // 4P
  product   String   @default("")
  price     String   @default("")
  place     String   @default("")
  promotion String   @default("")

  // 目標
  qualitativeGoal String @default("")
  kpis            Kpi[]

  // AI 評価 (キャッシュ、計算は別 ETL)
  scores    Json?    // { why: 88, who: 74, what: 82, how: 60 }

  updatedAt DateTime @updatedAt
}

model Kpi {
  id        String   @id @default(cuid())
  planId    String
  label     String     // "延べ参加"
  target    String     // "200名" (自由文字列)
  progress  Int        // 0-100 (実績/目標 の %)
}
```

---

## Milestone（マイルストーン）

```prisma
model Milestone {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields:[projectId], references:[id])
  label      String
  date       DateTime
  done       Boolean  @default(false)
  // 進行中は「最初の未完了マイルストーン」を計算で出す
}
```

---

## Task / WBS

```prisma
model Task {
  id        String     @id @default(cuid())
  projectId String
  project   Project    @relation(fields:[projectId], references:[id])
  
  parentId  String?                            // フェーズ階層 (1段だけで十分)
  parent    Task?      @relation("subtasks", fields:[parentId], references:[id])
  children  Task[]     @relation("subtasks")

  title     String
  ownerName String                             // 簡易表示用 (高校生)
  startWeek Int                                // プロジェクト開始からの週
  spanWeek  Int                                // 期間（週）
  progress  Int        @default(0)             // 0-100
  status    TaskStatus
  isMilestone Boolean  @default(false)         // ガントの菱形マーカー
  tag       String?                            // "現場"/"資料"/"申請"/"広報"/"連携"

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum TaskStatus { todo doing review done }
```

WBS 画面のガントは `startWeek × spanWeek` を `0..28週` で表示。1 週 = 24px (調整可)。

---

## BudgetItem（収支）

```prisma
model BudgetItem {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields:[projectId], references:[id])

  kind      BudgetKind                          // income / expense
  category  String                              // "NEO基金" "会場・設営" …
  name      String                              // "会場使用料 (体育館)"
  planJpy   Int                                 // 80000
  actualJpy Int      @default(0)
  isPending Boolean  @default(false)            // "未確定" チップ表示

  month     Int?                                // 1-12 (月次推移チャート用)
}

enum BudgetKind { income expense }
```

---

## DiagnosisEntry（14 項目診断 / 週次）

```prisma
model DiagnosisEntry {
  id        String   @id @default(cuid())
  projectId String
  project   Project  @relation(fields:[projectId], references:[id])

  weekStart DateTime                            // その週の月曜
  
  // 14 項目: 0(×) / 1(△未満) / 2(△) / 3(○)
  scores    Json     // { "目標設定": 3, "戦略力": 3, … }

  // AI 総評・項目別コメント
  totalComment String?
  itemComments Json?  // { "衝突力": "意見を率直に伝える試みを始めましょう", … }

  createdAt DateTime @default(now())
}
```

トラッキング = 同一 projectId × 異なる weekStart の集合。プロト 6. 診断レポート画面の sparkline はここから 4 週分。

14 項目は `prototype/data.jsx` の `NEO.radar` 配列に説明文あり。

---

## FundApplication（NEO 基金申請）

```prisma
model FundApplication {
  id        String        @id @default(cuid())
  projectId String
  project   Project       @relation(fields:[projectId], references:[id])

  round     Int                                  // 1=初期 / 2=中間 / 3=最終
  status    FundStatus                           // draft / firstReview / secondReview / approved / rejected
  amountJpy Int

  reason       String                            // 申請理由
  purposes     Json                              // [{ item:"会場費", amount:80000, ratio:32 }]
  attachments  String[]                          // ファイル名 or URL

  submittedAt DateTime?
  decidedAt   DateTime?

  // AI 添削の最新スナップショット
  aiHints   Json?  // [{ n:'1', title:'…', detail:'…', kind:'warn' }]

  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

enum FundStatus { draft firstReview secondReview approved rejected }
```

---

## Theme（出題テーマ）

```prisma
model Theme {
  id         String    @id @default(cuid())
  code       String    @unique                  // "NEO-001"
  sponsorId  String                              // 企業
  sponsor    Sponsor   @relation(fields:[sponsorId], references:[id])
  title      String
  description String
  category   String                              // "スポーツ×地域" 等
  status     ThemeStatus                         // open / draft / closed
  deadline   DateTime?
  prize      String?                             // "実証実験@2/9" 等

  projects   Project[]                           // 紐づくチャレンジプロジェクト群

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

enum ThemeStatus { open draft closed }

model Sponsor {
  id     String @id @default(cuid())
  name   String                                  // "ライジングゼファー福岡"
  logo   String?
  themes Theme[]
}
```

---

## Proposal（AI 提案カード）

`04-ai-integration.md` 参照。

```prisma
model Proposal {
  id         String         @id @default(cuid())
  projectId  String
  project    Project        @relation(fields:[projectId], references:[id])

  kind       ProposalKind
  status     ProposalStatus @default(pending)
  summary    String
  diff       Json                                // 04-ai-integration.md の ProposalDiff
  reasoning  String?

  createdAt  DateTime       @default(now())
  decidedAt  DateTime?
  decidedBy  String?                             // userId

  @@index([projectId, status])
}

enum ProposalKind   { execution_plan wbs budget promo application theme diagnosis }
enum ProposalStatus { pending approved rejected }
```

---

## Event（カレンダー）

```prisma
model Event {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields:[projectId], references:[id])

  date       DateTime
  time       String                              // "14:00" 自由文字列
  label      String                              // "高校生インタビュー @ 筑紫丘高校"
  kind       String                              // "現場" / "定例" / "公式" / "本番"
  
  createdAt  DateTime @default(now())
}
```

ダッシュボード右側の「直近イベント」+ プロジェクト個別の `events` リレーション。

---

## User / 認証

NEO 側で既存実装あれば従う。最低限：

```prisma
model User {
  id    String @id
  name  String
  email String @unique
  avatarColor String?                            // "linear-gradient(135deg, #5b8def, #2e5cbf)" のような
  // …
}
```

Userは複数チームに所属 → Project.memberIds で紐付け。

---

## 集計の更新タイミング

| 値 | 計算方法 | タイミング |
|---|---|---|
| `Project.progressPct` | done Task 数 / 全 Task 数 | Task 更新時に再計算 (or マテビュー nightly) |
| `Project.streakDays` | 直近の連続更新日 | 任意の更新時 |
| `Project.badges` | バッジ条件マッチ | 達成イベント時 |
| `ExecutionPlan.scores` | AI 評価 | 計画更新後の AI バックグラウンド |
| `DiagnosisEntry` | 週次集計 | 週1 cron + 手動再評価 |

集計が重ければ **Read Model** を別途持つ（views or denormalized table）。
