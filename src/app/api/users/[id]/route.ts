import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";

/**
 * Librarian-only: permanently delete a member or librarian account.
 *
 * A user cannot be deleted if they have any loan history (active or
 * past), since loans keep a foreign key back to the borrower for
 * audit purposes. Librarians also cannot delete their own account
 * this way.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireFullLibrarian();

    if (currentUser.id === params.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    const loanCount = await prisma.loan.count({
      where: { borrowerId: params.id },
    });

    if (loanCount > 0) {
      return NextResponse.json(
        {
          error:
            "This account has loan history and cannot be deleted. Remove or reassign their loans first.",
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can delete accounts." },
        { status: 403 }
      );
    }
    console.error("Error deleting user:", err);
    return NextResponse.json(
      { error: "Failed to delete account." },
      { status: 500 }
    );
  }
}
