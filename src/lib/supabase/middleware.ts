import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId =
    typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/auth/callback",
    "/onboarding",
    "/forgot-password",
    "/reset-password",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // If not authenticated and trying to access protected route
  if (!userId && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Block unapproved authenticated users from protected API routes
  if (userId && isApiRoute) {
    const { data: apiProfile, error: apiProfileError } = await supabase
      .from("profiles")
      .select("role, approval_status")
      .eq("id", userId)
      .single();

    if (
      !apiProfileError &&
      apiProfile &&
      apiProfile.role !== "superadmin" &&
      apiProfile.approval_status &&
      apiProfile.approval_status !== "approved"
    ) {
      return NextResponse.json(
        {
          error: "Your account is pending administrator approval.",
          code: "ACCOUNT_PENDING_APPROVAL",
        },
        { status: 403 },
      );
    }
  }

  // If authenticated user visits /onboarding after completing it, redirect to dashboard
  if (userId && pathname === "/onboarding") {
    const { data: onboardingProfile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (onboardingProfile?.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // If authenticated and on login/register, redirect to dashboard
  if (userId && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
