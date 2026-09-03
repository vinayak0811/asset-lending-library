import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSessionToken, setAuthCookie } from "@/lib/auth";

/**
 * Instant switch between the two DEMO accounts only (restricted
 * librarian / restricted member). No password is required because
 * this endpoint never touches the full-access accounts — it looks
 * the target user up by a hardcoded demo email and refuses anything
 * else. The full-access Librarian / Member accounts stay reachable
 * only through the normal /login form with their real credentials
 * (see README.md).
 */
const DEMO_ROLE_EMAILS: Record<string, string> = {
  LIBRARIAN_DEMO: "librarian2@example.com",
  MEMBER_DEMO: "member2@example.com",
};

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();

    const targetEmail = DEMO_ROLE_EMAILS[role];
    if (!targetEmail) {
      return NextResponse.json(
        { error: "Invalid demo role." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    // Defensive: only ever proceed for an account actually flagged as demo.
    if (!user || !user.isDemo) {
      return NextResponse.json(
        { error: "Demo account not found." },
        { status: 404 }
      );
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "LIBRARIAN" | "MEMBER",
      isDemo: true,
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({
      user: sessionUser,
      message: "Switched demo account.",
    });

    setAuthCookie(response, token);
    return response;
  } catch (err: any) {
    console.error("Demo switch error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred while switching accounts." },
      { status: 500 }
    );
  }
}
