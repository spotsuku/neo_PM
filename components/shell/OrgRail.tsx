"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  ORG_ICON_FALLBACK_BG,
  orgIconImgStyle,
} from "@/lib/orgIconStyle";
import { AppLogo } from "@/components/ui/AppLogo";

interface Org {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  icon_url?: string | null;
  icon_zoom?: number | null;
  icon_offset_x?: number | null;
  icon_offset_y?: number | null;
  role: "owner" | "admin" | "member" | "theme_owner";
}

interface Props {
  activeSlug: string;
  orgs: Org[];
  /** 現在ユーザの表示名 / メールイニシャル */
  userInitial: string;
  /** 管理者 (view-as 切替メニュー用) */
  isAdmin: boolean;
}

/** Slack の workspace rail を踏襲した、左端の縦組織スイッチャー。
 *  - 各組織 = アバター。クリックで /<slug> へ遷移
 *  - 一番下: ＋ 新規組織
 *  - その下: 👤 ユーザーメニュー (マイページ / 設定 / view-as / ログアウト)
 */
export function OrgRail({ activeSlug, orgs, userInitial, isAdmin }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number }>({
    left: 76,
    bottom: 20,
  });
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!menuOpen) return;
    const rect = userBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({
        left: rect.right + 8,
        bottom: window.innerHeight - rect.bottom,
      });
    }
  }, [menuOpen]);
  const supabase = createClient();
  const active = orgs.find((o) => o.slug === activeSlug);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login?logout=1");
    router.refresh();
  };

  const setViewAs = async (view: "member" | "theme_owner") => {
    await fetch("/api/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view }),
    });
    setMenuOpen(false);
    router.refresh();
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-[68px] flex-col items-center gap-1.5 py-3 border-r border-line-soft"
      style={{ background: "linear-gradient(180deg, #0f172a 0%, #0c1326 100%)" }}
      aria-label="組織サイドバー"
      data-tour="org-rail"
    >
      {/* App logo */}
      <button
        type="button"
        onClick={() => router.push(`/${activeSlug}`)}
        className="grid h-10 w-10 place-items-center rounded-xl bg-white overflow-hidden mb-1"
        aria-label="AI PM ホーム"
        title="AI PM"
      >
        <AppLogo className="w-full h-full" />
      </button>
      <div className="h-px w-8 bg-white/10 mb-1" aria-hidden />

      {/* Org list */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-2 px-2 pt-1">
        {orgs.map((o) => {
          const isActive = o.slug === activeSlug;
          const avatar = o.emoji?.trim() || o.name[0] || "?";
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => router.push(`/${o.slug}`)}
              className="relative group w-full grid place-items-center py-0.5"
              title={`${o.name}  ·  /${o.slug}\n権限: ${o.role}`}
              aria-label={o.name}
            >
              {/* active 左バー */}
              <span
                className="absolute left-[-8px] top-1 bottom-1 w-[3px] rounded-r-full bg-white transition-transform"
                style={{
                  transform: isActive ? "scaleY(1)" : "scaleY(0)",
                }}
                aria-hidden
              />
              <span
                className={
                  "relative inline-grid place-items-center w-11 h-11 rounded-2xl text-white font-bold text-[15px] overflow-hidden transition " +
                  (isActive
                    ? "shadow-[0_0_0_2px_var(--c-accent),0_8px_24px_-8px_rgba(124,164,255,.6)]"
                    : "opacity-80 hover:opacity-100 hover:rounded-xl")
                }
                style={o.icon_url ? undefined : ORG_ICON_FALLBACK_BG}
              >
                {o.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.icon_url}
                    alt=""
                    style={orgIconImgStyle({
                      iconUrl: o.icon_url,
                      zoom: o.icon_zoom,
                      offsetX: o.icon_offset_x,
                      offsetY: o.icon_offset_y,
                    })}
                  />
                ) : (
                  avatar
                )}
              </span>
              {/* tooltip (hover) */}
              <span
                className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-50 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl"
                aria-hidden
              >
                {o.name}
              </span>
            </button>
          );
        })}

        {/* + 新規組織 */}
        <button
          type="button"
          onClick={() => router.push("/orgs/new")}
          className="group relative grid place-items-center w-11 h-11 rounded-2xl border border-dashed border-white/30 text-white/70 hover:bg-white/10 hover:text-white transition mt-1"
          title="新しい組織を作成"
          aria-label="新しい組織を作成"
        >
          <span className="text-lg">＋</span>
          <span className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-50 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
            新しい組織
          </span>
        </button>
      </div>

      {/* User menu (bottom) */}
      <div className="relative w-full grid place-items-center pt-1.5 border-t border-white/10">
        <button
          ref={userBtnRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="grid place-items-center w-11 h-11 rounded-full text-white font-bold text-[14px] hover:bg-white/10 transition"
          style={{
            background:
              "linear-gradient(135deg, #f59e0b, #ea580c)",
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="アカウントメニュー"
        >
          {userInitial}
        </button>

        {menuOpen && mounted && createPortal(
          <>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-[100] cursor-default"
              aria-hidden
            />
            <div
              role="menu"
              style={{ left: anchor.left, bottom: anchor.bottom }}
              className="fixed z-[110] w-72 rounded-xl border border-line bg-white p-2 shadow-[0_20px_60px_-20px_rgba(20,30,80,.35)]"
            >
              <div className="t-label px-2 pt-1 pb-2">
                {active?.name ?? "メニュー"}
              </div>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setViewAs("member")}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                  >
                    👀 メンバー視点でプレビュー
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewAs("theme_owner")}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                  >
                    📣 テーマオーナー視点でプレビュー
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/${activeSlug}/admin`);
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                  >
                    🛠 管理者ダッシュボード
                  </button>
                  <div className="my-1 h-px bg-line" />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  router.push("/me");
                  setMenuOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
              >
                👤 マイページ
              </button>
              {(active?.role === "owner" || active?.role === "admin") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/${activeSlug}/settings`);
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                  >
                    ⚙️ 組織情報を編集
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/${activeSlug}/settings/members`);
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] hover:bg-mute/5"
                  >
                    👥 メンバーを招待 / 管理
                  </button>
                </>
              )}
              <div className="my-1 h-px bg-line" />
              <button
                type="button"
                onClick={signOut}
                className="w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] text-error hover:bg-red-50"
              >
                ログアウト
              </button>
            </div>
          </>,
          document.body,
        )}
      </div>
    </aside>
  );
}
