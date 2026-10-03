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
