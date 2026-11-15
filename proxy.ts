import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminPathMode, isAdminOnlyHost } from "./lib/admin-host";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (adminPathMode()) return NextResponse.next();
  if (!isAdminOnlyHost(request.headers.get("host"))) {
    if (path === "/admin" || path.startsWith("/admin/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (path === "/") {
    return NextResponse.rewrite(new URL("/admin", request.url));
  }
  if (
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/image/") ||
    path.startsWith("/images/") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/robots.txt"
  ) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
