"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import PatientSidebar from "./PatientSidebar";
import PatientWorkspace from "./PatientWorkspace";

type Props = {
  doctorId: string;
};

export default function Dashboard({ doctorId }: Props) {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("patients")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("full_name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setPatients([]);
    } else {
      setPatients((data as Patient[]) || []);
      setError(null);
    }
    setLoading(false);
  }, [doctorId]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const selected = patients.find((p) => p.id === selectedId) || null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <PatientSidebar
        doctorId={doctorId}
        patients={patients}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreated={(patient) => {
          setPatients((prev) =>
            [...prev, patient].sort((a, b) =>
              a.full_name.localeCompare(b.full_name),
            ),
          );
          setSelectedId(patient.id);
        }}
        onSignOut={signOut}
      />

      {loading ? (
        <div className="workspace-empty">Loading patients…</div>
      ) : error ? (
        <div className="workspace-empty">
          <p className="form-error">{error}</p>
          <p className="empty-hint">
            Ensure the Supabase migration has been applied and env vars are set.
          </p>
        </div>
      ) : selected ? (
        <PatientWorkspace key={selected.id} patient={selected} />
      ) : (
        <div className="workspace-empty">
          <div>
            <h2 style={{ marginBottom: "0.4rem" }}>Select a patient</h2>
            <p className="empty-hint">
              Search the sidebar or create a new patient to begin a consultation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
