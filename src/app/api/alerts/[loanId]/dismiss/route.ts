import { NextRequest, NextResponse } from "next/server";
import { requireFullLibrarian } from "@/lib/auth";
import { dismissLoanAlert } from "@/lib/loan-rules";

export async function POST(
  req: NextRequest,
  { params }: { params: { loanId: string } }
) {
  try {
    const user = await requireFullLibrarian();
    const updated = await dismissLoanAlert(params.loanId, user.id);

    return NextResponse.json({
      message: "Alert dismissed successfully.",
      loanId: updated.id,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can dismiss overdue alerts." },
        { status: 403 }
      );
    }
    console.error("Alert dismissal error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to dismiss alert." },
      { status: 400 }
    );
  }
}
