export type IntakeFieldType = "text" | "number" | "select" | "textarea" | "scale" | "multi";

export type IntakeQuestion =
  | { id: string; label: string; type: "text" | "number" | "textarea"; placeholder?: string; required?: boolean }
  | { id: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean }
  | { id: string; label: string; type: "scale"; min: number; max: number; step?: number; required?: boolean }
  | { id: string; label: string; type: "multi"; options: { value: string; label: string }[]; required?: boolean };

export const intakeQuestions: IntakeQuestion[] = [
  { id: "age", label: "Age", type: "number", required: true },
  { id: "gender", label: "Gender", type: "select", required: true, options: [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
    { value: "na", label: "Prefer not to say" },
  ]},
  { id: "country", label: "Country / location (optional)", type: "text" },
  { id: "pregnancy_status", label: "Pregnant? (if applicable)", type: "select", options: [
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
    { value: "unknown", label: "Not sure" },
    { value: "na", label: "Not applicable" },
  ]},
  { id: "pregnancy_week", label: "Pregnancy week (if yes)", type: "number" },

  { id: "allergies", label: "Allergies (include reaction if known)", type: "textarea" },
  { id: "current_medications", label: "Current medications (include dose if known)", type: "textarea" },
  { id: "previous_illnesses", label: "Medical history (chronic conditions)", type: "textarea" },
  { id: "previous_surgeries", label: "Past surgeries", type: "textarea" },

  { id: "height_cm", label: "Height (cm) (optional)", type: "number" },
  { id: "weight_kg", label: "Weight (kg) (optional)", type: "number" },

  { id: "chief_complaint", label: "Main concern / chief complaint", type: "textarea", required: true, placeholder: "e.g., sore throat and fever" },
  { id: "symptom_onset", label: "When did it start?", type: "text", required: true, placeholder: "e.g., 2 days ago" },
  { id: "symptom_severity", label: "Severity (0–10)", type: "scale", min: 0, max: 10, step: 1, required: true },

  { id: "associated_symptoms", label: "Associated symptoms", type: "multi", options: [
    { value: "fever", label: "Fever" },
    { value: "chest_pain", label: "Chest pain" },
    { value: "sob", label: "Shortness of breath" },
    { value: "vomiting", label: "Vomiting" },
    { value: "diarrhea", label: "Diarrhea" },
    { value: "headache", label: "Headache" },
    { value: "dizziness", label: "Dizziness" },
    { value: "rash", label: "Rash" },
    { value: "urinary", label: "Urinary symptoms" },
  ]},

  { id: "red_flags", label: "Any red flags right now?", type: "multi", options: [
    { value: "severe_sob", label: "Severe trouble breathing" },
    { value: "severe_chest_pain", label: "Severe chest pain" },
    { value: "fainting", label: "Fainting" },
    { value: "confusion", label: "New confusion" },
    { value: "one_sided_weakness", label: "One-sided weakness" },
    { value: "severe_bleeding", label: "Severe bleeding" },
  ]},
];
