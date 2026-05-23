import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
