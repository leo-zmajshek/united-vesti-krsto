import { createServerFn } from "@tanstack/react-start";
import { getSnapshotData, answerQuestion } from "./manutd.server";

export const getSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  return getSnapshotData();
});

export const askUnited = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string; history: { role: string; content: string }[] }) => {
    const question = String(input?.question ?? "").slice(0, 500).trim();
    if (!question) throw new Error("Прашањето е празно");
    const history = Array.isArray(input?.history)
      ? input.history
          .slice(-8)
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }))
      : [];
    return { question, history };
  })
  .handler(async ({ data }) => {
    try {
      const answer = await answerQuestion(data.question, data.history);
      return { answer, error: null as string | null };
    } catch (err) {
      console.error("[manutd] ask failed", err);
      const rate = err instanceof Error && err.message === "rate_limited";
      return {
        answer: "",
        error: rate
          ? "Премногу прашања одеднаш. Пробајте повторно за една минута."
          : "Не успеав да одговорам. Пробајте повторно.",
      };
    }
  });
