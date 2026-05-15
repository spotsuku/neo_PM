"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface Org {
  id: string;
  name: string;
  slug: string;
  emoji?: string | null;
  role: "owner" | "admin" | "member" | "theme_owner";
  created_at?: string;
}

export function OrgSwitcher({
  activeSlug,
  orgs,
}: {
  activeSlug: string;
  orgs: Org[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const active = orgs.find((o) => o.slug === activeSlug) ?? orgs[0];
  const avatarChar = active?.emoji?.trim() || active?.name?.[0] || "?";

  const switchOrg = (slug: string) => {
    router.push(`/${slug}`);
    setOpen(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login?logout=1");
    router.refresh();
  };

  const createNewOrg = () => {
    router.push("/orgs/new");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_0_var(--line-soft)] hover:bg-mute/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-white font-semibold"
          style={{
            background:
              "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
        >
          {avatarChar}
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate">
          {active?.name ?? "組織"}
        </span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-[0_18px_60px_-20px_rgba(20,30,80,.25)]"
          >
            <div className="t-label px-2 pt-1 pb-2">組織を切り替え</div>
            <div className="flex flex-col gap-0.5">
              {orgs.map((o) => {
                // 同名組織を区別するため slug を併記。同名が複数あるときだけ作成日も表示。
                const sameName = orgs.filter((x) => x.name === o.name).length > 1;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => switchOrg(o.slug)}
                    className={
                      "flex items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-accent-soft " +
                      (o.slug === activeSlug
                        ? "bg-accent-soft text-[--c-accent-deep] font-semibold"
                        : "text-ink-2")
                    }
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-white text-[11px] font-semibold flex-shrink-0 mt-[1px]"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                      }}
                    >
                      {o.emoji?.trim() || o.name[0]}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.name}</span>
                      <span className="block t-cap t-mono opacity-70 truncate">
                        /{o.slug}
                        {sameName && o.created_at && (
                          <span className="ml-1.5 opacity-80">
                            ・{new Date(o.created_at).toLocaleDateString("ja-JP")}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="t-cap whitespace-nowrap mt-[2px]">
                      {o.role}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="my-2 h-px bg-line" />
            {(active?.role === "owner" || active?.role === "admin") && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/view-as", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ view: "member" }),
                    });
                    setOpen(false);
                    router.refresh();
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                >
                  👀 メンバー視点でプレビュー
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/view-as", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ view: "theme_owner" }),
                    });
                    setOpen(false);
                    router.refresh();
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                >
                  📣 テーマオーナー視点でプレビュー
                </button>
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/${activeSlug}/admin`);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                >
                  🛠 管理者ダッシュボード
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                router.push(`/${activeSlug}/settings`);
                setOpen(false);
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
            >
              ⚙️ 組織情報を編集
            </button>
            <button
              type="button"
              onClick={() => {
                router.push(`/${activeSlug}/settings/members`);
                setOpen(false);
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
            >
              👥 メンバーを招待 / 管理
            </button>
            <button
              type="button"
              onClick={createNewOrg}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
            >
              ＋ 新しい組織を作成
            </button>
            <button
              type="button"
              onClick={signOut}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] text-error hover:bg-red-50"
            >
              ログアウト
            </button>
          </div>
        </>
      )}
    </div>
  );
}
