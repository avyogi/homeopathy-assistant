"use client";

import { useMemo, useState } from "react";
import type { Patient } from "@/lib/types";
import NewPatientModal from "./NewPatientModal";

type Props = {
  doctorId: string;
  patients: Patient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (patient: Patient) => void;
  onSignOut: () => void;
};

export default function PatientSidebar({
  doctorId,
  patients,
  selectedId,
  onSelect,
  onCreated,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        (p.contact_phone || "").includes(q),
    );
  }, [patients, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="brand">Remedia</h1>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>

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
        {filtered.length === 0 && (
          <li className="empty-hint">No patients found.</li>
        )}
        {filtered.map((patient) => (
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

      <NewPatientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        doctorId={doctorId}
        onCreated={onCreated}
      />
    </aside>
  );
}
