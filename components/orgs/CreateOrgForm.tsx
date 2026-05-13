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

export function CreateOrgForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
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
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: name.trim(), slug: finalSlug })
      .select()
      .single();
    if (orgErr || !org) {
      setErr(orgErr?.message ?? "作成に失敗しました");
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
