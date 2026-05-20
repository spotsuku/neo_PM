"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Invitation = Database["public"]["Tables"]["invitations"]["Row"];

interface ParsedRow {
  name: string;
  affiliation: string;
  title: string;
  email: string;
  error?: string;
}

interface Props {
  orgId: string;
  orgName: string;
  origin: string;
  initialBulk: Invitation[];
}

const ROLE_OPTIONS: { value: "member" | "admin" | "theme_owner"; label: string }[] = [
  { value: "member", label: "メンバー" },
  { value: "admin", label: "管理者" },
  { value: "theme_owner", label: "テーマオーナー" },
];

const SAMPLE = `三木 智弘, NEO福岡事務局, 代表, miki@example.com
山田 花子, ○○大学, 学生, hana@example.com
鈴木 一郎, △△会社, 部長, ichiro@example.com`;

function parseCsv(input: string): ParsedRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return lines.map((line) => {
    const cols = line.split(/[,\t]/).map((c) => c.trim());
    const [name = "", affiliation = "", title = "", email = ""] = cols;
    const row: ParsedRow = { name, affiliation, title, email };
    if (!email) row.error = "メールアドレス必須";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      row.error = "メールアドレスの形式が不正";
    else if (!name) row.error = "氏名必須";
    return row;
  });
}

