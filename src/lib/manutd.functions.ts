import { createServerFn } from "@tanstack/react-start";
import { getSnapshotData, answerQuestion, expandNewsArticle } from "./manutd.server";

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

export const expandNews = createServerFn({ method: "POST" })
  .inputValidator((input: { title: string; summary: string; source: string; link: string }) => ({
    title: String(input?.title ?? "").slice(0, 300),
    summary: String(input?.summary ?? "").slice(0, 600),
    source: String(input?.source ?? "").slice(0, 120),
    link: String(input?.link ?? "").slice(0, 500),
  }))
  .handler(async ({ data }) => {
    try {
      const article = await expandNewsArticle(data);
      return { article, error: null as string | null };
    } catch (err) {
      console.error("[manutd] expand failed", err);
      return { article: "", error: "Не успеав да ја отворам веста. Пробајте повторно." };
    }
  });

export const askAboutNews = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      question: string;
      article: string;
      title: string;
      history: { role: string; content: string }[];
    }) => {
      const question = String(input?.question ?? "").slice(0, 500).trim();
      if (!question) throw new Error("Прашањето е празно");
      return {
        question,
        article: String(input?.article ?? "").slice(0, 4000),
        title: String(input?.title ?? "").slice(0, 300),
        history: Array.isArray(input?.history)
          ? input.history.slice(-6).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: String(m.content).slice(0, 2000),
            }))
          : [],
      };
    },
  )
  .handler(async ({ data }) => {
    try {
      const answer = await answerQuestion(
        data.question,
        data.history,
        `Корисникот чита вест со наслов „${data.title}“. Текст на веста:\n${data.article}\nОдговарај првенствено за оваа вест.`,
      );
      return { answer, error: null as string | null };
    } catch (err) {
      console.error("[manutd] news ask failed", err);
      const rate = err instanceof Error && err.message === "rate_limited";
      return {
        answer: "",
        error: rate
          ? "Премногу прашања одеднаш. Пробајте повторно за една минута."
          : "Не успеав да одговорам. Пробајте повторно.",
      };
    }
  });
