import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SessionUser, Role } from "@/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    "asset-lending-secret-key-2026-secure-token"
);

const COOKIE_NAME = "auth_token";

/**
 * Create a JWT session token for the authenticated user.
 */
export async function createSessionToken(
  user: SessionUser
): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isDemo: !!user.isDemo,
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

/**
 * Verify a JWT session token.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role as Role,
      isDemo: typeof payload.isDemo === "boolean" ? payload.isDemo : false,
    };
  } catch {
    return null;
  }
}

/**
 * Get the currently authenticated user from the auth cookie.
 *
 * This function is SERVER-SIDE ONLY because it uses next/headers.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Require an authenticated user.
 *
 * Throws UNAUTHORIZED if no valid session exists.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * Require the current user to be a librarian.
 */
export async function requireLibrarian(): Promise<SessionUser> {
  const user = await requireAuth();

  if (user.role !== "LIBRARIAN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/**
 * Require the current user to be a librarian WITHOUT the restricted
 * "demo" flag. Use this to guard item-approval actions (issuing,
 * declining, or directly issuing a loan) that the demo librarian
 * account must not be able to perform.
 */
export async function requireFullLibrarian(): Promise<SessionUser> {
  const user = await requireLibrarian();

  if (user.isDemo) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/**
 * Set the authentication cookie on a response.
 */
export function setAuthCookie(
  response: NextResponse,
  token: string
): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

/**
 * Clear the authentication cookie.
 */
export function clearAuthCookie(
  response: NextResponse
): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}