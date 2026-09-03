import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";
import { generateActiveLoansCsv } from "@/lib/csv-helper";
import { getComputedStatus } from "@/lib/loan-rules";

export async function GET(req: NextRequest) {
  try {
    await requireFullLibrarian();

    // Fetch all active issued / overdue loans
    const loans = await prisma.loan.findMany({
      where: {
        status: "ISSUED",
      },
      include: {
        item: {
          select: {
            code: true,
            title: true,
            category: true,
          },
        },
        borrower: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const enriched = loans.map((l) => ({
      ...l,
      computedStatus: getComputedStatus(l),
    }));

    const csvData = generateActiveLoansCsv(enriched);

    const nowStr = new Date().toISOString().split("T")[0];
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="active-loans-${nowStr}.csv"`,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can export active loans." },
        { status: 403 }
      );
    }
    console.error("Export error:", err);
    return NextResponse.json(
      { error: "Failed to export loans CSV." },
      { status: 500 }
    );
  }
}
