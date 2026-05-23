"use client";

import { useState } from "react";

import { BudgetBoard } from "@/components/budget/BudgetBoard";
import {
  BreakevenModel,
  type BreakevenData,
} from "@/components/budget/BreakevenModel";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Item = Database["public"]["Tables"]["budget_items"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialItems: Item[];
  projectId: string;
  initialBreakeven: BreakevenData;
}

export function BudgetTabs({
  orgSlug,
  projects,
  current,
  initialItems,
  projectId,
  initialBreakeven,
}: Props) {
  const [tab, setTab] = useState<"grid" | "breakeven">("grid");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-full bg-white p-1 shadow-[0_1px_0_var(--line-soft)] text-[12px] font-semibold">
          {(
            [
              ["grid", "📊 収支グリッド"],
              ["breakeven", "📈 黒字化モデル"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={
                "px-3 py-1.5 rounded-full transition " +
                (tab === k ? "bg-ink text-white" : "text-mute hover:text-ink")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "grid" ? (
        <BudgetBoard
          orgSlug={orgSlug}
          projects={projects}
          current={current}
          initialItems={initialItems}
        />
      ) : (
        <BreakevenModel
          projectId={projectId}
          projectName={current.name}
          initialData={initialBreakeven}
        />
      )}
    </div>
  );
}
