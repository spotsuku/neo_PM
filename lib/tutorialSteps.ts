/**
 * 初回オンボーディングツアーの全ステップ定義。
 * AI PM の主要機能をスポットライト型のツアーで一周する。
 */

export interface TutorialStep {
  emoji: string;
  title: string;
  body: string;
  /** スポットライトを当てる対象 (data-tour 属性値)。省略時は中央モーダル。 */
  target?: string;
  /** ツールチップを target のどちら側に配置するか。auto なら空きスペースに自動。 */
  placement?: "top" | "right" | "bottom" | "left" | "auto" | "center";
  /** 推奨アクション (任意)。クリックで指定 path に遷移してツアー終了。 */
  cta?: {
    label: string;
    href: string;
  };
}

export function buildTutorialSteps(opts: {
  orgSlug: string | null;
  /** 見本 (is_demo) プロジェクトの ID。最終ステップの CTA で必ずここを開く。 */
  demoProjectId: string | null;
}): TutorialStep[] {
  const demoHome =
    opts.orgSlug && opts.demoProjectId
      ? `/${opts.orgSlug}/projects/${opts.demoProjectId}/dashboard`
      : null;

  return [
    {
      emoji: "👋",
      title: "AI PM へようこそ",
      body:
        "AI PM は、誰もが プロジェクトマネージャー になるためのダッシュボードです。" +
        "実行計画 / WBS / 会議 / 収支 / AI 伴走を、ひとつの場所でまとめて管理できます。" +
        "1 分で主要パーツをツアーしましょう。",
      placement: "center",
    },
    {
      emoji: "🏢",
      title: "左端 = 組織サイドバー",
      body:
        "左端の縦サイドバーにはあなたが所属する組織のアイコンが並びます。" +
        "別組織にも所属していれば、ここで切替えるだけで全ページが切替わります。",
      target: "org-rail",
      placement: "right",
    },
    {
      emoji: "📋",
      title: "次の列 = プロジェクト一覧",
      body:
        "組織内のプロジェクトはこのリストから切替えます。" +
        "クリックするだけで、ダッシュ / 会議 / WBS 等すべてが選んだプロジェクトの内容に切替わります。",
      target: "project-pane",
      placement: "right",
    },
    {
      emoji: "🚀",
      title: "上のタブ = プロジェクトの主要機能",
      body:
        "ホーム / ダッシュ / 実行計画 / WBS / 会議 / 収支 / チーム管理 / 基金申請 / AI伴走 がタブで並んでいます。右端には テーマ応募 / テーマ出題 (コンペ機能)。",
      target: "header-tabs",
      placement: "bottom",
    },
    {
      emoji: "✨",
      title: "右下の青いボタン = NEO.ai",
      body:
        "実行計画 / タスク / 会話履歴を読んだうえで「次の一手」を提案する AI 伴走者です。" +
        "提案カードは ✓ で承認すれば、各画面に自動反映されます。",
      target: "floating-ai",
      placement: "right",
    },
    {
      emoji: "🎯",
      title: "さあ、見本プロジェクトを開いてみよう",
      body: demoHome
        ? "見本プロジェクト『見本: シニアタッチ』をまずは覗いてみましょう。NEO.ai に「何から始めれば良い？」と聞くのがおすすめです。"
        : "右上の「＋ 新規プロジェクト」から、最初のチャレンジを立ち上げましょう。",
      placement: "center",
      cta: demoHome
        ? { label: "🚀 見本: シニアタッチを開く", href: demoHome }
        : opts.orgSlug
          ? {
              label: "＋ 最初のプロジェクトを作成",
              href: `/${opts.orgSlug}/projects/new`,
            }
          : undefined,
    },
  ];
}
