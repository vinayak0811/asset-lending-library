import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSessionToken, setAuthCookie } from "@/lib/auth";

/**
 * Public self-registration endpoint.
 *
 * Anyone can sign up, but only ever as a MEMBER — librarian accounts
 * are provisioned deliberately by an existing librarian via the
 * /members admin page (POST /api/users), never through public signup.
 * This keeps the "librarian vs member" role boundary meaningful:
 * elevated access is granted, not self-assigned.
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, confirmPassword } = await req.json();

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!email || !String(email).trim()) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!password || String(password).length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Try signing in instead." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash,
        role: "MEMBER",
      },
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "LIBRARIAN" | "MEMBER",
      isDemo: false,
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json(
      { user: sessionUser, message: "Account created successfully." },
      { status: 201 }
    );

    setAuthCookie(response, token);
    return response;
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during signup." },
      { status: 500 }
    );
  }
}
