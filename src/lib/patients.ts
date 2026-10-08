import { createClient } from "@/lib/supabase/client";
import { DRY_RUN_PATIENT_NAME, type Patient } from "@/lib/types";

export async function ensureDryRunPatient(doctorId: string): Promise<Patient> {
  const supabase = createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("patients")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("full_name", DRY_RUN_PATIENT_NAME)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (existing) return existing as Patient;

  const { data, error } = await supabase
    .from("patients")
    .insert({
      doctor_id: doctorId,
      full_name: DRY_RUN_PATIENT_NAME,
      gender: "unspecified",
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Patient;
}
