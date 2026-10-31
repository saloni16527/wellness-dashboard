import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

    const request = {
      model: "gemini-3.8-flash",
      contents,
      config: {
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
      },
    };


    let response;

for (let attempt = 0; attempt < 3; attempt++) {
  try {
    response = await ai.models.generateContent(request);
    break;
  } catch (error) {
    const status = Number(
      error?.status ?? error?.code ?? error?.error?.code
    );

    const retryable =
      [429, 500, 502, 503, 504].includes(status) ||
      /overloaded|high demand|temporarily unavailable/i.test(
        error?.message || ""
      );

    if (!retryable || attempt === 2) {
      throw error;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 1000 * (2 ** attempt))
    );
  }
}

    return res.status(200).json({
      answer: response.text || "Please try asking again.",
    });

  } catch (error) {
    console.error("Habify AI error:", error);

    return res.status(500).json({
      error: "Unable to answer right now. Please try again.",
    });
  }
}