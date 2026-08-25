import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Allow static files and internal Next.js assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt)$/)
  ) {
    return NextResponse.next();
  }

  // Allow auth-related endpoints and login page
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1/auth") ||
    pathname.startsWith("/api/v1/health")
  ) {
    return NextResponse.next();
  }

  // Allow API routes to be handled by their respective route handlers (which return JSON errors/401)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check for authentication session cookies
  const hasBetterAuthSession =
    Boolean(request.cookies.get("better-auth.session_token")?.value) ||
    Boolean(request.cookies.get("__Secure-better-auth.session_token")?.value);
  const hasUiSession = Boolean(request.cookies.get("openscene_admin_session")?.value);

  if (!hasBetterAuthSession && !hasUiSession) {
    const loginUrl = new URL("/login", request.url);
    const destination = pathname + (search || "");
    if (destination && destination !== "/") {
      loginUrl.searchParams.set("next", destination);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
