"use client";

import React, {
  useState,
  useEffect,
  useCallback,
} from "react";

import { useAuth } from "@/context/AuthContext";

// IMPORTANT:
// StatusBadge uses a NAMED export.
import { StatusBadge } from "@/components/StatusBadge";

import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Clock,
  User,
  Package,
  Calendar,
  RotateCcw,
  Loader2,
  AlertOctagon,
  AlertCircle,
} from "lucide-react";

import { format } from "date-fns";

// ============================================================
// ALERT TYPE
// ============================================================
//
// This matches the actual response returned by:
// src/app/api/alerts/route.ts
//
// The API returns Loan fields:
//   item
//   borrower
//   issuedDate
//   dueDate
//   returnedDate
//   computedStatus
//   daysOverdue
//
// It does NOT return:
//   member
//   issuedAt
//   returnedAt
//   custodian1
//   custodian2
//   custodian3
// ============================================================

type Alert = {
  id: string;

  itemId: string;

  borrowerId: string;

  status: string;

  computedStatus: string;

  requestedDate: string;

  issuedDate: string | null;

  dueDate: string | null;

  returnedDate: string | null;

  createdAt: string;

  updatedAt: string;

  daysOverdue: number;

  item: {
    id: string;
    code: string;
    title: string;
    category: string;
    isArchived: boolean;
  };

  borrower: {
    id: string;
    name: string;
    email: string;
  };
};

// ============================================================
// ALERTS PAGE
// ============================================================

