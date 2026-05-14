"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  TimelineFeed,
  type PostAuthor,
  type TimelinePost,
} from "@/components/timeline/TimelineFeed";

interface Props {
  orgSlug: string;
  currentUserId: string | null;
  posts: TimelinePost[];
  authorsTuples: [string, PostAuthor][];
  project: { id: string; name: string; team_name: string | null };
}

export function DashboardTimeline({
  orgSlug,
  currentUserId,
  posts,
  authorsTuples,
  project,
}: Props) {
  const router = useRouter();
  const authorsById = useMemo(
    () => new Map(authorsTuples),
    [authorsTuples],
  );
  return (
    <TimelineFeed
      orgSlug={orgSlug}
      currentUserId={currentUserId}
      posts={posts}
      authorsById={authorsById}
      composeProjects={[project]}
      crossProject={false}
      onChanged={() => router.refresh()}
    />
  );
}
