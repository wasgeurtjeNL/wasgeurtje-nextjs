import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// WordPress core files and paths that should return 404
const BLOCKED_PATHS = [
  '/wp-login.php',
  '/wp-admin',
  '/xmlrpc.php',
  '/wp-content',
  '/wp-includes',
  '/wp-config.php',
  '/readme.html',
  '/.env',
  '/phpmyadmin',
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Block WordPress core files and suspicious paths
  for (const blockedPath of BLOCKED_PATHS) {
    if (path.startsWith(blockedPath)) {
      console.log(`[Middleware] Blocked suspicious request: ${path}`);
      return new NextResponse('Not Found', { status: 404 });
    }
  }
  
  // Allow all other requests
  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

