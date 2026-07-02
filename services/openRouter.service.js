import axios from "axios";

export const askAi = async (messages) => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array is empty");
    }

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4.1-mini",
        messages,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = res?.data?.choices?.[0]?.message?.content;

    if (!content?.trim()) {
      throw new Error("AI returned empty response");
    }

    return content;
  } catch (error) {
    console.error(
      "OpenRouter Error:",
      error.response?.data || error.message
    );
    throw new Error("OpenRouter API Error");
  }
};