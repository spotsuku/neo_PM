/**
 * 初回オンボーディングツアーの全ステップ定義。
 * AI PM の主要機能をスポットライト型のツアーで一周する。
 * デスクトップ (左固定サイドバー) とモバイル (ハンバーガー + ドロワー) で
 * 画面構成が異なるため、ステップを出し分ける。
 */

export interface TutorialStep {
  emoji: string;
  title: string;
  body: string;
  /** スポットライトを当てる対象 (data-tour 属性値)。省略時は中央モーダル。 */
  target?: string;
  /** ツールチップを target のどちら側に配置するか。auto なら空きスペースに自動。 */
  placement?: "top" | "right" | "bottom" | "left" | "auto" | "center";
  /** このステップ表示時に、まず指定パスへ遷移してから spotlight する。
   *  例: ヘッダータブを実際に見せるため見本プロジェクトを開く。 */
  navigateTo?: string;
  /** モバイルのドロワー (ハンバーガーメニュー) を開く/閉じるよう指示する。
   *  ドロワー内の org-rail / project-pane を spotlight するために使う。 */
  mobileNav?: "open" | "closed";
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
  /** モバイル幅 (<md) かどうか。true ならモバイル専用ステップを返す。 */
  isMobile?: boolean;
}): TutorialStep[] {
  const demoHome =
    opts.orgSlug && opts.demoProjectId
      ? `/${opts.orgSlug}/projects/${opts.demoProjectId}/dashboard`
      : null;

  const welcome: TutorialStep = {
    emoji: "👋",
    title: "AI PM へようこそ",
    body:
      "AI PM は、誰もが プロジェクトマネージャー になるためのダッシュボードです。" +
      "実行計画 / WBS / 会議 / 収支 / AI 伴走 を、ひとつの場所でまとめて管理できます。" +
      "1 分で画面構成をツアーしましょう。",
    placement: "center",
  };

  const headerTabs: TutorialStep = {
    emoji: "🚀",
    title: "上のバー = 選択中プロジェクトのタブ",
    body:
      "プロジェクトを開くと、上のバーの左端に『今いるプロジェクト名』が表示され、" +
      "ダッシュ / 実行計画 / WBS / 会議 / 収支 / チーム管理 / 基金申請 / AI伴走 のタブが並びます" +
      (opts.isMobile ? "（横にスクロールできます）。" : "。") +
      "（例として見本『シニアタッチ』を開いて表示しています）",
    target: demoHome ? "header-tabs" : undefined,
    placement: demoHome ? "bottom" : "center",
    navigateTo: demoHome ?? undefined,
    // モバイルではヘッダーを見せる前にドロワーを閉じる
    mobileNav: opts.isMobile ? "closed" : undefined,
  };

  const publishFlow: TutorialStep = {
    emoji: "🌐",
    title: "プロジェクトの「公開」フロー",
    body:
      "新しく作ったプロジェクトは、最初はメンバーと管理者だけが見られる非公開です。" +
      "ダッシュの「🌐 ホームに公開申請」から内容を整えて申請すると、" +
      "管理者が項目ごとに審査し、承認されるとホームに公開されます。" +
      "（テーマ応募から生まれたプロジェクトは自動で公開されます）",
    placement: "center",
  };

  const closing: TutorialStep = {
    emoji: "🎯",
    title: "さあ、見本プロジェクトを開いてみよう",
    body: demoHome
      ? "見本プロジェクト『見本: シニアタッチ』をまずは覗いてみましょう。NEO.ai に「何から始めれば良い？」と聞くのがおすすめです。"
      : "新規プロジェクトの作成は管理者・テーマオーナーが行えます。「＋ 新規プロジェクト」から立ち上げましょう。",
    placement: "center",
    cta: demoHome
      ? { label: "🚀 見本: シニアタッチを開く", href: demoHome }
      : opts.orgSlug
        ? {
            label: "＋ 最初のプロジェクトを作成",
            href: `/${opts.orgSlug}/projects/new`,
          }
        : undefined,
  };

  // ── モバイル: ハンバーガー → ドロワーを開いて中身を spotlight ──
  if (opts.isMobile) {
    return [
      welcome,
      {
        emoji: "☰",
        title: "左上の ☰ メニュー",
        body:
          "スマホでは画面左上の ☰ をタップすると、メニュー（ドロワー）が開きます。" +
          "この中に組織の切替と、ホーム / 所属プロジェクトがまとまっています。",
        target: "mobile-nav",
        placement: "bottom",
      },
      {
        emoji: "🏢",
        title: "メニュー左の列 = 組織の切替",
        body:
          "ドロワー左端の縦の列に、あなたが所属する組織のアイコンが並びます。" +
          "タップするだけで、全ページがその組織に切替わります。",
        target: "org-rail",
        placement: "right",
        mobileNav: "open",
      },
      {
        emoji: "🧭",
        title: "メニュー右 = ホーム + 所属プロジェクト",
        body:
          "上に「🏠 ホーム」「🎯 テーマ応募」など組織メニュー、" +
          "下に「所属プロジェクト」の一覧。プロジェクト名をタップすると、" +
          "そのプロジェクトの内容が開きます。",
        target: "project-pane",
        placement: "right",
        mobileNav: "open",
      },
      headerTabs,
      publishFlow,
      {
        emoji: "✨",
        title: "右下の青いボタン = NEO.ai",
        body:
          "実行計画 / タスク / 会話履歴を読んだうえで「次の一手」を提案する AI 伴走者です。" +
          "提案カードは ✓ で承認すれば、各画面に自動反映されます。",
        target: "floating-ai",
        placement: "top",
      },
      closing,
    ];
  }

  // ── デスクトップ: 左固定サイドバー ──
  return [
    welcome,
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
    headerTabs,
    publishFlow,
    {
      emoji: "✨",
      title: "右下の青いボタン = NEO.ai",
      body:
        "実行計画 / タスク / 会話履歴を読んだうえで「次の一手」を提案する AI 伴走者です。" +
        "提案カードは ✓ で承認すれば、各画面に自動反映されます。",
      target: "floating-ai",
      placement: "right",
    },
    closing,
  ];
}
