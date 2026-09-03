import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const publicPaths = [
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path) || pathname === path)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return handleUnauthorized(request);
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'asset-lending-secret-key-2026-secure-token'
    );
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch (error) {
    return handleUnauthorized(request);
  }
}

function handleUnauthorized(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/');
  
  if (isApiRequest) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } else {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
