import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";
import type { SymptomEntry } from "@/lib/types";

export const maxDuration = 60;

type AnalyzeBody = {
  patientName?: string;
  age?: number | null;
  gender?: string | null;
  constitutionalNotes?: string | null;
  symptoms: SymptomEntry[];
  doctorNotes?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      "GOOGLE_GENERATIVE_AI_API_KEY is not configured",
      { status: 500 },
    );
  }

  const body = (await req.json()) as AnalyzeBody;
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];

  if (symptoms.length === 0) {
    return new Response("At least one symptom is required", { status: 400 });
  }

  if (symptoms.length > 10) {
    return new Response("Maximum of 10 symptoms allowed", { status: 400 });
  }

  const symptomBlock = symptoms
    .map((s, i) => {
      return `${i + 1}. Location: ${s.location || "—"}
   Sensation: ${s.sensation || "—"}
   Modality: ${s.modality || "—"}
   Concomitant: ${s.concomitant || "—"}`;
    })
    .join("\n");

  const prompt = `Analyze this homeopathic case and produce the required Markdown sections.

Patient: ${body.patientName || "Unknown"}
Age: ${body.age ?? "Unknown"}
Gender: ${body.gender ?? "Unknown"}
Constitutional notes: ${body.constitutionalNotes || "None provided"}

Structured symptoms:
${symptomBlock}

Doctor notes:
${body.doctorNotes?.trim() || "None"}`;

  try {
    const result = streamText({
      model: google("gemini-3.8-flash"),
      system: ANALYSIS_SYSTEM_PROMPT,
      prompt,
      onError: ({ error }) => {
        console.error("Gemini analysis stream error:", error);
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let produced = false;
          for await (const chunk of result.textStream) {
            produced = true;
            controller.enqueue(encoder.encode(chunk));
          }
          if (!produced) {
            controller.enqueue(
              encoder.encode(
                "Gemini returned an empty analysis. Try again or check the model/API key.",
              ),
            );
          }
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Gemini analysis failed";
          console.error("Gemini analysis failed:", error);
          try {
            controller.enqueue(encoder.encode(`\n\n**Error:** ${message}`));
            controller.close();
          } catch {
            controller.error(error);
          }
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    const message =
      error instanceof Error ? error.message : "Gemini analysis failed";
    return new Response(message, { status: 502 });
  }
}
