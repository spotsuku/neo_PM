# NEO PM — Claude Code 作業ルール

## ブランチ運用 (本番リリース後)

**`main` は本番ブランチ。Claude が勝手にマージしてはいけない。**

- 既定の **base ブランチは `staging`**
- 開発ブランチは `staging` から切る (例: `claude/foo-bar`)
- PR の base は **必ず `staging`**
- `staging` への **auto-merge も人が確認してから**。デフォルトは merge せずに PR を作って終わる
- `main` へのマージはユーザが明示的に指示した時のみ（"main にマージして"、"本番に出して" 等の発話）
- ホットフィックスで main 直行が必要な場合も、必ず事前確認

## 推奨フロー

```
git fetch origin
git checkout staging
git pull origin staging
git checkout -b claude/<feature>
# 編集
git push -u origin claude/<feature>
gh pr create --base staging --title ... --body ...
# ここで止まる。マージはユーザの指示後
```

## 追記
- 過去 (リリース前) は main へ直接マージしていた。リリース以降は本ルール。
