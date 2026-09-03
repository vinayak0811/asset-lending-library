import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getComputedStatus } from "@/lib/loan-rules";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ alerts: [], count: 0 });
    }

    const now = new Date();

    // Query loans that are ISSUED, dueDate < now, and alertDismissed is false
    const overdueLoans = await prisma.loan.findMany({
      where: {
        status: "ISSUED",
        dueDate: { lt: now },
        alertDismissed: false,
        ...(user.role === "MEMBER" ? { borrowerId: user.id } : {}),
      },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            isArchived: true,
          },
        },
        borrower: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const formatted = overdueLoans.map((l) => ({
      ...l,
      requestedDate: l.requestedDate.toISOString(),
      issuedDate: l.issuedDate ? l.issuedDate.toISOString() : null,
      dueDate: l.dueDate ? l.dueDate.toISOString() : null,
      returnedDate: l.returnedDate ? l.returnedDate.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      computedStatus: getComputedStatus(l),
      daysOverdue: Math.floor(
        (now.getTime() - new Date(l.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({
      alerts: formatted,
      count: formatted.length,
    });
  } catch (err: any) {
    console.error("Alerts query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch alerts." },
      { status: 500 }
    );
  }
}
