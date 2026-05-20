"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

interface MembershipRow {
  id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: "owner" | "admin" | "member" | "theme_owner";
  affiliation: string | null;
  title: string | null;
}

interface Props {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  memberships: MembershipRow[];
}

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  theme_owner: "テーマオーナー",
  member: "メンバー",
};

export function MeForm({
  email: initialEmail,
  displayName,
  avatarUrl,
  memberships: initialMemberships,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // プロフィール
  const [name, setName] = useState(displayName ?? "");
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // メアド
  const [email, setEmail] = useState(initialEmail);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // パスワード
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // 所属一覧
  const [memberships, setMemberships] =
    useState<MembershipRow[]>(initialMemberships);
  const [membershipSaving, setMembershipSaving] = useState<string | null>(null);
  const [membershipMsg, setMembershipMsg] = useState<string | null>(null);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setProfileMsg("❌ 画像ファイルを選んでください");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setProfileMsg("❌ 3MB 以下の画像を選んでください");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfileMsg("❌ ログイン状態を確認できませんでした");
      return;
    }
    setUploadingAvatar(true);
    setProfileMsg(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `user-avatars/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("project-posts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingAvatar(false);
      setProfileMsg(`❌ アップロード失敗: ${upErr.message}`);
      return;
    }
    const { data: pub } = supabase.storage
      .from("project-posts")
      .getPublicUrl(path);
    const newUrl = pub.publicUrl;
    setAvatar(newUrl);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("id", user.id);
    setUploadingAvatar(false);
    if (updErr) {
      setProfileMsg(`❌ ${updErr.message}`);
    } else {
      setProfileMsg("✓ アイコン画像を更新しました");
      router.refresh();
    }
  };

  const clearAvatar = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setAvatar("");
    const { error: err } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (err) setProfileMsg(`❌ ${err.message}`);
    else {
      setProfileMsg("✓ アイコン画像を外しました");
      router.refresh();
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || null,
        avatar_url: avatar.trim() || null,
      })
      .eq("id", (await supabase.auth.getUser()).data.user!.id);
    setProfileSaving(false);
    if (error) {
      setProfileMsg(`❌ ${error.message}`);
    } else {
      setProfileMsg("✓ プロフィールを更新しました");
      router.refresh();
    }
  };

  const changeEmail = async () => {
    if (!email.trim() || email === initialEmail) {
      setEmailMsg(
        initialEmail
          ? "メールアドレスを変更後の値に書き換えてください"
          : "メールアドレスを入力してください",
      );
      return;
    }
    setEmailSaving(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setEmailSaving(false);
    if (error) {
      setEmailMsg(`❌ ${error.message}`);
    } else {
      setEmailMsg(
        `✓ 確認メールを ${email} に送信しました。受信箱のリンクをクリックで完了します。`,
      );
    }
  };

  const changePassword = async () => {
    if (password.length < 8) {
      setPasswordMsg("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordMsg("確認用パスワードが一致しません");
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordSaving(false);
    if (error) {
      setPasswordMsg(`❌ ${error.message}`);
    } else {
      setPassword("");
      setPasswordConfirm("");
      setPasswordMsg("✓ パスワードを変更しました");
    }
  };

  const updateMembership = async (
    id: string,
    patch: { affiliation?: string | null; title?: string | null },
  ) => {
    setMembershipSaving(id);
    setMembershipMsg(null);
    const { error } = await supabase
      .from("memberships")
      .update(patch)
      .eq("id", id);
    setMembershipSaving(null);
    if (error) {
      setMembershipMsg(`❌ ${error.message}`);
      return;
    }
    setMemberships((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    setMembershipMsg("✓ 保存しました");
  };

  const initial =
    (name.trim() || initialEmail.split("@")[0])[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* プロフィール */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            👤
          </span>
          プロフィール
        </h3>
        <div className="grid grid-cols-[96px_1fr] gap-4 items-start">
          <div>
            <span className="t-label block mb-1">アイコン</span>
            <div
              className="grid h-20 w-20 place-items-center rounded-full text-white text-3xl overflow-hidden ring-2 ring-white shadow-sm"
              style={{
                background: avatar
                  ? `url(${avatar}) center / cover`
                  : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
              }}
            >
              {!avatar && initial}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="t-label block mb-1">氏名 *</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 三木 智弘"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent]"
              />
            </label>
            <div>
              <span className="t-label block mb-1">
                📷 アイコン画像をアップロード
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingAvatar}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                    e.target.value = "";
                  }}
                  className="text-[11.5px] file:mr-2 file:rounded-md file:border-0 file:bg-ink file:text-white file:px-3 file:py-1.5 file:cursor-pointer file:text-[11.5px] file:font-semibold disabled:opacity-50"
                />
                {uploadingAvatar && (
                  <span className="t-cap">アップロード中…</span>
                )}
                {avatar && !uploadingAvatar && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="t-cap underline text-mute hover:text-error"
                  >
                    画像を外す
                  </button>
                )}
              </div>
              <p className="t-cap mt-1 opacity-70 leading-relaxed">
                3MB 以下 / JPG / PNG / WebP。丸型に切り抜いて表示されます。
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="t-cap">{profileMsg}</div>
          <button
            type="button"
            onClick={saveProfile}
            disabled={profileSaving}
            className="rounded-lg bg-ink px-5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {profileSaving ? "..." : "変更を保存"}
          </button>
        </div>
      </GlassCard>

      {/* メアド & パスワード */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            🔐
          </span>
          アカウント
        </h3>

        {/* メアド */}
        <div className="border-b border-line-soft pb-4 mb-4">
          <label className="block mb-2">
            <span className="t-label block mb-1">
              メールアドレス
              {!initialEmail && (
                <span className="ml-2 rounded-full bg-warn/15 text-warn px-2 py-0.5 text-[10px] font-semibold">
                  未設定
                </span>
              )}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={!initialEmail ? "例: you@example.com" : undefined}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm t-mono outline-none focus:border-[--c-accent]"
            />
          </label>
          <p className="t-cap mb-2 leading-relaxed">
            {initialEmail
              ? "変更後のアドレスに確認メールが届きます。リンクをクリックして完了。"
              : "メールアドレスを登録するとログイン手段として使えます。確認メールが届くのでリンクを開いて完了。"}
          </p>
          <div className="flex items-center justify-between">
            <div className="t-cap">{emailMsg}</div>
            <button
              type="button"
              onClick={changeEmail}
              disabled={emailSaving || email === initialEmail || !email.trim()}
              className="rounded-lg bg-ink px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {emailSaving
                ? "..."
                : initialEmail
                  ? "メアドを変更"
                  : "メアドを登録"}
            </button>
          </div>
        </div>

        {/* パスワード */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="t-label block mb-1">新しいパスワード</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent]"
              />
            </label>
            <label className="block">
              <span className="t-label block mb-1">確認</span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="同じパスワード"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent]"
              />
            </label>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="t-cap">{passwordMsg}</div>
            <button
              type="button"
              onClick={changePassword}
              disabled={passwordSaving || !password || !passwordConfirm}
              className="rounded-lg bg-ink px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {passwordSaving ? "..." : "パスワードを変更"}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* 所属 */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            🏢
          </span>
          組織ごとの所属・肩書き
        </h3>
        {memberships.length === 0 ? (
          <p className="t-cap text-center py-6">
            まだどの組織にも参加していません。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {memberships.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-line-soft bg-white p-3"
              >
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">
                      {m.org_name}
                    </div>
                    <div className="t-cap t-mono opacity-70">/{m.org_slug}</div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: "var(--c-accent)" }}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="t-label block mb-1">所属</span>
                    <input
                      type="text"
                      defaultValue={m.affiliation ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        const prev = m.affiliation ?? "";
                        if (next !== prev) {
                          updateMembership(m.id, {
                            affiliation: next || null,
                          });
                        }
                      }}
                      placeholder="例: ○○大学 / △△会社"
                      className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                    />
                  </label>
                  <label className="block">
                    <span className="t-label block mb-1">肩書き</span>
                    <input
                      type="text"
                      defaultValue={m.title ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        const prev = m.title ?? "";
                        if (next !== prev) {
                          updateMembership(m.id, { title: next || null });
                        }
                      }}
                      placeholder="例: 代表 / 学生 / エンジニア"
                      className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                    />
                  </label>
                </div>
                {membershipSaving === m.id && (
                  <p className="t-cap mt-1">保存中…</p>
                )}
              </div>
            ))}
          </div>
        )}
        {membershipMsg && (
          <div className="t-cap text-right mt-2">{membershipMsg}</div>
        )}
        <p className="t-cap mt-3 leading-relaxed">
          所属・肩書きは組織ごとに別々の値を設定できます (フォーカス外しで自動保存)。
        </p>
      </GlassCard>
    </div>
  );
}
