import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getComputedStatus } from "@/lib/loan-rules";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const loan = await prisma.loan.findUnique({
      where: { id: params.id },
      include: {
        item: {
          include: {
            custodians: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true } },
              },
            },
          },
        },
        borrower: {
          select: { id: true, name: true, email: true, role: true },
        },
        events: {
          include: {
            actor: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found." }, { status: 404 });
    }

    // Role check: Members can only view their own loans
    if (user.role === "MEMBER" && loan.borrowerId !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to view this loan." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ...loan,
      requestedDate: loan.requestedDate.toISOString(),
      issuedDate: loan.issuedDate ? loan.issuedDate.toISOString() : null,
      dueDate: loan.dueDate ? loan.dueDate.toISOString() : null,
      returnedDate: loan.returnedDate ? loan.returnedDate.toISOString() : null,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
      computedStatus: getComputedStatus(loan),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("Error fetching single loan:", err);
    return NextResponse.json(
      { error: "Failed to retrieve loan details." },
      { status: 500 }
    );
  }
}