export default function AlertsPage() {
  const { user } = useAuth();
  const isDemo = !!user?.isDemo;

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [count, setCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] =
    useState<Record<string, boolean>>({});

  // ==========================================================
  // FETCH ALERTS
  // ==========================================================

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch alerts");
      }

      const data = await res.json();

      setAlerts(data.alerts || []);

      setCount(data.count || 0);

      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An error occurred while fetching alerts."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================================

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchAlerts]);

  // ==========================================================
  // GENERIC ACTION HANDLER
  // ==========================================================

  const handleAction = async (
    loanId: string,
    actionUrl: string,
    body?: Record<string, unknown>
  ) => {
    setActionLoading((prev) => ({
      ...prev,
      [loanId]: true,
    }));

    try {
      const res = await fetch(actionUrl, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        ...(body
          ? {
              body: JSON.stringify(body),
            }
          : {}),
      });

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({}));

        throw new Error(
          data.error || "Action failed"
        );
      }

      // Remove the alert from the current list.
      setAlerts((prev) =>
        prev.filter((alert) => alert.id !== loanId)
      );

      setCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      if (err instanceof Error) {
        window.alert(err.message);
      } else {
        window.alert("Action failed");
      }
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [loanId]: false,
      }));
    }
  };

  // ==========================================================
  // DISMISS ALERT
  // ==========================================================

  const handleDismiss = (loanId: string) => {
    if (
      window.confirm(
        "Are you sure you want to dismiss this alert?"
      )
    ) {
      handleAction(
        loanId,
        `/api/alerts/${loanId}/dismiss`
      );
    }
  };

  // ==========================================================
  // PROCESS RETURN
  // ==========================================================

  const handleProcessReturn = (loanId: string) => {
    if (
      window.confirm(
        "Process return for this item?"
      )
    ) {
      handleAction(
        loanId,
        `/api/loans/${loanId}/transition`,
        {
          action: "RETURN",
        }
      );
    }
  };

  // ==========================================================
  // MARK AS LOST
  // ==========================================================

  const handleMarkLost = (loanId: string) => {
    if (
      window.confirm(
        "Are you sure you want to mark this item as LOST? This action cannot be undone."
      )
    ) {
      handleAction(
        loanId,
        `/api/loans/${loanId}/transition`,
        {
          action: "MARK_LOST",
        }
      );
    }
  };

  // ==========================================================
  // USER ROLE
  // ==========================================================

  const isLibrarian =
    user?.role === "LIBRARIAN";

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        <div className="flex items-center space-x-3 mb-8">

          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />

          <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 shadow-sm h-64 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4" />

              <div className="h-4 bg-gray-200 rounded w-1/2" />

              <div className="space-y-2 pt-4">

                <div className="h-4 bg-gray-200 rounded" />

                <div className="h-4 bg-gray-200 rounded" />

              </div>
            </div>
          ))}

        </div>

      </div>
    );
  }

  // ==========================================================
  // MAIN PAGE
  // ==========================================================

  return (
    <div className="max-w-6xl mx-auto p-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between mb-8">

        <div className="flex items-center space-x-3">

          <AlertTriangle className="w-8 h-8 text-red-600" />

          <h1 className="text-3xl font-bold text-gray-900">
            Overdue Loan Alerts
          </h1>

        </div>

        <div className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-medium flex items-center space-x-2 border border-red-200">

          <span>Total Alerts</span>

          <span className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
            {count}
          </span>

        </div>

      </div>

      {isDemo && (
        <div className="mb-6 p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {isLibrarian
            ? "Demo librarian mode: you can view alerts, but member names are hidden and dismiss/mark-lost actions are disabled."
            : "Demo member mode: view only."}
        </div>
      )}

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-3">

          <AlertOctagon className="w-5 h-5 flex-shrink-0" />

          <p>{error}</p>

        </div>
      )}

      {/* ======================================================
          NO ALERTS
      ====================================================== */}

      {alerts.length === 0 ? (

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center space-y-4">

          <div className="bg-green-100 p-4 rounded-full">

            <CheckCircle2 className="w-12 h-12 text-green-600" />

          </div>

          <h2 className="text-2xl font-semibold text-gray-900">
            No overdue loans!
          </h2>

          <p className="text-gray-500 max-w-md">
            All items are on time. You are fully
            caught up with the active loans.
          </p>

        </div>

      ) : (

        /* ====================================================
           ALERT CARDS
        ==================================================== */

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {alerts.map((alert) => {

            const isLoading =
              actionLoading[alert.id] === true;

            return (
              <div
                key={alert.id}
                className="bg-white border-l-4 border-l-red-500 border-y border-r border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >

                {/* ==================================================
                    CARD CONTENT
                ================================================== */}

                <div className="p-5 flex-grow">

                  {/* ----------------------------------------------
                      ITEM HEADER
                  ---------------------------------------------- */}

                  <div className="flex justify-between items-start mb-4">

                    <div className="space-y-1">

                      <div className="flex items-center space-x-2">

                        <Package className="w-4 h-4 text-gray-400" />

                        <span className="text-xs font-mono text-gray-500">
                          {alert.item.code}
                        </span>

                      </div>

                      <h3
                        className="text-lg font-bold text-gray-900 line-clamp-2"
                        title={alert.item.title}
                      >
                        {alert.item.title}
                      </h3>

                    </div>

                    <StatusBadge
                      status={alert.computedStatus}
                    />

                  </div>

                  {/* ----------------------------------------------
                      ALERT INFORMATION
                  ---------------------------------------------- */}

                  <div className="space-y-3 mb-5">

                    {/* Days overdue */}

                    <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center space-x-2 border border-red-100">

                      <Clock className="w-5 h-5 flex-shrink-0 text-red-500" />

                      <span className="font-semibold text-sm">

                        {alert.daysOverdue}{" "}

                        {alert.daysOverdue === 1
                          ? "day"
                          : "days"}{" "}

                        overdue

                      </span>

                    </div>

                    {/* Borrower */}

                    <div className="flex flex-col space-y-2 text-sm text-gray-600">

                      <div className="flex items-center space-x-2">

                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />

                        <span
                          className={`font-medium text-gray-900 ${isDemo ? "demo-blur" : ""}`}
                          title={isDemo ? "Hidden for the demo librarian account" : undefined}
                        >
                          {alert.borrower.name}
                        </span>

                        <span
                          className={`text-xs text-gray-400 truncate ${isDemo ? "demo-blur" : ""}`}
                          title={isDemo ? "Hidden for the demo librarian account" : undefined}
                        >
                          ({alert.borrower.email})
                        </span>

                      </div>

                      {/* Due Date */}

                      <div className="flex justify-between items-center bg-gray-50 p-2 rounded">

                        <div className="flex items-center space-x-2">

                          <Calendar className="w-4 h-4 text-gray-400" />

                          <span>Due:</span>

                        </div>

                        <span className="font-medium text-red-600">

                          {alert.dueDate
                            ? format(
                                new Date(alert.dueDate),
                                "MMM d, yyyy"
                              )
                            : "N/A"}

                        </span>

                      </div>

                      {/* Issued Date */}

                      <div className="flex justify-between items-center px-2">

                        <span className="text-xs text-gray-500">
                          Issued:
                        </span>

                        <span className="text-xs text-gray-700">

                          {alert.issuedDate
                            ? format(
                                new Date(alert.issuedDate),
                                "MMM d, yyyy"
                              )
                            : "N/A"}

                        </span>

                      </div>

                      {/* Category */}

                      <div className="flex justify-between items-center px-2">

                        <span className="text-xs text-gray-500">
                          Category:
                        </span>

                        <span className="text-xs text-gray-700">
                          {alert.item.category}
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* ==================================================
                    LIBRARIAN ACTIONS
                ================================================== */}

                {isLibrarian && !isDemo && (
                  <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-wrap gap-2 justify-end rounded-b-lg">

                    {/* Dismiss */}

                    <button
                      type="button"
                      onClick={() =>
                        handleDismiss(alert.id)
                      }
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center transition-colors"
                      title="Dismiss Alert"
                    >

                      <BellOff className="w-3 h-3 mr-1" />

                      Dismiss

                    </button>

                    {/* Mark Lost */}

                    <button
                      type="button"
                      onClick={() =>
                        handleMarkLost(alert.id)
                      }
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 flex items-center transition-colors"
                      title="Mark as Lost"
                    >

                      <AlertOctagon className="w-3 h-3 mr-1" />

                      Lost

                    </button>

                    {/* Return */}

                    <button
                      type="button"
                      onClick={() =>
                        handleProcessReturn(alert.id)
                      }
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center transition-colors shadow-sm"
                      title="Process Return"
                    >

                      {isLoading ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3 mr-1" />
                      )}

                      Return

                    </button>

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}