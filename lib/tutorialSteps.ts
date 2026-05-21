/**
 * 初回オンボーディングツアーの全ステップ定義。
 * AI PM の主要機能を 7 ステップで一周する。
 */

export interface TutorialStep {
  emoji: string;
  title: string;
  body: string;
  /** 推奨アクション (任意)。クリックで指定 path に遷移してツアー終了。 */
  cta?: {
    label: string;
    /** 動的に組織やプロジェクト ID が必要な場合は <orgSlug> <projectId> プレースホルダを使う */
    href: string;
  };
}

export function buildTutorialSteps(opts: {
  orgSlug: string | null;
  firstProjectId: string | null;
}): TutorialStep[] {
  const projectHome =
    opts.orgSlug && opts.firstProjectId
      ? `/${opts.orgSlug}/projects/${opts.firstProjectId}/dashboard`
      : null;

  return [
    {
      emoji: "👋",
      title: "AI PM へようこそ",
      body:
        "AI PM は応援資本主義のための プロジェクトマネジメント ダッシュボードです。" +
        "テーマを出題する人 (企業・行政) と挑戦する若者チームが、ひとつの場所で共創します。" +
        "まずは画面の基本パーツを 1 分でツアーしましょう。",
    },
    {
      emoji: "🏢",
      title: "左端のサイドバー = 組織の切替",
      body:
        "左端の縦サイドバーには、あなたが所属する組織のアイコンが並びます。" +
        "別組織にも参加していれば、ここで切替えるだけで全ページが切替わります。" +
        "下にある「＋」で新しい組織を作成、一番下の「👤 アバター」からマイページや管理者画面へ。",
    },
    {
      emoji: "📋",
      title: "プロジェクトの切替",
      body:
        "サイドバー右隣のリストは、その組織内のプロジェクト。" +
        "クリックでプロジェクトを切替えます。URL に projectId が乗るので、ブックマークも共有 URL も安全です。",
    },
    {
      emoji: "🚀",
      title: "9 つのタブで進捗を管理",
      body:
        "上部のタブで主要機能を行き来します。\n" +
        "・🏠 ホーム ・🚀 ダッシュ (全体像) ・🎯 実行計画 (Why/Who/What/How)\n" +
        "・📋 WBS (タスク) ・📅 会議 ・💴 収支\n" +
        "・🏢 チーム管理 ・📨 基金申請 ・✨ AI伴走",
    },
    {
      emoji: "🎯",
      title: "テーマ応募 / 出題 (コンペ機能)",
      body:
        "右端の「テーマ応募」「テーマ出題」は、コンペ機能を ON にしている組織で表示されます。" +
        "出題者が課題を構造化 → 若者チームが応募 → 採択でプロジェクトが自動生成。",
    },
    {
      emoji: "✨",
      title: "NEO.ai (右下の浮遊ボタン)",
      body:
        "画面右下に常駐する青いボタンが NEO.ai。" +
        "実行計画 / タスク / 会話履歴を読んだ上で「次の一手」を相談できます。" +
        "提案カードは ✓ で承認すれば各画面に反映されます。",
    },
    {
      emoji: "✨",
      title: "さあ最初のプロジェクトへ",
      body: projectHome
        ? "見本プロジェクト『見本: シニアタッチ』が用意されています。" +
          "まずはダッシュを開いて全体像を眺め、💡 NEO.ai に「何から始めれば良い？」と聞いてみましょう。"
        : "まずは右上の「＋ 新規プロジェクト」から最初のチャレンジを立ち上げましょう。" +
          "見本プロジェクト『見本: シニアタッチ』も自動で用意されています。",
      cta: projectHome
        ? { label: "🚀 見本プロジェクトを開く", href: projectHome }
        : opts.orgSlug
          ? {
              label: "＋ 最初のプロジェクトを作成",
              href: `/${opts.orgSlug}/projects/new`,
            }
          : undefined,
    },
  ];
}
