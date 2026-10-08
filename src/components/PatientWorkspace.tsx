"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import NewPatientModal from "./NewPatientModal";
import {
  consultationHistoryParts,
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
  patient?: Patient | null;
  variant?: "patient" | "dry-run";
  readOnly?: boolean;
  initialConsultation?: Consultation | null;
  onDryRunSaved?: () => void;
  onPatientUpdated?: (patient: Patient) => void;
  onPatientArchived?: (patientId: string) => void;
};

const MAX_SYMPTOMS = 10;
const HISTORY_PAGE = 5;

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

export default function PatientWorkspace({
  patient = null,
  variant = "patient",
  readOnly = false,
  initialConsultation = null,
  onDryRunSaved,
  onPatientUpdated,
  onPatientArchived,
}: Props) {
  const isDryRun = variant === "dry-run";
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>(() => {
    if (!initialConsultation) return [emptySymptom()];
    const parsed = initialConsultation.symptoms.map(parseSymptom);
    return parsed.length > 0 ? parsed : [emptySymptom()];
  });
  const [doctorNotes, setDoctorNotes] = useState(
    initialConsultation?.doctor_notes ?? "",
  );
  const [analysis, setAnalysis] = useState(
    initialConsultation?.remedy_analysis ?? "",
  );
  const [suggestedTags, setSuggestedTags] = useState<string[]>(
    initialConsultation?.tags ?? [],
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialConsultation?.tags ?? [],
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [remedies, setRemedies] = useState<PrescribedRemedy[]>([emptyRemedy()]);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE);
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(isDryRun);
  const [editOpen, setEditOpen] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!patient) return;
    const supabase = createClient();
    const { data, count, error: loadError } = await supabase
      .from("consultations")
      .select(
        "id, patient_id, symptoms, doctor_notes, remedy_analysis, prescribed_remedies, tags, created_at, updated_at",
        { count: "exact" },
      )
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(visibleCount);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setHistory((data ?? []) as Consultation[]);
    setHistoryTotal(count ?? data?.length ?? 0);
  }, [patient, visibleCount]);

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
    setFormOpen(true);
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
    setFormOpen(true);
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
          patientName: patient?.full_name || "Dry run",
          age: patient?.age,
          gender: patient?.gender,
          constitutionalNotes: patient?.constitutional_notes,
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

      const tags = parseSuggestedTags(text);
      if (isDryRun && !readOnly) {
        if (!patient) {
          throw new Error("Dry run patient is not ready yet.");
        }
        setSelectedTags(tags);
        const supabase = createClient();
        const { error: saveError } = await supabase.from("consultations").insert({
          patient_id: patient.id,
          symptoms: filled.map(formatSymptom),
          doctor_notes: doctorNotes.trim() || null,
          remedy_analysis: text,
          prescribed_remedies: [],
          tags,
        });
        if (saveError) {
          throw new Error(saveError.message);
        }
        onDryRunSaved?.();
        setStatus("Dry run saved. It is listed under Dry runs.");
      } else {
        setStatus("Analysis complete. Select tags, then review and finalize remedies.");
      }
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
    if (!patient) return;
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

  const showForm = isDryRun || formOpen;

  return (
    <section className="workspace">
      {patient && !isDryRun && (
        <header className="workspace-header">
          <div>
            <div className="patient-title">
              <h2>{patient.full_name}</h2>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Edit ${patient.full_name}`}
                onClick={() => setEditOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5zm15.7-9.2a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0l-1.3 1.3 3.5 3.5 1.3-1.3z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
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
      )}

      {!isDryRun && (
      <div className="panel history-split">
        <button
          type="button"
          className="new-consultation-btn"
          onClick={startNewConsultation}
        >
          New consultation
        </button>
        <div className="history-column">
          <h3>Past consultations</h3>
          <ul className="history-window">
            {history.map((consultation) => {
              const parts = consultationHistoryParts(consultation);
              return (
                <li key={consultation.id}>
                  <button
                    type="button"
                    className={`history-item${
                      consultation.id === activeConsultationId ? " active" : ""
                    }`}
                    onClick={() => openConsultation(consultation)}
                  >
                    {parts.lead && <span>{parts.lead}</span>}
                    {parts.tags.length > 0 && (
                      <span className="history-tags">{parts.tags.join(", ")}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {Array.from({
              length: Math.max(0, HISTORY_PAGE - history.length),
            }).map((_, index) => (
              <li key={`blank-${index}`} className="history-slot" aria-hidden="true" />
            ))}
          </ul>
          {historyTotal > history.length && (
            <button
              type="button"
              className="history-more"
              onClick={() => setVisibleCount((count) => count + HISTORY_PAGE)}
            >
              Load more
            </button>
          )}
        </div>
      </div>
      )}

      {showForm && (
      <>
      <div className="panel">
        <h3>
          {isDryRun
            ? readOnly
              ? "Dry run"
              : "Try a consultation"
            : activeConsultationId
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
                {!readOnly && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeSymptom(index)}
                >
                  Remove
                </button>
                )}
              </div>
              <div className="fields-4">
                <label>
                  Location <span className="required-mark">*</span>
                  <input
                    required
                    disabled={readOnly}
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
                    disabled={readOnly}
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
                    disabled={readOnly}
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
                    disabled={readOnly}
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

        {!readOnly && (
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
        )}

        <label style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
          Doctor notes
          <textarea
            disabled={readOnly}
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Case history, observations, differentials…"
          />
        </label>

        {!readOnly && (
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
        )}
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
            <p className="empty-hint">
              {isDryRun
                ? "Tags saved with this dry run."
                : "Select tags to save with this consultation."}
            </p>
            <div className="tag-list">
              {suggestedTags.map((tag) =>
                readOnly || isDryRun ? (
                  <span
                    key={tag}
                    className={`tag-chip${selectedTags.includes(tag) ? " selected" : ""}`}
                  >
                    {tag}
                  </span>
                ) : (
                <button
                  key={tag}
                  type="button"
                  className={`tag-chip${selectedTags.includes(tag) ? " selected" : ""}`}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.includes(tag)}
                >
                  {tag}
                </button>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {!isDryRun && (
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
      )}

      {isDryRun && (error || status) && (
        <div className="panel">
          {error && <p className="form-error">{error}</p>}
          {status && <p className="form-success">{status}</p>}
        </div>
      )}
      </>
      )}

      {patient && !isDryRun && (
        <NewPatientModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          doctorId={patient.doctor_id}
          patient={patient}
          onCreated={() => undefined}
          onUpdated={onPatientUpdated}
          onArchived={onPatientArchived}
        />
      )}

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
