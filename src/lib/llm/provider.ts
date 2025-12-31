export type ChatMode = "medical" | "therapy" | "recipe" | "dental";

export type LlmResult = {
  mode: ChatMode;
  answer: string;
  disclaimer?: string;
};

export interface LlmProvider {
  respond(input: { mode: ChatMode; message: string; userId: string }): Promise<LlmResult>;
}
