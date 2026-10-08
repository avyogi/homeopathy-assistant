"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureDryRunPatient } from "@/lib/patients";
import { DRY_RUN_PATIENT_NAME, type Consultation, type Patient } from "@/lib/types";
import PatientSidebar from "./PatientSidebar";
import PatientWorkspace from "./PatientWorkspace";

type Props = {
  doctorId: string;
};

type TryMode = { kind: "new" } | { kind: "saved"; id: string } | null;

export default function Dashboard({ doctorId }: Props) {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dryRunPatient, setDryRunPatient] = useState<Patient | null>(null);
  const [dryRuns, setDryRuns] = useState<Consultation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tryMode, setTryMode] = useState<TryMode>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("patients")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setPatients([]);
    } else {
      setPatients((data as Patient[]) || []);
      setError(null);
    }
    setLoading(false);
  }, [doctorId]);

  const loadDryRuns = useCallback(async () => {
    try {
      const patient = await ensureDryRunPatient(doctorId);
      setDryRunPatient(patient);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("consultations")
        .select(
          "id, patient_id, symptoms, doctor_notes, remedy_analysis, prescribed_remedies, tags, created_at, updated_at",
        )
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setDryRuns((data as Consultation[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare dry runs");
    }
  }, [doctorId]);

  useEffect(() => {
    void loadPatients();
    void loadDryRuns();
  }, [loadPatients, loadDryRuns]);

  const listedPatients = patients.filter(
    (patient) => patient.full_name !== DRY_RUN_PATIENT_NAME,
  );
  const selected = listedPatients.find((patient) => patient.id === selectedId) || null;
  const activeDryRun =
    tryMode?.kind === "saved"
      ? dryRuns.find((run) => run.id === tryMode.id) || null
      : null;

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
        patients={listedPatients}
        dryRuns={dryRuns}
        selectedId={tryMode ? null : selectedId}
        activeDryRunId={tryMode?.kind === "saved" ? tryMode.id : null}
        onSelect={(id) => {
          setTryMode(null);
          setSelectedId(id);
        }}
        onTryNow={() => {
          setSelectedId(null);
          setTryMode({ kind: "new" });
        }}
        onOpenDryRun={(id) => {
          setSelectedId(null);
          setTryMode({ kind: "saved", id });
        }}
        onCreated={(patient) => {
          setPatients((prev) => [patient, ...prev]);
          setTryMode(null);
          setSelectedId(patient.id);
        }}
        onSignOut={signOut}
      />

      {loading ? (
        <div className="workspace-empty">Loading patients…</div>
      ) : error && !selected && !tryMode ? (
        <div className="workspace-empty">
          <p className="form-error">{error}</p>
          <p className="empty-hint">
            Ensure the Supabase migration has been applied and env vars are set.
          </p>
        </div>
      ) : tryMode?.kind === "new" && dryRunPatient ? (
        <PatientWorkspace
          key="dry-run-new"
          patient={dryRunPatient}
          variant="dry-run"
          onDryRunSaved={() => void loadDryRuns()}
        />
      ) : activeDryRun && dryRunPatient ? (
        <PatientWorkspace
          key={activeDryRun.id}
          patient={dryRunPatient}
          variant="dry-run"
          readOnly
          initialConsultation={activeDryRun}
        />
      ) : selected ? (
        <PatientWorkspace
          key={selected.id}
          patient={selected}
          onPatientUpdated={(patient) => {
            setPatients((prev) =>
              prev.map((item) => (item.id === patient.id ? patient : item)),
            );
          }}
          onPatientArchived={(patientId) => {
            setPatients((prev) => prev.filter((item) => item.id !== patientId));
            setSelectedId(null);
          }}
        />
      ) : (
        <div className="workspace-empty">
          <div>
            <h2 style={{ marginBottom: "0.4rem" }}>Select a patient</h2>
            <p className="empty-hint">
              Search the sidebar, start a dry run, or create a new patient.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
