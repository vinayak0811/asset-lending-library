"use client";

import React, { useState } from "react";
import { LoanEventDTO } from "@/types";
import {
  Clock,
  Send,
  CheckCircle2,
  AlertOctagon,
  BellOff,
  FileText,
  User,
  Plus,
  Lock,
} from "lucide-react";
import { format } from "date-fns";

interface LoanTimelineProps {
  events: LoanEventDTO[];
  loanId: string;
  isLibrarian?: boolean;
  isDemo?: boolean;
  onNoteAdded?: () => void;
}

export const LoanTimeline: React.FC<LoanTimelineProps> = ({
  events,
  loanId,
  isLibrarian,
  isDemo,
  onNoteAdded,
}) => {
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/loans/${loanId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_NOTE",
          notes: noteText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to append note to timeline.");
      }

      setNoteText("");
      if (onNoteAdded) {
        onNoteAdded();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventIcon = (action: string) => {
    switch (action) {
      case "REQUESTED":
        return <Send className="w-4 h-4 text-amber-600" />;
      case "ISSUED":
        return <Clock className="w-4 h-4 text-blue-600" />;
      case "RETURNED":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "LOST":
        return <AlertOctagon className="w-4 h-4 text-rose-600" />;
      case "ALERT_DISMISSED":
        return <BellOff className="w-4 h-4 text-purple-600" />;
      case "NOTE_ADDED":
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  const getEventBadgeColor = (action: string) => {
    switch (action) {
      case "REQUESTED":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "ISSUED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "RETURNED":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "LOST":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "ALERT_DISMISSED":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "NOTE_ADDED":
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-slate-400" />
          Immutable Audit Timeline
        </h4>
        <span className="text-xs text-slate-500 font-normal">
          {events.length} recorded {events.length === 1 ? "event" : "events"}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-slate-500 italic py-4 text-center">
          No timeline events recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {events.map((evt, idx) => (
            <div key={evt.id || idx} className="relative group">
              {/* Node dot */}
              <div className="absolute -left-[29px] top-1 w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center shadow-sm group-hover:border-blue-500 transition">
                {getEventIcon(evt.action)}
              </div>

              {/* Event Content */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${getEventBadgeColor(
                        evt.action
                      )}`}
                    >
                      {evt.action.replace("_", " ")}
                    </span>
                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span
                        className={isDemo && evt.actor?.role === "MEMBER" ? "demo-blur" : ""}
                        title={isDemo && evt.actor?.role === "MEMBER" ? "Hidden for the demo librarian account" : undefined}
                      >
                        {evt.actor?.name || "System"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({evt.actor?.role || "SYSTEM"})
                      </span>
                    </span>
                  </div>
                  <time className="text-[11px] text-slate-500">
                    {format(new Date(evt.timestamp), "MMM d, yyyy · h:mm a")}
                  </time>
                </div>

                {evt.notes && (
                  <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap bg-white p-2 rounded border border-slate-100 font-mono text-[11px]">
                    {evt.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Append Librarian Note Form */}
      {isLibrarian && !isDemo && (
        <form
          onSubmit={handleAddNote}
          className="pt-3 border-t border-slate-200 mt-4"
        >
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Append Permanent Librarian Note
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add observation, condition check, or borrower contact note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !noteText.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 disabled:opacity-50 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Note
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
        </form>
      )}
    </div>
  );
};
