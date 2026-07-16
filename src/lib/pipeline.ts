import type { ContentStatus } from "@/lib/types";

/**
 * Single source of truth for the pipeline stages and how each role's board
 * groups them into columns.
 */

export const STATUS_LABELS: Record<ContentStatus, string> = {
  ideation: "Ideation",
  research: "Research (L1)",
  copywriting: "Copywriting (L2)",
  visuals: "Visuals (L3)",
  assembly: "Assembly / QA (L4)",
  admin_review: "Admin Review",
  ready_for_client_review: "Pending Approval",
  changes_requested: "Changes Requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

export interface BoardColumn {
  key: string;
  title: string;
  statuses: ContentStatus[];
}

/**
 * The CLIENT board — deliberately collapsed to the three stages the spec calls
 * for. WIP stages (research/copywriting/visuals/assembly/admin_review) never
 * appear here, and RLS guarantees those rows are never even sent to a client.
 */
export const CLIENT_COLUMNS: BoardColumn[] = [
  { key: "ideation", title: "Ideation", statuses: ["ideation"] },
  {
    key: "pending",
    title: "Pending Approval",
    statuses: ["ready_for_client_review", "changes_requested"],
  },
  {
    key: "approved",
    title: "Approved / Scheduled",
    statuses: ["approved", "scheduled", "published"],
  },
];

/**
 * The TEAM INCHARGE board — the full 4-Layer SOP as a working pipeline.
 *
 * One column per status so drag-and-drop has an unambiguous target stage
 * (the interactive board moves a card to `column.statuses[0]` on drop).
 */
export const TEAM_COLUMNS: BoardColumn[] = [
  { key: "ideation", title: "Ideation", statuses: ["ideation"] },
  { key: "research", title: "Research · L1", statuses: ["research"] },
  { key: "copywriting", title: "Copy · L2", statuses: ["copywriting"] },
  { key: "visuals", title: "Visuals · L3", statuses: ["visuals"] },
  { key: "assembly", title: "Assembly · L4", statuses: ["assembly"] },
  { key: "admin_review", title: "Admin Review", statuses: ["admin_review"] },
  {
    key: "ready_for_client_review",
    title: "Pending Approval",
    statuses: ["ready_for_client_review"],
  },
  {
    key: "changes_requested",
    title: "Changes Requested",
    statuses: ["changes_requested"],
  },
  { key: "approved", title: "Approved", statuses: ["approved"] },
  { key: "scheduled", title: "Scheduled", statuses: ["scheduled"] },
  { key: "published", title: "Published", statuses: ["published"] },
];

export function columnsForRole(
  role: "admin" | "team_incharge" | "client",
): BoardColumn[] {
  return role === "client" ? CLIENT_COLUMNS : TEAM_COLUMNS;
}
