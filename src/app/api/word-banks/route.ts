import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createWordBankSchema = z.object({
  name: z.string().min(1).max(100),
  terms: z
    .array(
      z.object({
        term: z.string().min(1),
        definition: z.string().min(1),
      }),
    )
    .min(1)
    .max(100),
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

    const body = await request.json();
    const parsed = createWordBankSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, terms } = parsed.data;

    const { data: wordBank, error: insertError } = await supabase
      .from("word_banks")
      .insert({
        user_id: user.id,
        name,
        terms: terms as unknown as Record<string, unknown>[],
      })
      .select()
      .single();

    if (insertError) {
      console.error("Word bank insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save word bank" },
        { status: 500 },
      );
    }

    return NextResponse.json({ wordBank });
  } catch (error) {
    console.error("Create word bank error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: wordBanks, error } = await supabase
      .from("word_banks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch word banks" },
        { status: 500 },
      );
    }

    return NextResponse.json({ wordBanks });
  } catch (error) {
    console.error("Fetch word banks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
