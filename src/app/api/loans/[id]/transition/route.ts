import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";
import {
  issueLoan,
  returnLoan,
  markLoanLost,
  declineLoan,
  getComputedStatus,
} from "@/lib/loan-rules";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireFullLibrarian();
    const body = await req.json();
    const { action, dueDate, notes } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required (ISSUE, DECLINE, RETURN, MARK_LOST, ADD_NOTE)." },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "ISSUE": {
        if (!dueDate) {
          return NextResponse.json(
            { error: "Due date is required when issuing a loan." },
            { status: 400 }
          );
        }
        result = await issueLoan(params.id, user.id, new Date(dueDate), notes);
        break;
      }

      case "RETURN": {
        result = await returnLoan(params.id, user.id, notes);
        break;
      }

      case "MARK_LOST": {
        result = await markLoanLost(params.id, user.id, notes);
        break;
      }

      case "DECLINE": {
        result = await declineLoan(params.id, user.id, notes);
        break;
      }

      case "ADD_NOTE": {
        if (!notes || notes.trim().length === 0) {
          return NextResponse.json(
            { error: "Note text cannot be empty." },
            { status: 400 }
          );
        }
        const loan = await prisma.loan.findUnique({
          where: { id: params.id },
        });
        if (!loan) {
          return NextResponse.json({ error: "Loan not found." }, { status: 404 });
        }

        await prisma.loanEvent.create({
          data: {
            loanId: params.id,
            actorId: user.id,
            action: "NOTE_ADDED",
            notes: notes.trim(),
          },
        });

        result = await prisma.loan.findUnique({
          where: { id: params.id },
          include: { item: true, borrower: true },
        });
        break;
      }

      default: {
        return NextResponse.json(
          { error: `Unsupported loan transition action '${action}'.` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ...result,
      computedStatus: getComputedStatus(result!),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can perform loan state transitions." },
        { status: 403 }
      );
    }
    console.error("Loan transition error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process loan transition." },
      { status: 400 }
    );
  }
}
