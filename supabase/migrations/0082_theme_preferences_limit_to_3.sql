-- ============================================================
-- 0082_theme_preferences_limit_to_3.sql
-- 意識調査を第1〜第3希望までに変更 (旧: 第1〜第5希望)
-- 既存の第4/第5希望データは削除。CHECK 制約を 1..3 に更新。
--
-- Rationale:
--   - 5 段階まで書ける負担が高く、実用上は 3 つで十分だとフィードバック
--   - 第4/第5 の投票データは既に "興味の弱い" 情報でしかなく削除しても実害少
-- ============================================================

-- 1. 既存の第4/第5希望データを削除
delete from theme_preferences where preference_rank in (4, 5);

-- 2. theme_preferences.preference_rank の CHECK 制約を 1..3 に更新
alter table theme_preferences
  drop constraint if exists theme_preferences_preference_rank_check;
alter table theme_preferences
  add constraint theme_preferences_preference_rank_check
  check (preference_rank between 1 and 3);

-- 3. theme_applications.preference_rank も同じく 1..3 に更新
-- (0069 で 1..5 として追加された)
alter table theme_applications
  drop constraint if exists theme_applications_preference_rank_check;
alter table theme_applications
  add constraint theme_applications_preference_rank_check
  check (preference_rank is null or preference_rank between 1 and 3);

-- 4. コメント更新
comment on table theme_preferences is
  '個人によるテーマ事前意識調査。第1〜第3希望を組織内テーマから登録する。';
