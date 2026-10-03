import {
  createTextStreamResponse,
  streamText,
  toTextStream,
} from "ai";
import { openai } from "@ai-sdk/openai";
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

  if (!process.env.OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY is not configured", { status: 500 });
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

  const result = streamText({
    model: openai("gpt-4o"),
    instructions: ANALYSIS_SYSTEM_PROMPT,
    prompt,
  });

  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}