export function BulkInviteBoard({
  orgId,
  orgName,
  origin,
  initialBulk,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"member" | "admin" | "theme_owner">("member");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Invitation[]>(initialBulk);
  useEffect(() => {
    setExisting(initialBulk);
  }, [initialBulk]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const preview = () => {
    setError(null);
    const parsed = parseCsv(input);
    if (parsed.length === 0) {
      setError("1行以上入力してください");
      return;
    }
    setRows(parsed);
    setPreviewed(true);
  };

  const validRows = rows.filter((r) => !r.error);
  const errRows = rows.filter((r) => r.error);

  const send = async () => {
    setSending(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      setError("ログインが必要です");
      return;
    }
    const payload = validRows.map((r) => ({
      organization_id: orgId,
      created_by: user.id,
      role,
      intended_email: r.email,
      intended_name: r.name || null,
      intended_affiliation: r.affiliation || null,
      intended_title: r.title || null,
      note: r.name ? `${r.name} (${r.affiliation || "-"})` : null,
    }));
    const { data, error: err } = await supabase
      .from("invitations")
      .insert(payload)
      .select();
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setExisting((prev) => [...((data as Invitation[]) ?? []), ...prev]);
    setRows([]);
    setInput("");
    setPreviewed(false);
  };

  const invitationUrl = (token: string) => `${origin}/join/${token}`;

  const copyAll = async () => {
    const header = "氏名\tメール\t招待リンク\n";
    const text =
      header +
      existing
        .filter((i) => i.intended_email)
        .map(
          (i) =>
            `${i.intended_name ?? ""}\t${i.intended_email ?? ""}\t${invitationUrl(i.token)}`,
        )
        .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId("ALL");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const copyOne = async (inv: Invitation) => {
    const url = invitationUrl(inv.token);
    const name = (inv.intended_name ?? "").trim();
    // 名前 (任意) + URL を貼り付けやすい 2 行形式に
    const text = name
      ? `${name} さん\nAI PM 参加リンク: ${url}`
      : url;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  /** 案内メール用のフルテンプレートをコピー */
  const copyMessage = async (inv: Invitation) => {
    const url = invitationUrl(inv.token);
    const name = (inv.intended_name ?? "").trim();
    const orgName = inv.intended_affiliation ?? "";
    const greet = name ? `${name} さん` : "ご担当者さま";
    const text =
      `${greet}\n\n` +
      `AI PM へのご招待をお送りします${orgName ? ` (${orgName} 様)` : ""}。\n` +
      `下記リンクから 14 日以内にログイン → 参加してください。\n\n` +
      `▼ 招待リンク (1 回限り有効)\n${url}\n\n` +
      `※ メールアドレスは ${inv.intended_email ?? "—"} 宛です。`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("コピーに失敗しました");
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("この招待リンクを取り消しますか？")) return;
    setExisting((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("invitations").delete().eq("id", id);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <GlassCard className="p-5">
        <h3 className="t-h3 mb-2">
          <span aria-hidden className="mr-2">
            📨
          </span>
          一括登録 + 招待リンク発行
        </h3>
        <p className="t-cap mb-3 leading-relaxed">
          各行に「<strong>氏名, 所属, 肩書き, メールアドレス</strong>」をカンマ
          またはタブ区切りで入力してください。エクセル / Google スプレッドシート
          からそのままコピペできます。
        </p>

        <div className="grid grid-cols-[1fr_180px] gap-2 items-start mb-3">
          <textarea
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={SAMPLE}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-[--c-accent] resize-y t-mono"
          />
          <div className="flex flex-col gap-2">
            <label className="block">
              <span className="t-label block mb-1">役割</span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(
                    e.target.value as "member" | "admin" | "theme_owner",
                  )
                }
                className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={preview}
              disabled={!input.trim()}
              className="rounded-md bg-white border border-line px-3 py-1.5 text-[12px] font-medium text-mute hover:bg-mute/5 disabled:opacity-50"
            >
              プレビュー
            </button>
            <button
              type="button"
              onClick={() => setInput(SAMPLE)}
              className="t-cap text-left underline opacity-70 hover:opacity-100"
            >
              サンプルを挿入
            </button>
          </div>
        </div>

        {previewed && (
          <div className="rounded-lg border border-line-soft bg-canvas-2 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="t-label">
                プレビュー: {validRows.length} 件OK
                {errRows.length > 0 && (
                  <span className="text-error ml-2">
                    / {errRows.length} 件エラー
                  </span>
                )}
              </span>
            </div>
            <div className="max-h-[260px] overflow-y-auto rounded-md bg-white border border-line-soft">
              <table className="w-full text-[12px]">
                <thead className="bg-canvas-2 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 t-label">氏名</th>
                    <th className="text-left px-2 py-1.5 t-label">所属</th>
                    <th className="text-left px-2 py-1.5 t-label">肩書き</th>
                    <th className="text-left px-2 py-1.5 t-label">メール</th>
                    <th className="text-left px-2 py-1.5 t-label">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={r.error ? "bg-red-50" : ""}
                    >
                      <td className="px-2 py-1.5">{r.name || "—"}</td>
                      <td className="px-2 py-1.5">{r.affiliation || "—"}</td>
                      <td className="px-2 py-1.5">{r.title || "—"}</td>
                      <td className="px-2 py-1.5 t-mono text-[11.5px]">
                        {r.email || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.error ? (
                          <span className="text-error">{r.error}</span>
                        ) : (
                          <span className="text-[--c-accent-deep]">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="t-cap">
                {validRows.length} 件を <strong>{ROLE_OPTIONS.find((o) => o.value === role)?.label}</strong> として招待します。エラー行はスキップされます。
              </p>
              <button
                type="button"
                onClick={send}
                disabled={sending || validRows.length === 0}
                className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {sending
                  ? "..."
                  : `✦ ${validRows.length} 件の招待を発行`}
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              🔗
            </span>
            未使用の招待リンク ({existing.length})
          </h3>
          {existing.length > 0 && (
            <button
              type="button"
              onClick={copyAll}
              className="rounded-md bg-white border border-line px-3 py-1.5 text-[11.5px] font-medium text-mute hover:bg-mute/5"
            >
              {copiedId === "ALL"
                ? "✓ コピー済"
                : "📋 CSV (氏名/メール/リンク) を全行コピー"}
            </button>
          )}
        </div>

        {existing.length === 0 ? (
          <p className="t-cap text-center py-4">
            まだ未使用の招待はありません。
          </p>
        ) : (
          <div className="rounded-md border border-line-soft bg-white max-h-[420px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-canvas-2 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 t-label">氏名</th>
                  <th className="text-left px-2 py-1.5 t-label">所属</th>
                  <th className="text-left px-2 py-1.5 t-label">肩書き</th>
                  <th className="text-left px-2 py-1.5 t-label">メール</th>
                  <th className="text-left px-2 py-1.5 t-label">招待リンク</th>
                  <th className="text-left px-2 py-1.5 t-label w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {existing.map((i) => {
                  const url = invitationUrl(i.token);
                  return (
                    <tr key={i.id} className="border-t border-line-soft">
                      <td className="px-2 py-1.5">
                        {i.intended_name || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {i.intended_affiliation || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {i.intended_title || "—"}
                      </td>
                      <td className="px-2 py-1.5 t-mono text-[11px]">
                        {i.intended_email || "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => copyOne(i)}
                            className="rounded-md bg-accent-soft text-[--c-accent-deep] px-2 py-0.5 text-[10.5px] font-semibold"
                            title="氏名 + リンクをコピー"
                          >
                            {copiedId === i.id ? "✓ コピー済" : "🔗 名前+リンク"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyMessage(i)}
                            className="rounded-md bg-white border border-line px-2 py-0.5 text-[10.5px] font-semibold text-mute hover:text-ink"
                            title="案内文 (氏名 + 挨拶 + リンク) をコピー"
                          >
                            ✉️ 案内文
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => revoke(i.id)}
                          className="rounded-md px-1.5 py-1 text-mute hover:bg-red-50 hover:text-error"
                          aria-label="取り消し"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="t-cap mt-3 leading-relaxed">
          発行されたリンクは <strong>14 日間有効</strong>。Gmail などのメール
          差し込み (mail merge) や Slack DM で各受取人に送ってください。
          受取人は <code>/join/{`{token}`}</code> を開く → 自分のメール
          アドレスでサインアップ (パスワードを自分で設定) →{" "}
          <strong>{orgName}</strong> に自動参加します。
        </p>
      </GlassCard>
    </div>
  );
}
