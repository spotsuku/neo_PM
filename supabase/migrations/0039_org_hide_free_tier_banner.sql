-- ============================================================
-- NEO PM — 無料公開中バナーの組織別非表示フラグ
-- ============================================================
-- 「無料公開中です。有料化時は1ヶ月前告知」バナーを、
-- 組織単位で非表示にできるフラグを追加する。
-- 識別を組織名の文字列マッチに頼るのは脆いため、専用列で管理する。

alter table organizations
  add column if not exists hide_free_tier_banner boolean not null default false;

comment on column organizations.hide_free_tier_banner is
  '無料公開中バナーをこの組織で非表示にするか (組織設定でトグル)';

-- 既存の対象組織を一度だけバックフィル (以降は組織設定のトグルで制御)。
-- 空白の表記揺れを無視して比較する。
update organizations
set hide_free_tier_banner = true
where regexp_replace(name, '\s+', '', 'g') in (
  'NEO福岡事務局',
  'NEOACADEMIA第2期'
);
