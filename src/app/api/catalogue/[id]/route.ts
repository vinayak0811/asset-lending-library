import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";
import { getComputedStatus } from "@/lib/loan-rules";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.catalogueItem.findUnique({
      where: { id: params.id },
      include: {
        custodians: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        loans: {
          include: {
            borrower: {
              select: { id: true, name: true, email: true },
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
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Catalogue item not found." },
        { status: 404 }
      );
    }

    const formattedLoans = item.loans.map((loan) => ({
      ...loan,
      computedStatus: getComputedStatus(loan),
    }));

    const activeLoan = formattedLoans.find(
      (l) => l.status === "REQUESTED" || l.status === "ISSUED"
    ) || null;

    return NextResponse.json({
      item: {
        ...item,
        loans: formattedLoans,
        activeLoan,
        activeLoans: activeLoan ? [activeLoan] : [],
        _count: { loans: formattedLoans.length },
      },
    });
  } catch (err: any) {
    console.error("Error fetching catalogue item:", err);
    return NextResponse.json(
      { error: "Failed to fetch catalogue item details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireFullLibrarian();
    const body = await req.json();
    const { title, category, description, isArchived, custodianIds } = body;

    const existing = await prisma.catalogueItem.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Catalogue item not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (title !== undefined) dataToUpdate.title = String(title).trim();
      if (category !== undefined) dataToUpdate.category = String(category).trim();
      if (description !== undefined)
        dataToUpdate.description = description ? String(description).trim() : null;
      if (isArchived !== undefined) dataToUpdate.isArchived = Boolean(isArchived);

      const item = await tx.catalogueItem.update({
        where: { id: params.id },
        data: dataToUpdate,
      });

      if (Array.isArray(custodianIds)) {
        // Replace custodians
        await tx.custodian.deleteMany({
          where: { itemId: params.id },
        });

        if (custodianIds.length > 0) {
          await tx.custodian.createMany({
            data: custodianIds.map((userId: string) => ({
              itemId: params.id,
              userId,
            })),
          });
        }
      }

      return item;
    });

    const fullItem = await prisma.catalogueItem.findUnique({
      where: { id: updated.id },
      include: {
        custodians: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json(fullItem);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can update catalogue items." },
        { status: 403 }
      );
    }
    console.error("Error updating catalogue item:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update catalogue item." },
      { status: 500 }
    );
  }
}
