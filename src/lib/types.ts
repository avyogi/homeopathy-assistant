export type Gender = "male" | "female" | "other" | "unspecified";

export type Patient = {
  id: string;
  doctor_id: string;
  full_name: string;
  contact_phone: string | null;
  age: number | null;
  gender: Gender | null;
  constitutional_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SymptomEntry = {
  location: string;
  sensation: string;
  modality: string;
  concomitant: string;
};

export type PrescribedRemedy = {
  name: string;
  potency: string;
  system: "classical" | "electro-homeopathy" | "other";
  notes?: string;
};

export type Consultation = {
  id: string;
  patient_id: string;
  symptoms: string[];
  doctor_notes: string | null;
  remedy_analysis: string | null;
  prescribed_remedies: PrescribedRemedy[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export function formatSymptom(symptom: SymptomEntry): string {
  return [
    `Location: ${symptom.location.trim()}`,
    `Sensation: ${symptom.sensation.trim()}`,
    `Modality: ${symptom.modality.trim()}`,
    `Concomitant: ${symptom.concomitant.trim()}`,
  ].join(" | ");
}

export function emptySymptom(): SymptomEntry {
  return { location: "", sensation: "", modality: "", concomitant: "" };
}

export function parseSymptom(raw: string): SymptomEntry {
  const parts = raw.split("|").map((part) => part.trim());
  const value = (label: string) => {
    const match = parts.find((part) =>
      part.toLowerCase().startsWith(`${label.toLowerCase()}:`),
    );
    return match ? match.slice(label.length + 1).trim() : "";
  };

  return {
    location: value("Location"),
    sensation: value("Sensation"),
    modality: value("Modality"),
    concomitant: value("Concomitant"),
  };
}

export function previewText(value: string): string {
  return `${value.trim().slice(0, 10)}...`;
}

export function parseSuggestedTags(markdown: string): string[] {
  const match = markdown.match(/##\s*Suggested Tags\s*([\s\S]*?)(?=\n##\s|$)/i);
  if (!match) return [];

  const tags = match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line && !line.startsWith("#"));

  return [...new Set(tags)].slice(0, 4);
}

export function consultationHistoryLabel(consultation: {
  doctor_notes: string | null;
  tags?: string[] | null;
  symptoms: string[];
}): string {
  const tags = consultation.tags ?? [];
  const notes = consultation.doctor_notes?.trim() ?? "";

  if (tags.length === 0) {
    const symptom = parseSymptom(consultation.symptoms[0] ?? "");
    return `${previewText(symptom.location)} ${previewText(symptom.sensation)}`;
  }

  if (!notes) return tags.join(", ");

  return `${previewText(notes)} ${tags.join(", ")}`;
}
