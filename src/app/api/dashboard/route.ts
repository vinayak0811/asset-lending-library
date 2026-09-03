import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DashboardMetrics, DisplayStatus } from "@/types";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const now = new Date();

    // 1. Headline numbers
    const totalCatalogueItems = await prisma.catalogueItem.count({
      where: { isArchived: false },
    });

    const activeIssuedLoans = await prisma.loan.findMany({
      where: { status: "ISSUED" },
      select: { id: true, dueDate: true, status: true },
    });

    const itemsCurrentlyOut = activeIssuedLoans.length;
    const itemsOverdue = activeIssuedLoans.filter(
      (l) => l.dueDate && new Date(l.dueDate) < now
    ).length;

    // Start of this week (Sunday/Monday)
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const loansReturnedThisWeek = await prisma.loan.count({
      where: {
        status: "RETURNED",
        returnedDate: {
          gte: thisWeekStart,
        },
      },
    });

    // 2. Loans breakdown by status
    const allLoans = await prisma.loan.findMany({
      select: { status: true, dueDate: true },
    });

    let requestedCount = 0;
    let issuedOnTimeCount = 0;
    let overdueCount = 0;
    let returnedCount = 0;
    let lostCount = 0;
    let declinedCount = 0;

    for (const l of allLoans) {
      if (l.status === "REQUESTED") {
        requestedCount++;
      } else if (l.status === "RETURNED") {
        returnedCount++;
      } else if (l.status === "LOST") {
        lostCount++;
      } else if (l.status === "DECLINED") {
        declinedCount++;
      } else if (l.status === "ISSUED") {
        if (l.dueDate && new Date(l.dueDate) < now) {
          overdueCount++;
        } else {
          issuedOnTimeCount++;
        }
      }
    }

    const loansByStatus: { status: DisplayStatus; count: number }[] = [
      { status: "REQUESTED", count: requestedCount },
      { status: "ISSUED", count: issuedOnTimeCount },
      { status: "OVERDUE", count: overdueCount },
      { status: "RETURNED", count: returnedCount },
      { status: "LOST", count: lostCount },
      { status: "DECLINED", count: declinedCount },
    ];

    // 3. Custodians breakdown
    const custodians = await prisma.user.findMany({
      where: { role: "LIBRARIAN" },
      select: {
        id: true,
        name: true,
        email: true,
        custodians: {
          include: {
            item: {
              include: {
                loans: {
                  where: { status: "ISSUED" },
                },
              },
            },
          },
        },
      },
    });

    const loansByCustodian = custodians.map((c) => {
      const items = c.custodians.map((rel) => rel.item);
      const activeLoanCount = items.reduce(
        (sum, item) => sum + (item.loans.length > 0 ? 1 : 0),
        0
      );
      return {
        custodianName: c.name,
        custodianEmail: c.email,
        itemCount: items.length,
        activeLoanCount,
      };
    });

    // 4. Returns per week over the last 8 weeks
    const returnsPerWeek = [];
    for (let i = 7; i >= 0; i--) {
      const targetDate = subWeeks(now, i);
      const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(targetDate, { weekStartsOn: 1 });

      const count = await prisma.loan.count({
        where: {
          status: "RETURNED",
          returnedDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      returnsPerWeek.push({
        weekLabel: i === 0 ? "This Week" : format(weekStart, "MMM d"),
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        count,
      });
    }

    const metrics: DashboardMetrics = {
      itemsCurrentlyOut,
      itemsOverdue,
      loansReturnedThisWeek,
      totalCatalogueItems,
      loansByStatus,
      loansByCustodian,
      returnsPerWeek,
    };

    return NextResponse.json(metrics);
  } catch (err: any) {
    console.error("Dashboard calculation error:", err);
    return NextResponse.json(
      { error: "Failed to calculate dashboard statistics." },
      { status: 500 }
    );
  }
}
