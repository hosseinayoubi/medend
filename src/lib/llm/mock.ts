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
