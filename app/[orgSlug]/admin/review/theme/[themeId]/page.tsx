import { redirect } from "next/navigation";

// 単独のテーマ審査画面は廃止。プレビュー横の審査 (テーマ出題 ?t=) に一本化したため、
// 旧リンク/ブックマークはインライン審査へリダイレクトする。
export default async function ThemeReviewRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; themeId: string }>;
}) {
  const { orgSlug, themeId } = await params;
  redirect(`/${orgSlug}/theme?t=${themeId}`);
}
