import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import {
  getComputedStatus,
  requestLoan,
  issueLoan,
  checkItemHasOpenLoan,
} from "@/lib/loan-rules";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim();
    const statusFilter = searchParams.get("status")?.trim();
    const itemId = searchParams.get("itemId")?.trim();
    const borrowerId = searchParams.get("borrowerId")?.trim();
    const sortBy = searchParams.get("sortBy")?.trim() || "requestedDate";
    const sortOrder = (searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    const now = new Date();
    const where: any = {};

    // Role-based scope enforcement
    if (user.role === "MEMBER") {
      where.borrowerId = user.id;
    } else if (borrowerId) {
      where.borrowerId = borrowerId;
    }

    if (itemId) {
      where.itemId = itemId;
    }

    // Status filter handling on the server
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "OVERDUE") {
        where.status = "ISSUED";
        where.dueDate = { lt: now };
      } else if (statusFilter === "ISSUED") {
        // If user wants strictly active on-time issued loans:
        // or any issued: usually ISSUED filter matches status = 'ISSUED'
        where.status = "ISSUED";
      } else {
        where.status = statusFilter;
      }
    }

    // Server-side text search over item title and borrower name/email
    if (search) {
      where.OR = [
        {
          item: {
            title: { contains: search },
          },
        },
        {
          item: {
            code: { contains: search },
          },
        },
        {
          borrower: {
            name: { contains: search },
          },
        },
        {
          borrower: {
            email: { contains: search },
          },
        },
      ];
    }

    // Determine sorting
    let orderBy: any = {};
    if (sortBy === "dueDate") {
      orderBy = { dueDate: sortOrder };
    } else if (sortBy === "status") {
      orderBy = { status: sortOrder };
    } else if (sortBy === "item") {
      orderBy = { item: { title: sortOrder } };
    } else if (sortBy === "borrower") {
      orderBy = { borrower: { name: sortOrder } };
    } else {
      orderBy = { requestedDate: sortOrder };
    }

    const [totalCount, loans] = await Promise.all([
      prisma.loan.count({ where }),
      prisma.loan.findMany({
        where,
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
          events: {
            include: {
              actor: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
            orderBy: { timestamp: "asc" },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const formattedLoans = loans.map((l) => ({
      ...l,
      requestedDate: l.requestedDate.toISOString(),
      issuedDate: l.issuedDate ? l.issuedDate.toISOString() : null,
      dueDate: l.dueDate ? l.dueDate.toISOString() : null,
      returnedDate: l.returnedDate ? l.returnedDate.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      computedStatus: getComputedStatus(l),
    }));

    return NextResponse.json({
      loans: formattedLoans,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Please sign in to view loans." }, { status: 401 });
    }
    console.error("Error querying loans:", err);
    return NextResponse.json(
      { error: "Failed to retrieve loans." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { itemId, borrowerId, directIssue, dueDate, notes } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: "Catalogue item ID is required." },
        { status: 400 }
      );
    }

    // Determine target borrower
    const targetBorrowerId =
      user.role === "LIBRARIAN" && borrowerId ? borrowerId : user.id;

    if (directIssue) {
      if (user.role !== "LIBRARIAN") {
        return NextResponse.json(
          { error: "Only librarians can directly issue a loan." },
          { status: 403 }
        );
      }

      if (user.isDemo) {
        return NextResponse.json(
          { error: "This demo librarian account cannot directly issue items — that's an approval action." },
          { status: 403 }
        );
      }

      if (!dueDate) {
        return NextResponse.json(
          { error: "A due date is required for directly issuing a loan." },
          { status: 400 }
        );
      }

      // Check open loans
      const { hasOpenLoan, openLoan } = await checkItemHasOpenLoan(itemId);
      if (hasOpenLoan) {
        return NextResponse.json(
          {
            error: `Cannot issue item because it already has an open loan (${openLoan.status}) by ${openLoan.borrower.name}.`,
          },
          { status: 400 }
        );
      }

      // Check item exists and not archived
      const item = await prisma.catalogueItem.findUnique({
        where: { id: itemId },
      });

      if (!item || item.isArchived) {
        return NextResponse.json(
          { error: "Cannot issue an archived or non-existent catalogue item." },
          { status: 400 }
        );
      }

      const parsedDueDate = new Date(dueDate);

      const loan = await prisma.$transaction(async (tx) => {
        const newLoan = await tx.loan.create({
          data: {
            itemId,
            borrowerId: targetBorrowerId,
            status: "ISSUED",
            issuedDate: new Date(),
            dueDate: parsedDueDate,
            notes: notes || null,
          },
          include: { item: true, borrower: true },
        });

        await tx.loanEvent.create({
          data: {
            loanId: newLoan.id,
            actorId: user.id,
            action: "ISSUED",
            notes: notes ? `Directly issued by librarian. Due date: ${parsedDueDate.toISOString().split("T")[0]}. Note: ${notes}` : `Directly issued by librarian. Due date: ${parsedDueDate.toISOString().split("T")[0]}`,
          },
        });

        return newLoan;
      });

      return NextResponse.json(
        {
          ...loan,
          computedStatus: getComputedStatus(loan),
        },
        { status: 201 }
      );
    }

    // Normal Request
    if (user.role === "MEMBER" && user.isDemo) {
      return NextResponse.json(
        { error: "This demo member account can browse items but cannot submit loan requests." },
        { status: 403 }
      );
    }

    const loan = await requestLoan(itemId, targetBorrowerId, notes);
    return NextResponse.json(
      {
        ...loan,
        computedStatus: getComputedStatus(loan),
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Error creating loan:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create loan." },
      { status: 400 }
    );
  }
}
