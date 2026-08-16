import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session on every request and guards the app routes.
 *
 * Called `proxy` rather than `middleware`: Next 16 renamed the convention. The
 * behaviour is identical — same signature, same `config.matcher` — only the
 * file name and the exported function name changed.
 *
 * `getUser()` rather than `getSession()`: getSession only decodes the cookie,
 * which a client can forge. getUser verifies the JWT with Supabase, so a
 * tampered cookie cannot get past this.
 *
 * This is a guard, not the authorisation model. Next's own guidance is that the
 * proxy is an optimistic check; every read is additionally protected by RLS in
 * the database, which is what actually stops one user reading another's rows.
 */

const PROTECTED = ["/dashboard"];

/**
 * Routes a signed-in user is bounced away from.
 *
 * `/reset-password` is deliberately NOT here. Verifying a recovery code signs
 * the user in, so listing it would redirect them to the dashboard the instant
 * the code succeeded — before they could set a new password, leaving them
 * still on the old one.
 */
const AUTH_ROUTES = ["/login", "/signup", "/verify", "/forgot-password"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Return the user where they were headed once they are through.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in user has no business on the login or signup screens.
  if (user && AUTH_ROUTES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — the session refresh
     * costs a network call, and there is no reason to pay it for a favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
