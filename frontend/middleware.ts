import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CONFIG } from "./app/config";

const PUBLIC_ROUTES = ["/login", "/register", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass static assets, internal Next.js system routes, and public pages
  if (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // 2. If both tokens are missing, redirect immediately to login gate
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  /* STREAMING_CHUNK: Processing server-side token rotation via Set-Cookie headers... */
  // 3. Access token expired but Refresh token exists -> Trigger silent server-side rotation
  if (!accessToken && refreshToken) {
    try {
      const API_URL = CONFIG.API_URL || "http://localhost:8000/api/v1";

      // Native fetch is Edge-runtime native and handles Set-Cookie header inspection safely
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `refresh_token=${refreshToken}`, // Transmit refresh token as cookie header
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        console.warn(
          `[EDGE MIDDLEWARE] Rotation rejected by Express (Status: ${res.status}). Wiping session...`
        );
        const errorResponse = NextResponse.redirect(
          new URL("/login", request.url)
        );
        errorResponse.cookies.delete("access_token");
        errorResponse.cookies.delete("refresh_token");
        return errorResponse;
      }

      /* STREAMING_CHUNK: Extracting Set-Cookie headers and forwarding to browser response... */
      // Prepare response for page transition
      const response = NextResponse.next({
        request: {
          headers: request.headers,
        },
      });

      // Extract Set-Cookie headers returned directly by Express
      const rawSetCookieHeader = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")?.split(",") || [];

      let extractedAccessToken = "";
      let extractedRefreshToken = "";

      // Parse cookie string values returned by backend
      for (const cookieStr of rawSetCookieHeader) {
        if (cookieStr.includes("access_token=")) {
          const match = cookieStr.match(/access_token=([^;]+)/);
          if (match) extractedAccessToken = match[1];
        }
        if (cookieStr.includes("refresh_token=")) {
          const match = cookieStr.match(/refresh_token=([^;]+)/);
          if (match) extractedRefreshToken = match[1];
        }
      }

      // Fallback: If backend sends tokens in body during transition period
      if (!extractedAccessToken) {
        const body = await res.json().catch(() => ({}));
        const payload = body.data || body;
        extractedAccessToken =
          payload.accessToken || payload.access_token || "";
        extractedRefreshToken =
          payload.refreshToken || payload.refresh_token || "";
      }

      if (!extractedAccessToken) {
        throw new Error(
          "No access_token found in Set-Cookie headers or response body."
        );
      }

      // Mutate current request cookies so downstream React Server Components read active tokens instantly
      request.cookies.set("access_token", extractedAccessToken);
      if (extractedRefreshToken) {
        request.cookies.set("refresh_token", extractedRefreshToken);
      }

      const isProduction = process.env.NODE_ENV === "production";
      const accessAgeSec = CONFIG.NEXT_PUBLIC_ACCESS_COOKIE_AGE;
      const refreshAgeSec = CONFIG.NEXT_PUBLIC_REFRESH_COOKIE_AGE;
      console.log(accessAgeSec, refreshAgeSec, "====================");
      /* STREAMING_CHUNK: Committing rotated httpOnly cookies to browser response jar... */
      // Write rotated cookies to the user's browser response
      response.cookies.set("access_token", extractedAccessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: accessAgeSec,
        path: "/",
      });

      if (extractedRefreshToken) {
        response.cookies.set("refresh_token", extractedRefreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          maxAge: refreshAgeSec,
          path: "/",
        });
      }

      console.log(
        "[EDGE MIDDLEWARE] Session successfully rotated via Set-Cookie headers!"
      );
      return response;
    } catch (error: any) {
      console.error(
        "[EDGE MIDDLEWARE] Token rotation exception:",
        error.message
      );
      const errResponse = NextResponse.redirect(new URL("/login", request.url));
      errResponse.cookies.delete("access_token");
      errResponse.cookies.delete("refresh_token");
      return errResponse;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons/.*).*)"],
};
