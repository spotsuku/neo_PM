-- ============================================================
-- 0023_demo_theme_humanrobot.sql
-- 見本テーマ「ヒューマンロボットカンパニー」を全組織に挿入する。
--   - code = 'HRC-001' で識別 (既に同 code がある組織はスキップ)
--   - posted_by はその組織の owner を埋める (居なければ null)
--   - status = active (公開中)
--   - 締切は実行日から60日後
--   - competition_enabled の状態に関わらず全組織へ入れる
--     (off の組織はテーマタブが非表示なだけで、後で on にすれば見える)
-- ============================================================

insert into themes (
  organization_id,
  posted_by,
  code,
  category,
  status,
  title,
  company_name,
  contact_name,
  background,
  who_target,
  pain,
  what_uniqueness,
  what_benefit,
  expected_outcome,
  internal_challenges,
  resource_other,
  post_action,
  implementation_level,
  criteria_region,
  criteria_means,
  criteria_youth,
  deadline,
  prize,
  thumbnail_url
)
select
  o.id,
  (
    select user_id from memberships
    where organization_id = o.id and role = 'owner'
    order by created_at asc
    limit 1
  ),
  'HRC-001',
  'new',
  'active',
  'ヒューマンロボットと拓く、福岡の高齢者ケア新体験',
  'ヒューマンロボットカンパニー',
  '高橋 直人',
  '福岡県では高齢化率が30%に近づき、介護スタッフ不足が深刻化しています。当社はパートナー型ロボット「Humo (ヒューモ)」を開発しており、現場での「人とロボットの自然な共生」を実証したいと考えています。',
  '地域の介護施設・高齢者デイサービス事業者、現場の介護スタッフ、そしてそこに通う70代以上の利用者',
  '介護現場の人手不足が常態化し、スタッフ1人あたりの担当人数が増加。利用者との会話やレクリエーションに割ける時間が減り、現場の疲弊と利用者満足度の低下が同時に進んでいる。',
  'パートナー型ロボット Humo は単なる介護補助ではなく、利用者の表情・声・生活リズムを学習して "話し相手になる" 設計。介護スタッフを置き換えるのではなく「現場で愛されるチームの一員」を目指している。',
  '介護スタッフは事務作業と会話補助から解放され、ケアの本質に集中。利用者は孤独感が軽減され、家族はオンラインで Humo 越しに様子を確認できる。',
  '福岡市内3つの介護施設での 8 週間のパイロット運用。Humo 導入前後でのスタッフ業務時間・利用者の会話量・家族満足度の変化を計測し、レポート + 動画ドキュメンタリーを作成する。',
  '当社の介護現場知見はまだ限定的。現場の細かなオペレーションや、高齢者一人ひとりの個別事情まで踏み込んだ設計には外部の目線が必要。',
  'Humo 実機 3 台の貸与、Humo 開発チームのメンタリング (週1)、施設マッチング支援、現場入りの旅費 (月2回まで実費精算)。',
  '採択チームには、上記リソースを提供して 8 週間のパイロットを伴走。期間終了後、成果次第で実証実験第2フェーズ (半年間) への移行と、PoC 報酬としての協賛契約を検討します。',
  'poc',
  true,
  true,
  true,
  (current_date + interval '60 days')::timestamptz,
  '実証実験 + PoC 報酬最大 80 万円',
  'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80'
from organizations o
where not exists (
  select 1 from themes t
  where t.organization_id = o.id and t.code = 'HRC-001'
);
