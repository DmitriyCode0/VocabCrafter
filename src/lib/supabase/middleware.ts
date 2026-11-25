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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  if (!user && !isPublicRoute && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Block unapproved authenticated users from protected API routes
  if (user && isApiRoute) {
    const { data: apiProfile, error: apiProfileError } = await supabase
      .from("profiles")
      .select("role, approval_status")
      .eq("id", user.id)
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
  if (user && pathname === "/onboarding") {
    const { data: onboardingProfile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (onboardingProfile?.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // If authenticated, check onboarding and manual approval status
  if (user && !isPublicRoute && pathname !== "/onboarding" && !isApiRoute) {
    let profile: {
      onboarding_completed: boolean;
      role: string;
      approval_status?: string | null;
    } | null = null;

    const { data: primaryProfile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed, role, approval_status")
      .eq("id", user.id)
      .single();

    if (
      profileError &&
      profileError.message.toLowerCase().includes("approval_status")
    ) {
      const { data: fallbackProfile } = await supabase
        .from("profiles")
        .select("onboarding_completed, role")
        .eq("id", user.id)
        .single();
      profile = fallbackProfile;
    } else if (!profileError) {
      profile = primaryProfile;
    }

    // If profile doesn't exist yet (e.g., trigger hasn't fired), redirect to onboarding
    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Redirect to onboarding if not completed
    if (!profile.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Restrict unapproved accounts solely to /dashboard
    if (
      profile.role !== "superadmin" &&
      profile.approval_status &&
      profile.approval_status !== "approved" &&
      pathname !== "/dashboard"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (profile) {
      const adminRoutes = ["/analytics", "/users", "/grammar-rules"];
      const tutorRoutes = ["/review", "/assignments/review"];
      const libraryRoutes = ["/library"];
      const isAdminRoute = adminRoutes.some((route) =>
        pathname.startsWith(route),
      );
      const isTutorRoute = tutorRoutes.some((route) =>
        pathname.startsWith(route),
      );
      const isLibraryRoute = libraryRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isAdminRoute && profile.role !== "superadmin") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      if (
        isTutorRoute &&
        profile.role !== "tutor" &&
        profile.role !== "superadmin"
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      if (
        isLibraryRoute &&
        profile.role !== "tutor" &&
        profile.role !== "superadmin"
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // If authenticated and on login/register, redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
