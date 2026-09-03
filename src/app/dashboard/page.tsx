"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DashboardMetrics } from "@/types";
import { useAuth } from "@/context/AuthContext";

import {
  Package,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Users,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ============================================================
// COLORS
// ============================================================

const COLORS = {
  REQUESTED: "#f59e0b",
  ISSUED: "#3b82f6",
  OVERDUE: "#f43f5e",
  RETURNED: "#10b981",
  LOST: "#64748b",
  DECLINED: "#a855f7",
};

// ============================================================
// DASHBOARD PAGE
// ============================================================

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useAuth must come from AuthContext.
  // Do NOT import useAuth from "@/lib/auth" because lib/auth.ts
  // uses next/headers and is server-only.
  const { user } = useAuth();

  // ==========================================================
  // FETCH DASHBOARD DATA
  // ==========================================================

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/dashboard", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard metrics");
        }

        const metrics: DashboardMetrics = await response.json();

        setData(metrics);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An error occurred while loading the dashboard.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  // ==========================================================
  // LOADING STATE
  // ==========================================================

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />

          <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
        </div>

        <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // ==========================================================
  // ERROR STATE
  // ==========================================================

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-rose-500 bg-rose-50 rounded-lg border border-rose-200 p-6">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />

          <p className="font-medium">
            Error loading dashboard
          </p>

          <p className="text-sm mt-1">
            {error}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // NO DATA STATE
  // ==========================================================

  if (!data) {
    return (
      <div className="p-6 text-center text-slate-500">
        No dashboard data available.
      </div>
    );
  }

  // ==========================================================
  // MAIN DASHBOARD
  // ==========================================================

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Dashboard
        </h1>

        {user && (
          <p className="text-sm text-slate-500 mt-1">
            Welcome, {user.name}
          </p>
        )}
      </div>

      {/* ======================================================
          METRIC CARDS
      ====================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Items Currently Out */}

        <MetricCard
          title="Items Currently Out"
          value={data.itemsCurrentlyOut}
          icon={
            <Package className="w-6 h-6 text-blue-500" />
          }
          bgColor="bg-blue-50"
          borderColor="border-blue-100"
        />

        {/* Items Overdue */}

        <MetricCard
          title="Items Overdue"
          value={data.itemsOverdue}
          icon={
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          }
          bgColor="bg-rose-50"
          borderColor="border-rose-100"
        />

        {/* Returned This Week */}

        <MetricCard
          title="Returned This Week"
          value={data.loansReturnedThisWeek}
          icon={
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          }
          bgColor="bg-emerald-50"
          borderColor="border-emerald-100"
        />

        {/* Total Catalogue Items */}

        <MetricCard
          title="Total Catalogue Items"
          value={data.totalCatalogueItems}
          icon={
            <BookOpen className="w-6 h-6 text-slate-500" />
          }
          bgColor="bg-slate-50"
          borderColor="border-slate-200"
        />

      </div>

      {/* ======================================================
          CHARTS + CUSTODIANS
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ====================================================
            LOAN STATUS BREAKDOWN
        ==================================================== */}

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">

          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Loan Status Breakdown
          </h2>

          <div className="h-64">

            {data.loansByStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                No loan data available.
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>

                  <Pie
                    data={data.loansByStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >

                    {data.loansByStatus.map(
                      (entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            COLORS[
                              entry.status as keyof typeof COLORS
                            ] || "#94a3b8"
                          }
                        />
                      )
                    )}

                  </Pie>

                  <RechartsTooltip />

                  <Legend />

                </PieChart>
              </ResponsiveContainer>
            )}

          </div>
        </div>

        {/* ====================================================
            CUSTODIAN BREAKDOWN
        ==================================================== */}

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">

          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">

            <Users className="w-5 h-5 text-slate-500" />

            Custodian Breakdown

          </h2>

          <div className="flex-1 overflow-auto">

            <table className="w-full text-left border-collapse">

              <thead>

                <tr className="border-b border-slate-200 text-sm font-medium text-slate-500">

                  <th className="pb-3 pr-4">
                    Custodian
                  </th>

                  <th className="pb-3 px-4 text-right">
                    Items Owned
                  </th>

                  <th className="pb-3 pl-4 text-right">
                    Active Loans
                  </th>

                </tr>

              </thead>

              <tbody>

                {data.loansByCustodian.map(
                  (custodian, index) => (
                    <tr
                      key={`${custodian.custodianEmail}-${index}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                    >

                      <td className="py-3 pr-4">

                        <div className="text-slate-700 font-medium">
                          {custodian.custodianName}
                        </div>

                        <div className="text-xs text-slate-400">
                          {custodian.custodianEmail}
                        </div>

                      </td>

                      <td className="py-3 px-4 text-right text-slate-600">
                        {custodian.itemCount}
                      </td>

                      <td className="py-3 pl-4 text-right text-slate-600">
                        {custodian.activeLoanCount}
                      </td>

                    </tr>
                  )
                )}

                {data.loansByCustodian.length === 0 && (
                  <tr>

                    <td
                      colSpan={3}
                      className="py-8 text-center text-slate-400"
                    >
                      No custodians found.
                    </td>

                  </tr>
                )}

              </tbody>

            </table>

          </div>
        </div>

      </div>

      {/* ======================================================
          RETURNS PER WEEK
      ====================================================== */}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">

        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Returns Per Week (Last 8 Weeks)
        </h2>

        <div className="h-72">

          {data.returnsPerWeek.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              No return data available.
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={data.returnsPerWeek}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />

                {/* IMPORTANT:
                    DashboardMetrics uses weekLabel,
                    NOT week.
                */}

                <XAxis
                  dataKey="weekLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                  }}
                  dy={10}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#64748b",
                  }}
                  allowDecimals={false}
                />

                <RechartsTooltip
                  cursor={{
                    fill: "#f1f5f9",
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />

                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />

              </BarChart>

            </ResponsiveContainer>
          )}

        </div>
      </div>

    </div>
  );
}

// ============================================================
// METRIC CARD
// ============================================================

function MetricCard({
  title,
  value,
  icon,
  bgColor,
  borderColor,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div
      className={`p-6 rounded-xl border ${borderColor} ${bgColor} flex items-center shadow-sm`}
    >

      <div className="flex-1">

        <p className="text-sm font-medium text-slate-600 mb-1">
          {title}
        </p>

        <p className="text-3xl font-bold text-slate-800">
          {value}
        </p>

      </div>

      <div className="p-3 bg-white rounded-lg shadow-sm border border-slate-100/50">
        {icon}
      </div>

    </div>
  );
}