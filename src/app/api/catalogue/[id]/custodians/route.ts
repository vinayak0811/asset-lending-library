import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFullLibrarian } from "@/lib/auth";

/**
 * Assign a librarian as a custodian of a catalogue item.
 * Any number of librarians can be custodians of any number of items.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireFullLibrarian();
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const [item, candidate] = await Promise.all([
      prisma.catalogueItem.findUnique({ where: { id: params.id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!item) {
      return NextResponse.json(
        { error: "Catalogue item not found." },
        { status: 404 }
      );
    }

    if (!candidate) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (candidate.role !== "LIBRARIAN") {
      return NextResponse.json(
        { error: "Only librarians can be assigned as custodians." },
        { status: 400 }
      );
    }

    const existing = await prisma.custodian.findUnique({
      where: { userId_itemId: { userId, itemId: params.id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${candidate.name} is already a custodian of this item.` },
        { status: 400 }
      );
    }

    const custodian = await prisma.custodian.create({
      data: { userId, itemId: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(custodian, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can manage custodians." },
        { status: 403 }
      );
    }
    console.error("Error adding custodian:", err);
    return NextResponse.json(
      { error: err.message || "Failed to add custodian." },
      { status: 500 }
    );
  }
}

/**
 * Remove a librarian's custodian assignment from a catalogue item.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireFullLibrarian();
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.custodian.findUnique({
      where: { userId_itemId: { userId, itemId: params.id } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "This user is not a custodian of this item." },
        { status: 404 }
      );
    }

    await prisma.custodian.delete({
      where: { userId_itemId: { userId, itemId: params.id } },
    });

    return NextResponse.json({ message: "Custodian removed." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can manage custodians." },
        { status: 403 }
      );
    }
    console.error("Error removing custodian:", err);
    return NextResponse.json(
      { error: err.message || "Failed to remove custodian." },
      { status: 500 }
    );
  }
}
