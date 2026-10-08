"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Gender, Patient } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  patient?: Patient | null;
  onCreated: (patient: Patient) => void;
  onUpdated?: (patient: Patient) => void;
  onArchived?: (patientId: string) => void;
};

export default function NewPatientModal({
  open,
  onClose,
  doctorId,
  patient = null,
  onCreated,
  onUpdated,
  onArchived,
}: Props) {
  const editing = Boolean(patient);
  const [fullName, setFullName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [constitutionalNotes, setConstitutionalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(patient?.full_name ?? "");
    setContactPhone(patient?.contact_phone ?? "");
    setAge(patient?.age != null ? String(patient.age) : "");
    setGender(patient?.gender ?? "unspecified");
    setConstitutionalNotes(patient?.constitutional_notes ?? "");
    setError(null);
  }, [open, patient]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const payload = {
      full_name: fullName.trim(),
      contact_phone: contactPhone.trim() || null,
      age: age ? Number(age) : null,
      gender,
      constitutional_notes: constitutionalNotes.trim() || null,
    };

    const query = editing
      ? supabase.from("patients").update(payload).eq("id", patient!.id).select("*").single()
      : supabase
          .from("patients")
          .insert({ ...payload, doctor_id: doctorId })
          .select("*")
          .single();

    const { data, error: saveError } = await query;
    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (editing) {
      onUpdated?.(data as Patient);
    } else {
      onCreated(data as Patient);
    }
    onClose();
  }

  async function archivePatient() {
    if (!patient) return;
    const confirmed = window.confirm(
      `Archive ${patient.full_name}? They will be hidden from the patient list.`,
    );
    if (!confirmed) return;

    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: archiveError } = await supabase
      .from("patients")
      .update({ status: "ARCHIVED" })
      .eq("id", patient.id);

    setLoading(false);
    if (archiveError) {
      setError(archiveError.message);
      return;
    }

    onArchived?.(patient.id);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="patient-modal-title">{editing ? "Edit Patient" : "New Patient"}</h3>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label>
            Contact phone
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </label>
          <div className="fields-4">
            <label>
              Age
              <input
                type="number"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </label>
            <label>
              Sex
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                <option value="unspecified">Unspecified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label>
            Constitutional notes
            <textarea
              value={constitutionalNotes}
              onChange={(e) => setConstitutionalNotes(e.target.value)}
              placeholder="Temperament, thermal modalities, chronic tendencies…"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            {editing && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Archive patient"
                onClick={() => void archivePatient()}
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM6 9h2v8H6V9zm-1 11h14v2H5v-2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : editing ? "Save changes" : "Create patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
