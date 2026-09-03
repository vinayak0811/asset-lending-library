"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Library,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  LayoutDashboard,
  ShieldCheck,
  User,
  LogOut,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, switchUser } = useAuth();
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState<number>(0);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlertCount(data.count || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [user, pathname]);

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/catalogue", label: "Catalogue", icon: BookOpen },
    { href: "/loans", label: "Loans", icon: ClipboardList },
    {
      href: "/alerts",
      label: "Overdue Alerts",
      icon: AlertTriangle,
      badge: alertCount > 0 ? alertCount : undefined,
    },
    ...(user?.role === "LIBRARIAN"
      ? [{ href: "/members", label: "Members", icon: Users }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/dashboard" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
                <Library className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                  SharedShelf
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                    Lending
                  </span>
                </span>
                <span className="text-xs text-slate-500 block">Equipment & Tools Library</span>
              </div>
            </Link>
          </div>

          {/* Center Navigation Links */}
          {user && (
            <nav className="hidden md:flex items-center space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition relative ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-blue-600" : "text-slate-400"
                      }`}
                    />
                    {link.label}
                    {link.badge !== undefined && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-rose-600 rounded-full animate-bounce">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Actions / Role Switcher */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Fast Demo-to-Demo Role Switcher for Tester (full-access
                    Librarian / Member accounts are intentionally not
                    reachable here — see README.md) */}
                <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-500 px-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Switch:
                  </span>
                  <button
                    onClick={() => switchUser("LIBRARIAN_DEMO")}
                    title="Restricted demo librarian — member names hidden, no approval rights"
                    className={`px-2.5 py-1 rounded font-medium transition ${
                      user.role === "LIBRARIAN" && user.isDemo
                        ? "bg-white text-blue-700 shadow-sm font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Librarian Demo
                  </button>
                  <button
                    onClick={() => switchUser("MEMBER_DEMO")}
                    title="Restricted demo member — view only, cannot submit requests"
                    className={`px-2.5 py-1 rounded font-medium transition ${
                      user.role === "MEMBER" && user.isDemo
                        ? "bg-white text-blue-700 shadow-sm font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Member Demo
                  </button>
                </div>

                {/* User Pill */}
                <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-slate-900">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                      {user.role === "LIBRARIAN" ? (
                        <span
                          className={`font-medium flex items-center gap-0.5 ${
                            user.isDemo ? "text-amber-600" : "text-blue-600"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3 inline" />
                          Librarian{user.isDemo ? " (Demo)" : ""}
                        </span>
                      ) : (
                        <span
                          className={`font-medium flex items-center gap-0.5 ${
                            user.isDemo ? "text-amber-600" : "text-slate-600"
                          }`}
                        >
                          <User className="w-3 h-3 inline" /> Member{user.isDemo ? " (Demo)" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
