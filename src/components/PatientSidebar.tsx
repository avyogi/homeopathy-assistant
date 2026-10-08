"use client";

import { useMemo, useState } from "react";
import {
  consultationHistoryParts,
  type Consultation,
  type Patient,
} from "@/lib/types";
import NewPatientModal from "./NewPatientModal";

type Props = {
  doctorId: string;
  patients: Patient[];
  dryRuns: Consultation[];
  selectedId: string | null;
  activeDryRunId: string | null;
  onSelect: (id: string) => void;
  onTryNow: () => void;
  onOpenDryRun: (id: string) => void;
  onCreated: (patient: Patient) => void;
  onSignOut: () => void;
};

export default function PatientSidebar({
  doctorId,
  patients,
  dryRuns,
  selectedId,
  activeDryRunId,
  onSelect,
  onTryNow,
  onOpenDryRun,
  onCreated,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const visiblePatients = useMemo(() => {
    const newest = [...patients].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const q = query.trim().toLowerCase();
    const matched = q
      ? newest.filter(
          (patient) =>
            patient.full_name.toLowerCase().includes(q) ||
            (patient.contact_phone || "").includes(q),
        )
      : newest;
    return matched.slice(0, 5);
  }, [patients, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="Remedia" className="brand-logo" />
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <section className="sidebar-block">
        <button type="button" className="try-now-btn" onClick={onTryNow}>
          Try Now!
        </button>
      </section>

      <section className="sidebar-block">
        <div className="sidebar-actions">
          <input
            type="search"
            placeholder="Search patients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search patients"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => setModalOpen(true)}
          >
            + New Patient
          </button>
        </div>

        <ul className="patient-list">
          {visiblePatients.length === 0 && (
            <li className="empty-hint">No patients found.</li>
          )}
          {visiblePatients.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                className={`patient-item${selectedId === patient.id ? " active" : ""}`}
                onClick={() => onSelect(patient.id)}
              >
                <strong>{patient.full_name}</strong>
                <span>
                  {[
                    patient.age != null ? `${patient.age}y` : null,
                    patient.gender && patient.gender !== "unspecified"
                      ? patient.gender
                      : null,
                    patient.contact_phone,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No details yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sidebar-block">
        <h2 className="sidebar-label">Dry runs</h2>
        <ul className="patient-list">
          {dryRuns.length === 0 && (
            <li className="empty-hint">No dry runs yet.</li>
          )}
          {dryRuns.map((run) => {
            const parts = consultationHistoryParts(run);
            return (
              <li key={run.id}>
                <button
                  type="button"
                  className={`patient-item${activeDryRunId === run.id ? " active" : ""}`}
                  onClick={() => onOpenDryRun(run.id)}
                >
                  <strong>{parts.lead || "Dry run"}</strong>
                  {parts.tags.length > 0 && (
                    <span className="history-tags">{parts.tags.join(", ")}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <NewPatientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        doctorId={doctorId}
        onCreated={onCreated}
      />
    </aside>
  );
}
