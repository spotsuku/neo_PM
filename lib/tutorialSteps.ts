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
        "実行計画 / WBS / 会議 / 収支 / AI 伴走 を、ひとつの場所でまとめて管理できます。" +
        "1 分で新しくなった画面構成をツアーしましょう。",
      placement: "center",
    },
    {
      emoji: "🏢",
      title: "左端 = 組織の切替",
      body:
        "一番左の縦の列には、あなたが所属する組織のアイコンが並びます。" +
        "複数の組織に所属していれば、ここをクリックするだけで全ページがその組織に切替わります。",
      target: "org-rail",
      placement: "right",
    },
    {
      emoji: "🧭",
      title: "その隣 = 組織ナビ + 所属プロジェクト",
      body:
        "上部に「🏠 ホーム」「🎯 テーマ応募」など組織レベルのメニュー、" +
        "その下に「所属プロジェクト」の一覧が並びます。" +
        "プロジェクト名をクリックすると、右側がそのプロジェクトの内容に切替わります。",
      target: "project-pane",
      placement: "right",
    },
    {
      emoji: "🚀",
      title: "上のバー = 選択中プロジェクトのタブ",
      body:
        "プロジェクトを開くと、上のバーの左端に『今いるプロジェクト名』が表示され、" +
        "ダッシュ / 実行計画 / WBS / 会議 / 収支 / チーム管理 / 基金申請 / AI伴走 のタブが並びます。" +
        "ホームなどの組織ページでは、このタブは表示されません。",
      target: "header-tabs",
      placement: "bottom",
    },
    {
      emoji: "🌐",
      title: "プロジェクトの「公開」フロー",
      body:
        "新しく作ったプロジェクトは、最初はメンバーと管理者だけが見られる非公開です。" +
        "ダッシュの「🌐 ホームに公開申請」から内容を整えて申請すると、" +
        "管理者が項目ごとに審査し、承認されるとホームに公開されます。" +
        "（テーマ応募から生まれたプロジェクトは自動で公開されます）",
      placement: "center",
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
        : "新規プロジェクトの作成は管理者・テーマオーナーが行えます。左の「＋ 新規プロジェクト」から立ち上げましょう。",
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
