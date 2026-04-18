import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Routes that do not require a session
  const PUBLIC_PATHS = [
    '/',
    '/login',
    '/api/auth',
    '/api/chat',      // mock interview — stays fully public
    '/api/personas',  // mock interview — stays fully public
  ];

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (!isAuthenticated && !isPublic) {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
