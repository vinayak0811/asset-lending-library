import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, requireFullLibrarian } from "@/lib/auth";
import { getComputedStatus } from "@/lib/loan-rules";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const archivedParam = searchParams.get("archived");
    const search = searchParams.get("search")?.trim();
    const category = searchParams.get("category")?.trim();
    const custodianId = searchParams.get("custodianId")?.trim();

    const isArchived = archivedParam === "true";

    const whereClause: any = {
      isArchived,
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { code: { contains: search } },
        { category: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    if (custodianId) {
      whereClause.custodians = {
        some: {
          userId: custodianId,
        },
      };
    }

    const items = await prisma.catalogueItem.findMany({
      where: whereClause,
      include: {
        custodians: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        loans: {
          where: {
            status: { in: ["REQUESTED", "ISSUED"] },
          },
          include: {
            borrower: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { loans: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response
    const formatted = items.map((item) => {
      const activeLoan = item.loans[0]
        ? {
            ...item.loans[0],
            computedStatus: getComputedStatus(item.loans[0]),
          }
        : null;

      return {
        id: item.id,
        code: item.code,
        title: item.title,
        category: item.category,
        description: item.description,
        isArchived: item.isArchived,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        custodians: item.custodians.map((c) => ({
          id: c.id,
          userId: c.userId,
          user: c.user,
        })),
        activeLoan,
        activeLoans: activeLoan ? [activeLoan] : [],
        _count: { loans: item._count.loans },
        loansCount: item._count.loans,
      };
    });

    // Also get all unique categories for filters
    const categories = await prisma.catalogueItem.findMany({
      select: { category: true },
      distinct: ["category"],
    });

    return NextResponse.json({
      items: formatted,
      categories: categories.map((c) => c.category).sort(),
    });
  } catch (err: any) {
    console.error("Error fetching catalogue:", err);
    return NextResponse.json(
      { error: "Failed to fetch catalogue items." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFullLibrarian();

    const body = await req.json();
    const { code, title, category, description, custodianIds } = body;

    if (!code || !title || !category) {
      return NextResponse.json(
        { error: "Code, title, and category are required." },
        { status: 400 }
      );
    }

    const cleanCode = String(code).trim().toUpperCase();

    // Check if code already exists
    const existing = await prisma.catalogueItem.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An item with code '${cleanCode}' already exists.` },
        { status: 400 }
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      const newItem = await tx.catalogueItem.create({
        data: {
          code: cleanCode,
          title: String(title).trim(),
          category: String(category).trim(),
          description: description ? String(description).trim() : null,
        },
      });

      if (Array.isArray(custodianIds) && custodianIds.length > 0) {
        await tx.custodian.createMany({
          data: custodianIds.map((userId: string) => ({
            itemId: newItem.id,
            userId,
          })),
        });
      }

      return newItem;
    });

    const fullItem = await prisma.catalogueItem.findUnique({
      where: { id: item.id },
      include: {
        custodians: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });

    return NextResponse.json(fullItem, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Only librarians can create catalogue items." },
        { status: 403 }
      );
    }
    console.error("Error creating catalogue item:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create catalogue item." },
      { status: 500 }
    );
  }
}
