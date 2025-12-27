export type IntakeData = {
  basics?: { age?: number; sex?: "male" | "female" | "other"; heightCm?: number; weightKg?: number };
  complaint?: { title?: string; duration?: string; details?: string };
  conditions?: { conditions?: string[]; allergies?: string[]; meds?: string[] };
  lifestyle?: { sleepHours?: number; smoking?: "no" | "yes"; alcohol?: "no" | "yes"; exercise?: "no" | "yes" };
  meta?: { completed?: boolean; updatedAtClient?: string };
};
