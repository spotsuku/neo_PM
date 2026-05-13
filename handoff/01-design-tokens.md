# 01 — デザイントークン

`globals.css` または `tokens.css` に **そのままコピペ** で動きます。

## カラー

```css
:root{
  /* ── Base ──────────────────────────────────────── */
  --ink:           #0a0a0a;     /* 主要テキスト */
  --ink-2:         #1a1a1a;     /* やや薄いテキスト */
  --mute:          #6b7a92;     /* 補足テキスト */
  --mute-2:        #9aa4bb;     /* キャプション・無効色 */
  --line:          rgba(150,170,200,.25);   /* 罫線・ボーダー */
  --line-soft:     rgba(150,170,200,.15);
  --bg:            #ffffff;
  --bg-2:          #fafaf9;

  /* ── Accent (Cool Glass / 既定) ──────────────── */
  --c-accent:        #5b8def;   /* 主要アクセント */
  --c-accent-deep:   #2e5cbf;   /* 押下・濃色 */
  --c-accent-soft:   #e6efff;   /* チップ背景 */
  --c-accent-bright: #bcd2ff;   /* 暗背景上の強調 */

  /* ── Status ────────────────────────────────────── */
  --ok:    #0a8754;
  --warn:  #b8860b;
  --error: #c0392b;             /* 必要に応じて */

  /* ── Glass surfaces ──────────────────────────── */
  --glass-bg:        rgba(255,255,255,.7);
  --glass-bg-strong: rgba(255,255,255,.85);
  --glass-border:    rgba(255,255,255,.85);
  --glass-blur:      22px;      /* Frost = frosted の値 */
  --glass-shadow:    0 1px 0 rgba(255,255,255,.9) inset, 0 8px 28px -16px rgba(40,70,140,.18);

  /* ── Mesh background (Cool Glass) ────────────── */
  --c-mesh-a:   rgba(91,141,239,.22);
  --c-mesh-b:   rgba(150,200,255,.30);
  --c-mesh-c:   rgba(91,141,239,.16);
  --c-bg-1:     #f6f9ff;
  --c-bg-2:     #eef3fc;
}
```

## タイポグラフィ

| 役割 | フォント | サイズ | weight |
|---|---|---|---|
| プレーン本文 | Noto Sans JP | 12–13 px | 400 |
| 強調本文 | Noto Sans JP | 12–13 px | 600 |
| 見出し H2 | Noto Sans JP | 20 px | 800 / letter-spacing -.02em |
| 見出し H3 | Noto Sans JP | 14 px | 700–800 |
| 巨大数値 | JetBrains Mono | 22–46 px | 700–800 / letter-spacing -.04em |
| キャプション | Noto Sans JP | 10–11 px | 400 / color: var(--mute) |
| ラベル / タグ | Noto Sans JP | 9–10 px | 700 / letter-spacing .05–.15em / UPPER 風 |
| 等幅 | JetBrains Mono | 10–11 px | 500–600 |

```html
<!-- Webfont をロード -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

## スペーシング & 角丸

| トークン | 値 |
|---|---|
| `--r-sm` | 8 px |
| `--r-md` | 12 px |
| `--r-lg` | 14 px |
| `--r-xl` | 18 px |
| `--r-pill` | 99 px |
| カード内 padding | 14–18 px |
| ページ padding | 22–28 px |
| カード間 gap | 10–18 px |

## 影 / 浮き

```css
/* ガラスカード（標準） */
box-shadow:
  0 1px 0 rgba(255,255,255,.9) inset,
  0 8px 28px -16px rgba(40,70,140,.18);

/* 浮遊 AI ボタン */
box-shadow:
  0 14px 36px -8px rgba(40,80,180,.55),
  0 0 0 6px rgba(91,141,239,.12),
  inset 0 1px 0 rgba(255,255,255,.35);

/* ホバー時のリフト */
transform: translateY(-2px);
box-shadow: 0 14px 40px -12px rgba(70,110,200,.35);
```

## ガラス3種

```css
/* 既定 (.glass) — 半透明 + 弱ブラー */
.glass{
  background: var(--glass-bg);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

/* 強め (.glass-strong) — ヘッダーや浮遊パネル */
.glass-strong{
  background: var(--glass-bg-strong);
  backdrop-filter: blur(28px) saturate(1.5);
}

/* 暗色 (.glass-dark) — クエスト・AI ヒント・公開プレビュー */
.glass-dark{
  background: linear-gradient(160deg, rgba(28,40,72,.85), rgba(15,22,46,.92));
  backdrop-filter: blur(20px);
  border: 1px solid rgba(150,180,255,.18);
  color: #fff;
  box-shadow: 0 18px 60px -20px rgba(20,30,80,.4), inset 0 1px 0 rgba(255,255,255,.08);
}
```

## メッシュ背景

```css
.mesh-blue{
  background:
    radial-gradient(900px 600px at 12% -10%, var(--c-mesh-a), transparent 60%),
    radial-gradient(700px 500px at 95%  10%, var(--c-mesh-b), transparent 60%),
    radial-gradient(800px 700px at 50% 110%, var(--c-mesh-c), transparent 60%),
    linear-gradient(180deg, var(--c-bg-1) 0%, var(--c-bg-2) 100%);
}
```

## アニメーション

```css
@keyframes sparkle  { 0%,100%{transform:scale(.9);opacity:.6} 50%{transform:scale(1.15);opacity:1} }
@keyframes confetti { 0%{transform:translateY(-10px) rotate(0);opacity:0} 10%{opacity:1} 100%{transform:translateY(420px) rotate(540deg);opacity:0} }
@keyframes risein   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes badgePop { 0%{transform:scale(.6) rotate(-8deg);opacity:0} 60%{transform:scale(1.1) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
```

## Tweakable トークン（内部用）

プロトタイプには Mood / Frost / Fun の切替がありますが、**本実装では Cool / Crisp / Festive で固定**して構いません。Tweaks は内部の調整用とし、`--c-accent` 等の **CSS 変数だけ** をテーマファイルとして外出ししておくと、将来カラーを変える時に楽です。

詳細は `prototype/styles.css` の `[data-c-mood]` / `[data-c-frost]` セクション参照。
