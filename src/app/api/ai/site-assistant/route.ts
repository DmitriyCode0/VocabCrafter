import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateFromGeminiWithUsage, GEMINI_MODEL } from "@/lib/gemini/client";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getFeaturesForRole } from "@/lib/knowledge/platform-features";
import type { Role } from "@/types/roles";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const requestSchema = z.object({
  pathname: z.string().trim().max(300).optional(),
  messages: z.array(messageSchema).min(1).max(20),
});

const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1),
  suggestedLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        href: z.string().trim().min(1).max(150),
      }),
    )
    .max(3)
    .optional()
    .default([]),
  followUps: z
    .array(z.string().trim().min(1))
    .max(2)
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, app_language, full_name")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const quota = await checkAIQuota(user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `AI call limit reached (${quota.limit}/month). Upgrade your plan for more.`,
          code: "QUOTA_EXCEEDED",
        },
        { status: 429 },
      );
    }

    const role = (profile.role as Role) || "student";
    const appLanguage = normalizeAppLanguage(profile.app_language);
    const defaultReplyLanguage = appLanguage === "uk" ? "Ukrainian" : "English";
    const pathname = parsed.data.pathname || "/dashboard";

    const availableFeatures = getFeaturesForRole(role);
    const allowedHrefs = new Set(availableFeatures.map((f) => f.href));
    allowedHrefs.add("/dashboard");

    const featuresManifestText = availableFeatures
      .map(
        (feature) =>
          `### ${feature.title}
- Route: ${feature.href}
- Summary: ${feature.summary}
- How to use:
${feature.howTo.map((step) => `  * ${step}`).join("\n")}`,
      )
      .join("\n\n");

    const conversationHistory = parsed.data.messages
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`,
      )
      .join("\n\n");

    const prompt = `You are the VocabCrafter 2.0 Site Concierge & Assistant. Your job is to help users navigate the application, discover features, and understand step-by-step how things work.

USER CONTEXT:
- User Role: ${role}
- Current Page URL: ${pathname}
- Default Language: ${defaultReplyLanguage}

AVAILABLE APP FEATURES FOR THIS USER (${role}):
${featuresManifestText}

GUIDELINES:
1. Answer clearly, warmly, and concisely (ideal for reading on both desktop and mobile).
2. Always match the language the user writes in (e.g. if they ask in Ukrainian, respond in Ukrainian; if English, respond in English; otherwise use ${defaultReplyLanguage}).
3. Reference exact button names, tabs, and pages from the feature manifest above. Do NOT invent features or routes that are not listed in the manifest.
4. If a tutor-only feature is requested by a student (like Google Calendar OAuth setup or billing balances), politely clarify that their tutor manages it on their end.
5. In "suggestedLinks", include 1–3 relevant deep links from the exact "Route" values listed in the manifest above (e.g. { "label": "Open Schedule", "href": "/lessons" }) with short button labels translated into the response language.
6. In "followUps", suggest 2 helpful short follow-up questions in the response language.

CONVERSATION HISTORY:
${conversationHistory}

Respond strictly in JSON format:
{
  "reply": "Clear step-by-step markdown response (**bold** and bullet points supported)",
  "suggestedLinks": [
    { "label": "Short Action Label", "href": "/exact-route" }
  ],
  "followUps": ["Follow-up question 1?", "Follow-up question 2?"]
}`;

    const { data: result, usageSnapshot } = await generateFromGeminiWithUsage(
      {
        prompt,
        systemInstruction:
          "You are the official AI guide for VocabCrafter 2.0. Always return valid JSON only.",
        temperature: 0.3,
      },
      assistantResponseSchema,
    );

    // Filter out any hallucinated routes just in case
    const sanitizedLinks = (result.suggestedLinks ?? []).filter((link) =>
      allowedHrefs.has(link.href),
    );

    await recordAIUsageEvent({
      userId: user.id,
      feature: "site_assistant",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: usageSnapshot,
    });

    await incrementAICalls(user.id);

    return NextResponse.json({
      reply: result.reply,
      suggestedLinks: sanitizedLinks,
      followUps: result.followUps ?? [],
    });
  } catch (error) {
    console.error("Site assistant error:", error);
    return NextResponse.json(
      { error: "Failed to get response from Site Assistant" },
      { status: 500 },
    );
  }
}

