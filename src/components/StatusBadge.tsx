import React from "react";
import { DisplayStatus } from "@/types";
import { Clock, CheckCircle2, AlertTriangle, AlertOctagon, Send, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: DisplayStatus | string;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium gap-1",
    md: "px-2.5 py-1 text-xs font-semibold gap-1.5",
    lg: "px-3 py-1.5 text-sm font-semibold gap-2",
  }[size];

  switch (status) {
    case "REQUESTED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${sizeClasses}`}
        >
          <Send className="w-3.5 h-3.5 text-amber-500" />
          Requested
        </span>
      );
    case "ISSUED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses}`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Issued (On Time)
        </span>
      );
    case "OVERDUE":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${sizeClasses} animate-pulse`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          Overdue
        </span>
      );
    case "RETURNED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Returned
        </span>
      );
    case "LOST":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses}`}
        >
          <AlertOctagon className="w-3.5 h-3.5 text-slate-500" />
          Lost
        </span>
      );
    case "DECLINED":
      return (
        <span
          className={`inline-flex items-center rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${sizeClasses}`}
        >
          <XCircle className="w-3.5 h-3.5 text-purple-500" />
          Declined
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-gray-100 text-gray-700 border border-gray-200 ${sizeClasses}`}
        >
          {status}
        </span>
      );
  }
};
