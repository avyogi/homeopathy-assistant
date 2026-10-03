"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  emptySymptom,
  formatSymptom,
  type Patient,
  type PrescribedRemedy,
  type SymptomEntry,
} from "@/lib/types";

type Props = {
  patient: Patient;
};

const MAX_SYMPTOMS = 10;

export default function PatientWorkspace({ patient }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([emptySymptom()]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [remedies, setRemedies] = useState<PrescribedRemedy[]>([
    { name: "", potency: "", system: "classical", notes: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateSymptom(index: number, field: keyof SymptomEntry, value: string) {
    setSymptoms((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addSymptom() {
    if (symptoms.length >= MAX_SYMPTOMS) return;
    setSymptoms((prev) => [...prev, emptySymptom()]);
  }

  function removeSymptom(index: number) {
    setSymptoms((prev) =>
      prev.length === 1 ? [emptySymptom()] : prev.filter((_, i) => i !== index),
    );
  }

  function updateRemedy(
    index: number,
    field: keyof PrescribedRemedy,
    value: string,
  ) {
    setRemedies((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async function runAnalysis() {
    setError(null);
    setStatus(null);

    const filled = symptoms.filter(
      (s) =>
        s.location.trim() ||
        s.sensation.trim() ||
        s.modality.trim() ||
        s.concomitant.trim(),
    );

    if (filled.length === 0) {
      setError("Add at least one structured symptom before running analysis.");
      return;
    }

    if (filled.length > MAX_SYMPTOMS) {
      setError(`Maximum of ${MAX_SYMPTOMS} symptoms allowed.`);
      return;
    }

    setAnalyzing(true);
    setAnalysis("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patient.full_name,
          age: patient.age,
          gender: patient.gender,
          constitutionalNotes: patient.constitutional_notes,
          symptoms: filled,
          doctorNotes,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Analysis failed");
      }

      if (!response.body) {
        throw new Error("No stream returned from analysis API");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnalysis(text);
      }

      text += decoder.decode();
      setAnalysis(text);

      if (!text.trim()) {
        throw new Error(
          "Analysis returned no content. Check the Gemini API key/model.",
        );
      }

      const errorMarker = text.indexOf("**Error:**");
      if (errorMarker !== -1) {
        throw new Error(text.slice(errorMarker).replace("**Error:**", "").trim());
      }

      setStatus("Analysis complete. Review and finalize remedies below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveConsultation() {
    setError(null);
    setStatus(null);

    const filledSymptoms = symptoms.filter(
      (s) =>
        s.location.trim() ||
        s.sensation.trim() ||
        s.modality.trim() ||
        s.concomitant.trim(),
    );

    const filledRemedies = remedies.filter((r) => r.name.trim());

    if (filledSymptoms.length === 0) {
      setError("Cannot save without symptoms.");
      return;
    }

    if (!analysis.trim()) {
      setError("Run AI analysis before saving the consultation.");
      return;
    }

    if (filledRemedies.length === 0) {
      setError("Add at least one finalized remedy and potency.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: saveError } = await supabase.from("consultations").insert({
      patient_id: patient.id,
      symptoms: filledSymptoms.map(formatSymptom),
      doctor_notes: doctorNotes.trim() || null,
      remedy_analysis: analysis,
      prescribed_remedies: filledRemedies.map((r) => ({
        name: r.name.trim(),
        potency: r.potency.trim(),
        system: r.system,
        notes: r.notes?.trim() || undefined,
      })),
    });

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setStatus("Consultation saved to the patient record.");
  }

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <h2>{patient.full_name}</h2>
          <div className="meta-row">
            {patient.age != null && <span>Age {patient.age}</span>}
            {patient.gender && <span>{patient.gender}</span>}
            {patient.contact_phone && <span>{patient.contact_phone}</span>}
          </div>
          {patient.constitutional_notes && (
            <p className="empty-hint" style={{ marginTop: "0.6rem" }}>
              {patient.constitutional_notes}
            </p>
          )}
        </div>
      </header>

      <div className="panel">
        <h3>Consultation — Structured Symptoms</h3>
        <p className="empty-hint" style={{ marginTop: "-0.4rem" }}>
          Maximum {MAX_SYMPTOMS} symptoms. Capture Location, Sensation, Modality,
          and Concomitant for each.
        </p>

        <div className="symptom-grid">
          {symptoms.map((symptom, index) => (
            <div className="symptom-card" key={index}>
              <div className="symptom-card-header">
                <strong>Symptom {index + 1}</strong>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeSymptom(index)}
                >
                  Remove
                </button>
              </div>
              <div className="fields-4">
                <label>
                  Location
                  <input
                    value={symptom.location}
                    onChange={(e) =>
                      updateSymptom(index, "location", e.target.value)
                    }
                    placeholder="e.g. right temple"
                  />
                </label>
                <label>
                  Sensation
                  <input
                    value={symptom.sensation}
                    onChange={(e) =>
                      updateSymptom(index, "sensation", e.target.value)
                    }
                    placeholder="e.g. throbbing, burning"
                  />
                </label>
                <label>
                  Modality
                  <input
                    value={symptom.modality}
                    onChange={(e) =>
                      updateSymptom(index, "modality", e.target.value)
                    }
                    placeholder="worse/better from…"
                  />
                </label>
                <label>
                  Concomitant
                  <input
                    value={symptom.concomitant}
                    onChange={(e) =>
                      updateSymptom(index, "concomitant", e.target.value)
                    }
                    placeholder="accompanying symptoms"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={addSymptom}
            disabled={symptoms.length >= MAX_SYMPTOMS}
          >
            Add symptom ({symptoms.length}/{MAX_SYMPTOMS})
          </button>
        </div>

        <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
          Doctor notes
          <textarea
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Case history, observations, differentials…"
          />
        </label>

        <div className="row-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={runAnalysis}
            disabled={analyzing}
          >
            {analyzing ? "Running AI Analysis…" : "Run AI Analysis"}
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>AI Analysis</h3>
        {!analysis && !analyzing && (
          <p className="empty-hint">
            Streamed Classical & Electro-Homeopathy analysis will appear here.
          </p>
        )}
        {analyzing && !analysis && (
          <p className="empty-hint">Generating analysis…</p>
        )}
        {analysis && (
          <div className="analysis-stream">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Finalize Remedies</h3>
        <p className="empty-hint" style={{ marginTop: "-0.35rem" }}>
          Edit the suggested remedy name and potency before saving.
        </p>
        <div className="remedy-list">
          {remedies.map((remedy, index) => (
            <div className="remedy-row" key={index}>
              <label>
                Remedy
                <input
                  value={remedy.name}
                  onChange={(e) => updateRemedy(index, "name", e.target.value)}
                  placeholder="e.g. Arsenicum Album / Scrofoloso"
                />
              </label>
              <label>
                Potency / dilution
                <input
                  value={remedy.potency}
                  onChange={(e) =>
                    updateRemedy(index, "potency", e.target.value)
                  }
                  placeholder="30C / D3"
                />
              </label>
              <label>
                System
                <select
                  value={remedy.system}
                  onChange={(e) =>
                    updateRemedy(index, "system", e.target.value)
                  }
                >
                  <option value="classical">Classical</option>
                  <option value="electro-homeopathy">Electro-Homeopathy</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button
                type="button"
                className="btn-danger"
                onClick={() =>
                  setRemedies((prev) =>
                    prev.length === 1
                      ? [
                          {
                            name: "",
                            potency: "",
                            system: "classical",
                            notes: "",
                          },
                        ]
                      : prev.filter((_, i) => i !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="row-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setRemedies((prev) => [
                ...prev,
                { name: "", potency: "", system: "classical", notes: "" },
              ])
            }
          >
            Add remedy
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={saveConsultation}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Consultation"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        {status && <p className="form-success">{status}</p>}
      </div>
    </section>
  );
}
