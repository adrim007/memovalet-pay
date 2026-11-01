import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
  // When a reset or sign-up email asks Supabase for an address that isn't on
  // its allow-list, Supabase quietly falls back to the bare site, so the link
  // lands as /?code=… on the marketing page, which ignores it — the person is
  // never shown "Choose a new password". Nothing else sends a code to the root
  // (Google comes back to /auth/callback, Notion and Slack to their own API
  // routes), so hand it to the route that knows what to do with one.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.has("code")) {
    const confirm = request.nextUrl.clone();
    confirm.pathname = "/auth/confirm";
    return NextResponse.redirect(confirm);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
