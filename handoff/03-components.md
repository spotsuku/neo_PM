# 03 — 共通コンポーネント

実装時に共通化すべきコンポーネント一覧。詳細は `prototype/variant-c-v2.jsx` と `prototype/variant-c-v2-extra.jsx` 参照。

---

## `<GlassCard variant="default"|"strong"|"dark">`

最頻出。すべてのカードはこれを使う。

```tsx
function GlassCard({ variant = 'default', className, children, ...rest }) {
  const cls = {
    default: 'glass',          // bg .7 / blur 22 / border .85
    strong:  'glass-strong',   // bg .85 / blur 28 / border .85
    dark:    'glass-dark',     // dark navy gradient + light border
  }[variant];
  return <div className={`${cls} rounded-[14px] ${className}`} {...rest}>{children}</div>;
}
```

ガラス CSS は `01-design-tokens.md` 参照。

---

## `<RingV2 size value color stroke label?/>`

進捗リング。

```tsx
function RingV2({ size = 72, stroke = 7, value = 0, color = 'var(--ink)', track = 'rgba(150,170,200,.18)', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-value/100)}
                style={{ transition: 'stroke-dashoffset .6s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:700,
                      fontSize: size/4, letterSpacing:'-.04em' }}>{value}</div>
        {label && <div style={{ fontSize: size/9, color: 'var(--mute)' }}>{label}</div>}
      </div>
    </div>
  );
}
```

色の使い分け（推奨）：
- 進捗率: `var(--c-accent)`
- スコア > 80: `var(--ok)`
- スコア 65-80: `var(--warn)`
- スコア < 65: `var(--c-accent)` (注意)

---

## `<HexRadar data size?/>`

14 項目評価のヘックスレーダー。

```tsx
function HexRadar({ data, size = 260 }) {
  // data: [{ k: '目標設定', v: 3 }, …]
  // 14 軸を等間隔配置、3 段のレベル線、現在値をポリゴンで描画
  // see prototype/variant-c-v2-extra.jsx Cv2_Diag
}
```

スタイル:
- 軸線: `rgba(150,170,200,.18)`
- レベル線: `rgba(150,170,200,.25)` (1px)
- 現在ポリゴン: fill `rgba(91,141,239,.12)` + stroke `var(--c-accent)` 2.5px
- 頂点: 黒ドット 3.5px + 白枠 2px

---

## `<Sparkline arr size?/>`

週次推移の小ライン。

```tsx
function Sparkline({ arr, w = 60, h = 18, max = 3 }) {
  const pts = arr.map((v,i) => `${(i/(arr.length-1))*w},${h-(v/max)*h}`).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none"
                style={{ stroke: 'var(--c-accent)' }} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={w} cy={h - (arr.at(-1)/max)*h} r="2" fill="var(--c-accent)"/>
    </svg>
  );
}
```

---

## `<FloatingAI proj/>`

右下に常駐する AI 伴走者キャラクター + 吹き出し + 展開パネル。

**ボタン仕様**:
- 60×60 円、border 2px 白
- 背景: `linear-gradient(160deg, #1a2540 0%, var(--c-accent-deep) 60%, var(--c-accent) 100%)`
- 中央に ✦ (26px、`animation: sparkle 3s infinite`)
- 右上に未読数バッジ (18×18 白、accent-deep 文字)
- shadow: `0 14px 36px -8px rgba(40,80,180,.55), 0 0 0 6px rgba(91,141,239,.12)`

**吹き出し** (`!aiOpen` の時のみ):
- `glass-dark`、右下から左上に向かう角丸 14/14/0/14
- "今週の Why を3分で整理しませんか？✨" のような声かけ
- `data-c-fun="playful"` で囲み、Pro モードで非表示
- 右下に三角しっぽ

**展開パネル** (`aiOpen` の時):
- 420×(max 100% - 130px)、`glass-strong` 表面
- ヘッダー: `glass-dark` 帯にアバター（conic-gradient + ✦）、名前、⤢ (全画面遷移) + ✕
- 本体: チャット履歴 → 提案カードリスト
- フッター: 入力欄 + 送信ボタン

**ナビ連動**:
- ⤢ は `setScreen('ai')` で AI 伴走者画面に遷移
- 浮遊版とフル版で同じ会話状態を共有（実装では Context か Zustand）

---

## `<TabPill k emo label active onClick/>`

ヘッダーの 9 タブ。

```tsx
<button style={{
  display:'flex', alignItems:'center', gap:5, padding:'6px 11px',
  border:0, borderRadius:99, fontSize:11, whiteSpace:'nowrap',
  background: active ? '#0a0a0a' : '#fff',
  color:      active ? '#fff'   : 'var(--mute)',
  boxShadow:  active ? '0 2px 12px rgba(10,10,10,.18)' : '0 1px 0 var(--line-soft)',
  fontWeight: active ? 600 : 500,
}}>{emo} {label}</button>
```

9 タブ: 🏆 ランキング / 🚀 ダッシュ / 🎯 実行計画 / 📋 WBS / 💴 収支 / 🔍 診断 / 📨 基金申請 / ✨ AI伴走 / 📣 テーマ出題

---

## `<StatusDot status/>`

プロジェクトステータス丸。

| status | color |
|---|---|
| active | `var(--c-accent)` |
| paused | `var(--warn)` |
| completed | `var(--ok)` |
| archived | `var(--mute)` (opacity .4) |

---

## `<MilestoneBar items/>`

ダッシュボードの横並びマイルストーン。

- 各点: 28-32px 円、完了=黒, 現在=accent + 5px ソフトリング, 未来=白
- 進捗線: 黒→accent グラデ、長さは完了割合
- ラベル: 日付 (小) + マイルストーン名 (現在のみ accent 太字)

---

## `<Confetti count?/>`

ダッシュボード入場時の祝福アニメーション。

```tsx
{showConfetti && (
  <div data-c-fun="playful" style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
    {Array.from({length: 24}).map((_, i) => (
      <span key={i} style={{
        position:'absolute', top:0, left:`${i*4.2}%`, width:6, height:10,
        background: ['var(--c-accent)', '#0a0a0a', 'var(--warn)', 'var(--ok)'][i%4],
        animation: `confetti 1.4s ${i*40}ms ease-out forwards`,
      }}/>
    ))}
  </div>
)}
```

`data-c-fun="playful"` で囲んでおき、設定で出し分け。

---

## レイアウトコンポーネント

### `<AppShell>`
- 全画面 1400×920 (デモ用、実際はレスポンシブ)
- 上: ヘッダー (74px)
- 下: 各画面ルート (overflow:auto)
- 右下: `<FloatingAI/>` (absolute)
- 背景: `.mesh-blue`

### 画面共通 padding
- `padding: 22px 28px 28px` (上左右下)
- カードグループ間 gap: 14-18px
