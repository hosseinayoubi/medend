import type { LlmProvider } from "./provider";

export const mockProvider: LlmProvider = {
  async respond({ mode, message }) {
    if (mode === "recipe") {
      return {
        mode,
        answer:
          `**Recipe mode (mock)**\n\nGive me your goals (cutting/bulking/maintenance) + any allergies.\n\nBased on: "${message}"\n\n1) High-protein bowl\n2) Veggie-friendly stir-fry\n3) Low-calorie soup\n\n(When you wire the real LLM, this becomes detailed recipes + macros.)`,
      };
    }
    
if (mode === "dental") {
  return {
    mode,
    answer:
      `**Dental mode (mock)**\n\nTo help narrow it down (non-diagnostic):\n1) Where is the pain (tooth/gum/jaw)?\n2) How long has it been?\n3) Is there swelling, fever, bad taste/pus, or trouble opening mouth?\n4) Hot/cold sensitivity? Biting pain?\n\n**Red flags:** facial swelling spreading, fever, trouble breathing/swallowing → urgent care.`,
    disclaimer: "Not a diagnosis. If severe or worsening, see a dentist/urgent care.",
  };
}
    
    if (mode === "therapy") {
      return {
        mode,
        answer:
          `**Therapy mode (mock)**\n\nI hear you. When you say: "${message}", what feelings show up first—anxiety, sadness, anger, or something else?\n\nAlso: what would “a tiny win” look like in the next 24 hours?`,
        disclaimer: "Not a substitute for professional mental health care.",
      };
    }

    return {
      mode,
      answer:
        `**Medical mode (mock)**\n\nThanks. To help narrow it down:\n1) What are your main symptoms?\n2) How long has it been going on?\n3) Any fever, chest pain, shortness of breath, or severe worsening?`,
      disclaimer: "This is not medical advice and does not replace a doctor.",
    };
  },
};
