"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Gender, Patient } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  onCreated: (patient: Patient) => void;
};

export default function NewPatientModal({
  open,
  onClose,
  doctorId,
  onCreated,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [constitutionalNotes, setConstitutionalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("patients")
      .insert({
        doctor_id: doctorId,
        full_name: fullName.trim(),
        contact_phone: contactPhone.trim() || null,
        age: age ? Number(age) : null,
        gender,
        constitutional_notes: constitutionalNotes.trim() || null,
      })
      .select("*")
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onCreated(data as Patient);
    setFullName("");
    setContactPhone("");
    setAge("");
    setGender("unspecified");
    setConstitutionalNotes("");
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-patient-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="new-patient-title">New Patient</h3>
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
              Gender
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
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Create patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
