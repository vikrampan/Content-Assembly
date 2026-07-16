"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { BoardColumn } from "@/lib/pipeline";
import { STATUS_LABELS } from "@/lib/pipeline";
import type { AccountType, ContentItem, ContentStatus } from "@/lib/types";
import { clientReview, moveStage } from "@/app/dashboard/actions";

const FORMAT_ICON: Record<string, string> = {
  post: "▢",
  carousel: "▧",
  reel: "▷",
};

/**
 * Interactive Kanban.
 *
 *  • team / admin — drag a card between columns to move it through the pipeline
 *    (each column is a single status, so the drop target is unambiguous).
 *  • client — Approve / Request changes controls on items awaiting review; the
 *    mutation goes through the column-restricted `client_review_content` RPC.
 *
 * RLS + the RPC are the real security boundary; this component is UX only.
 */
export function KanbanBoard({
  columns,
  items: initialItems,
  role,
}: {
  columns: BoardColumn[];
  items: ContentItem[];
  role: AccountType;
}) {
  const isTeam = role === "admin" || role === "team_incharge";

  // Local mirror of server state so drops feel instant. Re-syncs whenever the
  // server sends fresh props (i.e. after revalidatePath completes).
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function move(item: ContentItem, toStatus: ContentStatus) {
    if (item.status === toStatus) return;
    setError(null);
    const prev = items;
    // Optimistic.
    setItems((cur) =>
      cur.map((c) => (c.id === item.id ? { ...c, status: toStatus } : c)),
    );
    startTransition(async () => {
      const res = await moveStage(item.id, toStatus);
      if ("error" in res) {
        setItems(prev); // revert
        setError(res.error);
      }
    });
  }

  function review(
    item: ContentItem,
    decision: "approve" | "request_changes",
    comment?: string,
  ) {
    setError(null);
    const prev = items;
    const optimisticStatus: ContentStatus =
      decision === "approve" ? "approved" : "changes_requested";
    setItems((cur) =>
      cur.map((c) =>
        c.id === item.id ? { ...c, status: optimisticStatus } : c,
      ),
    );
    startTransition(async () => {
      const res = await clientReview(item.id, decision, comment);
      if ("error" in res) {
        setItems(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : null}

      <div className="lane-scroll overflow-x-auto pb-4">
        <div className="flex min-w-max gap-4">
          {columns.map((col) => {
            const cards = items.filter((i) => col.statuses.includes(i.status));
            const isDropTarget = isTeam && col.statuses.length === 1;
            const active = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={
                  isDropTarget
                    ? (e) => {
                        e.preventDefault();
                        setDragOver(col.key);
                      }
                    : undefined
                }
                onDragLeave={
                  isDropTarget ? () => setDragOver((k) => (k === col.key ? null : k)) : undefined
                }
                onDrop={
                  isDropTarget
                    ? (e) => {
                        e.preventDefault();
                        setDragOver(null);
                        const id = e.dataTransfer.getData("text/plain");
                        const item = items.find((i) => i.id === id);
                        if (item) move(item, col.statuses[0]);
                      }
                    : undefined
                }
                className={`flex w-72 shrink-0 flex-col rounded-2xl p-3 transition ${
                  active
                    ? "bg-amber-500/10 outline outline-2 outline-amber-400/60"
                    : "bg-black/[0.03] dark:bg-white/[0.03]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/10">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-black/10 px-3 py-6 text-center text-xs opacity-40 dark:border-white/10">
                      {active ? "Drop to move here" : "Nothing here yet"}
                    </div>
                  ) : (
                    cards.map((item) => (
                      <Card
                        key={item.id}
                        item={item}
                        draggable={isTeam}
                        role={role}
                        onReview={review}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Card({
  item,
  draggable,
  role,
  onReview,
}: {
  item: ContentItem;
  draggable: boolean;
  role: AccountType;
  onReview: (
    item: ContentItem,
    decision: "approve" | "request_changes",
    comment?: string,
  ) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");

  const canReview =
    role === "client" && item.status === "ready_for_client_review";

  return (
    <div
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => e.dataTransfer.setData("text/plain", item.id)
          : undefined
      }
      className={`rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/5 ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs opacity-50">
        <span aria-hidden>{FORMAT_ICON[item.format] ?? "▢"}</span>
        <span className="uppercase tracking-wide">{item.format}</span>
        {item.shared_with_client ? (
          <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            shared
          </span>
        ) : null}
      </div>
      {role === "client" ? (
        <div className="text-sm font-medium leading-snug">{item.title}</div>
      ) : (
        <Link
          href={`/dashboard/content/${item.id}`}
          className="text-sm font-medium leading-snug hover:underline"
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        >
          {item.title}
        </Link>
      )}
      <div className="mt-2 text-[11px] opacity-45">
        {STATUS_LABELS[item.status]}
      </div>

      {canReview ? (
        rejecting ? (
          <div className="mt-3 space-y-2">
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What should change? (e.g. make the Golden Harvest color pop on slide 2)"
              className="w-full resize-y rounded-lg border border-black/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-amber-500 dark:border-white/15 dark:bg-white/5"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!comment.trim()}
                onClick={() => {
                  onReview(item, "request_changes", comment);
                  setRejecting(false);
                  setComment("");
                }}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
              >
                Send request
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejecting(false);
                  setComment("");
                }}
                className="rounded-lg border border-black/15 px-2.5 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onReview(item, "approve")}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-black/15 px-2.5 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Request changes
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
