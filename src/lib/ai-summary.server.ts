import { createServerFn } from "@tanstack/react-start";

const AI_API_URL = "https://api.xkiro.com/v1/chat/completions";
const AI_API_KEY = "sk-xt-3671790980fe59eeda06aeddcc873314142a767821eb8ed3";

export const generateAiSummary = createServerFn({ method: "POST" })
  .validator(
    (data: {
      model: string;
      messages: { role: string; content: string }[];
    }) => data
  )
  .handler(async ({ data }) => {
    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: data.model,
        messages: data.messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", response.status, errText);
      throw new Error(`AI API returned ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    return { content };
  });
