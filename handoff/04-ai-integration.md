# 04 — AI 連携仕様

NEO PM の AI 伴走者は **"提案カード型"** で動きます。会話 → AI が JSON 形式の提案を発行 → ユーザーが ✓ 承認すると各画面に反映、という流れ。

---

## 全体像

```
┌─────────────┐    質問       ┌──────────────┐
│ ユーザー    │ ────────────→ │ Claude / LLM │
│ (会話 / 画面)│ ←──────────── │ + システム    │
└─────────────┘   テキスト+    │ プロンプト   │
       │          提案カード   └──────────────┘
       │                              │
       │ ✓承認                         │
       ▼                              │
┌─────────────┐                       │
│  画面に反映  │← 既存データ修正 ──────┘
│ (実行計画/   │
│  WBS/収支等)│
└─────────────┘
```

---

## 提案カード スキーマ

すべての AI 提案は同じ shape：

```ts
type Proposal = {
  id:        string;                          // 'pr_2026_01_18_1234'
  kind:      ProposalKind;                    // 反映先の種類
  status:    'pending' | 'approved' | 'rejected';
  summary:   string;                          // 一文の要約（カード表示用）
  diff:      ProposalDiff;                    // 反映の中身
  reasoning?: string;                          // 「なぜそうしたか」
  createdAt: string;                          // ISO
};

type ProposalKind =
  | '実行計画'   // Why/Who/What/How の修正
  | 'WBS'        // タスクの追加・統合・並べ替え
  | '収支'       // 予算項目の追加・編集
  | 'プロモ'     // 広報・告知文の改善
  | '申請文'     // NEO基金申請の文章改善
  | 'テーマ詳細' // テーマ出題側 (出題者向け)
  | '診断';      // 14項目の自己評価アシスト
```

`ProposalDiff` の中身は kind により異なる：

```ts
type ProposalDiff =
  | { kind: '実行計画', field: 'Why'|'Who'|'What'|'How', oldValue: string, newValue: string }
  | { kind: 'WBS',      ops: WbsOp[] }                                    // 複数操作の組
  | { kind: '収支',     adds?: BudgetItem[], edits?: BudgetEdit[] }
  | { kind: '申請文',   field: '理由'|'用途内訳', oldValue: string, newValue: string }
  | …;

type WbsOp =
  | { op: 'mergeIntoWeek', taskIds: string[], targetWeek: string, newTitle: string }
  | { op: 'addTask',       task: Partial<Task> }
  | { op: 'reorder',       taskId: string, before: string };
```

UI は `diff` を見て **何が変わるか** を必ず表示してから ✓ を押させる（プロト 03 参照）。

---

## ライフサイクル

### 1. 質問 / 観察 → 提案発生

トリガー:
- ユーザーがチャット送信
- 一定時間ごとの自動観察（"今週の停滞" 等）
- 画面遷移時の文脈チェック

```ts
// 例: 実行計画画面で How の AI 評価が低い
await ai.observe({ 
  trigger: 'screen.plan.opened',
  project: projectId,
});
// → サーバー側で Claude が「How が薄い」を検知し、Proposal を発行
```

### 2. 提案カードを保存 & 通知

サーバーが `proposals` テーブルに insert → `pending` 件数を浮遊 AI バッジに表示（プロト：✦ ボタン右上の `3`）。

### 3. ユーザー操作

| アクション | 動作 |
|---|---|
| ✓ 承認 | `diff` を該当エンティティに適用、status = approved |
| 却下 | 適用なし、status = rejected |
| ↻ 別案 | 同じ kind + context で再生成（理想的には rejection reason を渡す） |
| AI に任せる ON | pending 提案を自動承認（バックグラウンド） |

### 4. 反映

差分を該当エンティティに反映:

```ts
async function applyProposal(p: Proposal) {
  switch (p.diff.kind) {
    case '実行計画':
      await db.executionPlan.update({
        where: { projectId },
        data:  { [p.diff.field]: p.diff.newValue },
      });
      break;
    case 'WBS':
      for (const op of p.diff.ops) await applyWbsOp(op);
      break;
    // …
  }
  await db.proposal.update({ where:{id:p.id}, data:{status:'approved'} });
  await audit.log({ type:'ai.proposal.applied', proposalId:p.id, by:userId });
}
```

すべての反映は **監査ログに残す** こと（後から「これは AI が変えた」がわかる）。

---

## システムプロンプト（参考）

```
あなたは NEO の応援資本主義に共鳴する PM 伴走者「NEO.ai」です。
高校生〜大学生の挑戦者を、対話と提案で支えます。

トーン:
- 親しみ / 励まし / 一歩先を提案する
- 評価しない、押し付けない
- ✨ や 🌱 のような絵文字を控えめに

提案カードを発行するとき:
- 一文サマリは具体的に (例: 「Why を "通学路の交通弱者" に絞り直す案」)
- diff は最小単位で (1 提案 1 変更)
- "なぜそうしたか" を 30 字以内で

判断基準: NEO の 14 項目評価軸（目標設定、戦略力、… ）に照らして
"成長機会のある一手" を提案する。
```

---

## プロト側の動作（参考）

`Cv2_FloatingAI` / `Cv2_AI` のいずれも：

```jsx
const [proposals, setProposals] = useState(window.NEO.proposals);
const setStatus = (id, status) =>
  setProposals(props.map(p => p.id===id ? {...p, status} : p));
```

実装側では:

```ts
// server-side
POST /api/projects/:id/proposals     // 新規発行（AI 呼び出し）
GET  /api/projects/:id/proposals     // pending 一覧
POST /api/proposals/:id/approve      // applyProposal を実行
POST /api/proposals/:id/reject
POST /api/proposals/:id/regenerate
```

---

## レート制限・コスト

- **対話**: 1 プロジェクト 1 日 30 ターンまで（無料枠）
- **観察**: 1 画面遷移 1 回まで（重複は throttle）
- **モデル**: `claude-sonnet-4-5` 推奨（プロト動作確認は `claude-haiku-4-5`）

---

## エラー処理

- AI が応答しない: 浮遊ボタンに 〜 マーク、5秒で諦めて「あとで」と表示
- 提案 diff が古い (ベースが既に変わった): apply 時に 409 を返し、新しい提案を再生成
- ユーザーが連続却下 (3回): 「方向性を聞かせてください」と対話モードに遷移
