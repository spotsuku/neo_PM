"use client";

import { useState } from "react";

import {
  ProjectMembersPanel,
  type ProjMember,
} from "@/components/projects/ProjectMembersPanel";
import {
  LaunchReadinessCard,
  type ServerSnapshot,
} from "@/components/projects/LaunchReadinessCard";

interface OrgMember {
  user_id: string;
  org_role: "owner" | "admin" | "member" | "theme_owner";
  display_name: string | null;
}

interface Props {
  orgSlug: string;
  projectId: string;
  projectName: string;
  startedAt: string | null;
  badges: string[];
  canManage: boolean;
  orgMembers: OrgMember[];
  initialMembers: ProjMember[];
  snapshot: ServerSnapshot;
}

/** /<orgSlug>/projects/<id>/members の本文。
 *  メンバー state を持ち、Launch カードとパネルで共有する。 */
export function MembersPageBody({
  orgSlug,
  projectId,
  projectName,
  startedAt,
  badges,
  canManage,
  orgMembers,
  initialMembers,
  snapshot,
}: Props) {
  const [members, setMembers] = useState<ProjMember[]>(initialMembers);

  return (
    <>
      <LaunchReadinessCard
        orgSlug={orgSlug}
        projectId={projectId}
        projectName={projectName}
        startedAt={startedAt}
        badges={badges}
        members={members}
        canManage={canManage}
        snapshot={snapshot}
      />
      <ProjectMembersPanel
        projectId={projectId}
        canManage={canManage}
        orgMembers={orgMembers}
        initialMembers={initialMembers}
        onMembersChange={setMembers}
      />
    </>
  );
}
