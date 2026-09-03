import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";
import { returnLoan } from "@/lib/loan-rules";
import { BulkReturnItemResult, BulkReturnResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const user = await requireFullLibrarian();
    const body = await req.json();
    const { loanIds } = body;

    if (!Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json(
        { error: "loanIds must be a non-empty array of IDs." },
        { status: 400 }
      );
    }

    const results: BulkReturnItemResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const loanId of loanIds) {
      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { item: true },
      });

      if (!loan) {
        results.push({
          loanId,
          success: false,
          message: "Loan not found in system.",
        });
        failedCount++;
        continue;
      }

      if (loan.status === "RETURNED") {
        results.push({
          loanId,
          itemCode: loan.item.code,
          itemTitle: loan.item.title,
          success: false,
          message: `Item '${loan.item.title}' was already returned.`,
        });
        failedCount++;
        continue;
      }

      if (loan.status === "LOST") {
        results.push({
          loanId,
          itemCode: loan.item.code,
          itemTitle: loan.item.title,
          success: false,
          message: `Cannot return loan: item '${loan.item.title}' has been marked as Lost.`,
        });
        failedCount++;
        continue;
      }

      if (loan.status === "REQUESTED") {
        results.push({
          loanId,
          itemCode: loan.item.code,
          itemTitle: loan.item.title,
          success: false,
          message: `Cannot return loan: item '${loan.item.title}' is still in Requested status and was never issued.`,
        });
        failedCount++;
        continue;
      }

      try {
        await returnLoan(loan.id, user.id, "Returned via bulk action");
        results.push({
          loanId,
          itemCode: loan.item.code,
          itemTitle: loan.item.title,
          success: true,
          message: `Successfully returned item '${loan.item.title}'.`,
        });
        successCount++;
      } catch (err: any) {
        results.push({
          loanId,
          itemCode: loan.item.code,
          itemTitle: loan.item.title,
          success: false,
          message: err.message || "Failed to process return.",
        });
        failedCount++;
      }
    }

    const response: BulkReturnResponse = {
      totalRequested: loanIds.length,
      successCount,
      failedCount,
      results,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can perform bulk returns." },
        { status: 403 }
      );
    }
    console.error("Bulk return error:", err);
    return NextResponse.json(
      { error: err.message || "Bulk return operation failed." },
      { status: 500 }
    );
  }
}
