import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { getCurrentUser, requireFullLibrarian } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    let whereClause: any = {};

    if (user.role === 'MEMBER') {
      // Members can only see their own profile
      whereClause.id = user.id;
    } else if (user.role === 'LIBRARIAN') {
      // Librarians can filter by role or see all
      if (roleParam) {
        whereClause.role = roleParam;
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isDemo: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Librarian-only: create a new account (member or librarian) directly,
 * without the new user needing to self-register. This backs the
 * "Members" admin page.
 */
export async function POST(request: Request) {
  try {
    await requireFullLibrarian();

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    if (!email || !String(email).trim()) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    if (!password || String(password).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const cleanRole = role === 'LIBRARIAN' ? 'LIBRARIAN' : 'MEMBER';
    const cleanEmail = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An account with email '${cleanEmail}' already exists.` },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const created = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash,
        role: cleanRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Only librarians can create new accounts.' },
        { status: 403 }
      );
    }
    console.error('Error creating user:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create account.' },
      { status: 500 }
    );
  }
}
