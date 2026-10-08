"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import {
  consultationHistoryLabel,
  emptySymptom,
  formatSymptom,
  parseSuggestedTags,
  parseSymptom,
  type Consultation,
  type Patient,
  type PrescribedRemedy,
  type SymptomEntry,
} from "@/lib/types";

type Props = {
  patient: Patient;
};

const MAX_SYMPTOMS = 10;

const emptyRemedy = (): PrescribedRemedy => ({
  name: "",
  potency: "",
  system: "classical",
  notes: "",
});

function filledSymptoms(symptoms: SymptomEntry[]) {
  return symptoms.filter(
    (symptom) =>
      symptom.location.trim() ||
      symptom.sensation.trim() ||
      symptom.modality.trim() ||
      symptom.concomitant.trim(),
  );
}

function validateSymptoms(symptoms: SymptomEntry[]) {
  const filled = filledSymptoms(symptoms);
  if (filled.length === 0) {
    return "Add at least one symptom with Location and Sensation.";
  }
  if (filled.length > MAX_SYMPTOMS) {
    return `Maximum of ${MAX_SYMPTOMS} symptoms allowed.`;
  }
  const incomplete = filled.find(
    (symptom) => !symptom.location.trim() || !symptom.sensation.trim(),
  );
  if (incomplete) {
    return "Location and Sensation are required for each symptom.";
  }
  return null;
}

export default function PatientWorkspace({ patient }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([emptySymptom()]);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [remedies, setRemedies] = useState<PrescribedRemedy[]>([emptyRemedy()]);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase
      .from("consultations")
      .select(
        "id, patient_id, symptoms, doctor_notes, remedy_analysis, prescribed_remedies, tags, created_at, updated_at",
      )
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setHistory((data ?? []) as Consultation[]);
  }, [patient.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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

  function startNewConsultation() {
    setActiveConsultationId(null);
    setSymptoms([emptySymptom()]);
    setDoctorNotes("");
    setAnalysis("");
    setSuggestedTags([]);
    setSelectedTags([]);
    setRemedies([emptyRemedy()]);
    setStatus(null);
    setError(null);
    setConfirmSave(false);
  }

  function openConsultation(consultation: Consultation) {
    const parsed = consultation.symptoms.map(parseSymptom);
    setActiveConsultationId(consultation.id);
    setSymptoms(parsed.length > 0 ? parsed : [emptySymptom()]);
    setDoctorNotes(consultation.doctor_notes ?? "");
    const savedTags = consultation.tags ?? [];
    const fromAnalysis = parseSuggestedTags(consultation.remedy_analysis ?? "");
    setAnalysis(consultation.remedy_analysis ?? "");
    setSuggestedTags([...new Set([...savedTags, ...fromAnalysis])].slice(0, 4));
    setSelectedTags(savedTags);
    setRemedies(
      consultation.prescribed_remedies.length > 0
        ? consultation.prescribed_remedies
        : [emptyRemedy()],
    );
    setStatus(null);
    setError(null);
    setConfirmSave(false);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }

  async function runAnalysis() {
    setError(null);
    setStatus(null);

    const validationError = validateSymptoms(symptoms);
    if (validationError) {
      setError(validationError);
      return;
    }

    const filled = filledSymptoms(symptoms);
    setAnalyzing(true);
    setAnalysis("");
    setSuggestedTags([]);
    setSelectedTags([]);

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
        setSuggestedTags(parseSuggestedTags(text));
      }

      text += decoder.decode();
      setAnalysis(text);
      setSuggestedTags(parseSuggestedTags(text));

      if (!text.trim()) {
        throw new Error(
          "Analysis returned no content. Check the Gemini API key/model.",
        );
      }

      const errorMarker = text.indexOf("**Error:**");
      if (errorMarker !== -1) {
        throw new Error(text.slice(errorMarker).replace("**Error:**", "").trim());
      }

      setStatus("Analysis complete. Select tags, then review and finalize remedies.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function requestSave() {
    setError(null);
    setStatus(null);

    const validationError = validateSymptoms(symptoms);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!analysis.trim()) {
      setError("Run AI analysis before saving the consultation.");
      return;
    }

    const filledRemedies = remedies.filter((remedy) => remedy.name.trim());
    if (filledRemedies.length === 0) {
      setError("Add at least one finalized remedy and potency.");
      return;
    }

    if (activeConsultationId) {
      setConfirmSave(true);
      return;
    }

    void persistConsultation("insert");
  }

  async function persistConsultation(mode: "insert" | "update") {
    setConfirmSave(false);
    setSaving(true);
    setError(null);

    const payload = {
      patient_id: patient.id,
      symptoms: filledSymptoms(symptoms).map(formatSymptom),
      doctor_notes: doctorNotes.trim() || null,
      remedy_analysis: analysis,
      prescribed_remedies: remedies
        .filter((remedy) => remedy.name.trim())
        .map((remedy) => ({
          name: remedy.name.trim(),
          potency: remedy.potency.trim(),
          system: remedy.system,
          notes: remedy.notes?.trim() || undefined,
        })),
      tags: selectedTags,
    };

    const supabase = createClient();
    const query =
      mode === "update" && activeConsultationId
        ? supabase
            .from("consultations")
            .update(payload)
            .eq("id", activeConsultationId)
        : supabase.from("consultations").insert(payload);

    const { error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    if (mode === "insert") {
      startNewConsultation();
    }

    setStatus(
      mode === "update"
        ? "Consultation updated."
        : "Consultation saved to the patient record.",
    );
    await loadHistory();
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
        <div className="history-header">
          <h3>Past consultations</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={startNewConsultation}
          >
            New consultation
          </button>
        </div>
        {history.length === 0 ? (
          <p className="empty-hint">No past consultations yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((consultation) => (
              <li key={consultation.id}>
                <button
                  type="button"
                  className={`history-item${
                    consultation.id === activeConsultationId ? " active" : ""
                  }`}
                  onClick={() => openConsultation(consultation)}
                >
                  {consultationHistoryLabel(consultation)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h3>
          {activeConsultationId
            ? "Edit consultation — Structured Symptoms"
            : "Consultation — Structured Symptoms"}
        </h3>
        <p className="empty-hint" style={{ marginTop: "-0.4rem" }}>
          Maximum {MAX_SYMPTOMS} symptoms. Location and Sensation are required.
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
                  Location <span className="required-mark">*</span>
                  <input
                    required
                    value={symptom.location}
                    onChange={(e) =>
                      updateSymptom(index, "location", e.target.value)
                    }
                    placeholder="e.g. right temple"
                  />
                </label>
                <label>
                  Sensation <span className="required-mark">*</span>
                  <input
                    required
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
        {suggestedTags.length > 0 && (
          <div>
            <p className="empty-hint">Select tags to save with this consultation.</p>
            <div className="tag-list">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip${selectedTags.includes(tag) ? " selected" : ""}`}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.includes(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
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
                      ? [emptyRemedy()]
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
            onClick={() => setRemedies((prev) => [...prev, emptyRemedy()])}
          >
            Add remedy
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={requestSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Consultation"}
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        {status && <p className="form-success">{status}</p>}
      </div>

      {confirmSave && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="save-choice-title">
            <h3 id="save-choice-title">Save consultation</h3>
            <p>Overwrite this consultation, or save it as a new one?</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmSave(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void persistConsultation("insert")}
              >
                Save as new
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void persistConsultation("update")}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
