import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./lp.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI PM | AIと共に、誰もがプロジェクトマネージャーに。",
  description:
    "計画書・WBS・議事録・会議・収支管理・AIコーチ MyCOO を1つに統合したプロジェクト OS。ベータ期間中につき主要機能を無料で提供中。",
  openGraph: {
    title: "AI PM | AIと共に、誰もがプロジェクトマネージャーに。",
    description:
      "計画から振り返り、AIコーチまで。プロジェクト推進に必要な情報がワークスペース1つで完結。ベータ期間中は主要機能を無料で提供中。",
    type: "website",
  },
};

export default function LpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`ai-pm-lp ${inter.variable}`}>{children}</div>;
}
