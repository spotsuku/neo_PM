"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

type Mode = "pm" | "competition";

export function CreateOrgForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [mode, setMode] = useState<Mode>("pm");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) {
      setErr("組織名を入力してください");
      return;
    }
    setLoading(true);
    const finalSlug = slug.trim() || slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("ログインが必要です");
      setLoading(false);
      return;
    }

    // 同名重複ガード: 既に同じ名前の組織に所属している場合は新規作成を拒否
    const trimmedName = name.trim();
    const { data: existingDup } = await supabase
      .from("memberships")
      .select(
        "id, organizations:organization_id(id, name, slug)",
      )
      .eq("user_id", user.id);
    type Row = {
      organizations:
        | { id: string; name: string; slug: string }
        | { id: string; name: string; slug: string }[]
        | null;
    };
    const dup = ((existingDup ?? []) as unknown as Row[]).some((m) => {
      const o = Array.isArray(m.organizations)
        ? m.organizations[0]
        : m.organizations;
      return o && o.name === trimmedName;
    });
    if (dup) {
      setErr(
        `「${trimmedName}」という名前の組織にあなたは既に所属しています。混乱を避けるため別の名前を選んでください。`,
      );
      setLoading(false);
      return;
    }

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: trimmedName,
        slug: finalSlug,
        competition_enabled: mode === "competition",
      })
      .select()
      .single();
    if (orgErr || !org) {
      // RLS ポリシー違反は分かりにくいので翻訳
      if (
        orgErr?.message.includes("row-level security") ||
        orgErr?.message.includes("violates row-level security")
      ) {
        setErr(
          "組織作成の権限がありません。DB の RLS ポリシーが正しく適用されていない可能性があります。" +
            "管理者に「Supabase で migration 0033_org_insert_policy_repair.sql を実行」と伝えてください。",
        );
      } else if (orgErr?.message.includes("duplicate key")) {
        setErr(
          `スラッグ「${finalSlug}」は既に使われています。別のスラッグを指定してください。`,
        );
      } else {
        setErr(orgErr?.message ?? "作成に失敗しました");
      }
      setLoading(false);
      return;
    }
    const { error: memErr } = await supabase.from("memberships").insert({
      user_id: user.id,
      organization_id: org.id,
      role: "owner",
    });
    if (memErr) {
      setErr(memErr.message);
      setLoading(false);
      return;
    }
    router.push(`/${org.slug}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="t-label block mb-1">組織名</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="例: NEO 福岡 / ○○大学プロジェクト推進室"
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
        />
      </label>
      <label className="block">
        <span className="t-label block mb-1">スラッグ（URL用、英数字）</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="neo-fukuoka"
          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[--c-accent]"
        />
      </label>
      <fieldset className="block">
        <legend className="t-label mb-2">使い方</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModeRadio
            value="pm"
            current={mode}
            onSelect={setMode}
            emo="🚀"
            title="プロジェクト管理だけ"
            desc="PM SaaS としてプロジェクトの実行計画・WBS・収支などを管理する。"
          />
          <ModeRadio
            value="competition"
            current={mode}
            onSelect={setMode}
            emo="📣"
            title="+ コンペ運営"
            desc="企業がテーマを出題し、若者チームが応募する仕組みも使う。"
          />
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "作成中..." : "組織を作成"}
      </button>
      {err && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}
    </form>
  );
}

function ModeRadio({
  value,
  current,
  onSelect,
  emo,
  title,
  desc,
}: {
  value: Mode;
  current: Mode;
  onSelect: (v: Mode) => void;
  emo: string;
  title: string;
  desc: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={
        "text-left rounded-xl border p-3 transition " +
        (selected
          ? "border-[--c-accent] bg-accent-soft/40 ring-2 ring-[--c-accent]"
          : "border-line bg-white hover:border-[--c-accent]/50")
      }
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg" aria-hidden>
          {emo}
        </span>
        <span className="text-[13px] font-bold">{title}</span>
      </div>
      <p className="t-cap leading-relaxed">{desc}</p>
    </button>
  );
}
