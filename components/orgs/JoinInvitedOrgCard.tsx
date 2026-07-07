"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
  iconUrl?: string | null;
}

/**
 * community_dashboard で認証済みのユーザに /orgs で表示する
 * 「この組織に参加できます」カード。
 * クリックで POST /api/orgs/[slug]/join を叩き、成功したらその組織へ遷移。
 */
export function JoinInvitedOrgCard({
  slug,
  name,
  description,
  emoji,
  iconUrl,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${slug}/join`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `参加に失敗しました (${res.status})`);
        setBusy(false);
        return;
      }
      router.push(`/${slug}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信に失敗しました");
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border-2 border-[--c-accent]/40 bg-[--c-accent]/5 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          🎓
        </span>
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[--c-accent-deep]">
          参加できる組織
        </h2>
        <span className="t-cap ml-auto">community_dashboard で認証済み</span>
      </div>
      <div className="flex items-start gap-3">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={iconUrl}
            alt=""
            className="h-12 w-12 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <span
            className="grid h-12 w-12 place-items-center rounded-xl text-white text-xl flex-shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
            aria-hidden
          >
            {emoji?.trim() || name[0]}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold truncate">{name}</div>
          <div className="t-cap t-mono opacity-70 truncate">/{slug}</div>
          {description && (
            <p className="t-cap mt-1 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="w-full rounded-lg bg-ink px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50 transition"
      >
        {busy ? "参加中..." : `🚀 ${name} に参加する`}
      </button>
    </div>
  );
}
