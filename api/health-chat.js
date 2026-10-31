import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Gemini API key is not configured.",
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide a message.",
      });
    }

    const validMessages = messages.slice(-12);

    const contents = validMessages.map((message) => {
      if (
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 2000
      ) {
        throw new Error("Invalid message format.");
      }

      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      };
    });

    if (contents[contents.length - 1].role !== "user") {
      return res.status(400).json({
        error: "The latest message must be from the user.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const config = {
      systemInstruction: `
        You are Habify AI, a friendly wellness information assistant.

        Help users understand:
        - Sleep and hydration
        - Nutrition and healthy eating
        - Exercise and physical activity
        - BMI and healthy habits
        - General wellness questions

        Rules:
        - Use simple, supportive language.
        - Never claim to be a real doctor.
        - Never diagnose medical conditions.
        - Never prescribe medicines.
        - Do not recommend changing prescribed medication.
        - Explain that BMI is a screening measure, not a diagnosis.
        - Encourage professional medical advice for personal concerns.
        - For emergencies, advise immediate medical attention.
      `,
      temperature: 0.5,
      maxOutputTokens: 500,
    };

    const models = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
];

let response;
let lastError;

for (const model of models) {
  try {
    response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    if (response.text) {
      return res.status(200).json({
        answer: response.text,
      });
    }
  } catch (error) {
    lastError = error;

    console.error(`Gemini model ${model} failed:`, error);

    const status = Number(
      error?.status ??
      error?.code ??
      error?.error?.code ??
      error?.cause?.status
    );

    // Try the fallback only for temporary service errors.
    if (![429, 500, 502, 503, 504].includes(status)) {
      throw error;
    }
  }
}

throw lastError || new Error("No Gemini model returned a response.");

  } catch (error) {
    console.error("Habify AI error:", error);

    const status = Number(
      error?.status ??
      error?.code ??
      error?.error?.code ??
      error?.cause?.status
    );

    if ([429, 503, 504].includes(status)) {
      return res.status(503).json({
        error: "Habify AI is temporarily busy. Please try again shortly.",
      });
    }

    return res.status(500).json({
      error: "Unable to answer right now. Please try again.",
    });
  }
}