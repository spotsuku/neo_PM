/** project_memberships に migration 0025 (responsibility / work_description)
 *  が未適用の本番 DB を検出した時に表示する案内バナー。 */
export function LegacySchemaBanner() {
  return (
    <div
      className="rounded-xl p-3 text-[12.5px] leading-relaxed"
      style={{
        background: "rgba(255,176,32,.12)",
        borderLeft: "4px solid var(--warn)",
      }}
    >
      ⚠️ <strong>DB マイグレーション未適用</strong>:{" "}
      <code className="t-mono opacity-80">
        project_memberships.responsibility
      </code>{" "}
      列が DB にありません。役職 / 責任 / 業務内容 の編集は無効化されています。
      <br />
      Supabase の SQL Editor で
      <code className="t-mono mx-1 px-1 rounded bg-white border border-line">
        supabase/migrations/0025_member_responsibility_fields.sql
      </code>{" "}
      (および後続の 0026〜0033) を順番に実行してください。
    </div>
  );
}
