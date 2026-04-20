import OpenAI from "openai";
import History from "../models/history.js";
import User from "../models/user.js";

const SUPPORTED_LANGUAGES = [
  "javascript",
  "python",
  "cpp",
  "java",
  "csharp",
  "typescript",
  "go",
  "rust",
  "php",
  "flutter",
  "dart",
  "ruby",
  "kotlin",
  "swift",
  "sql",
  "bash",
  "node.js",
  "express.js",
  "mongodb",
  "html",
  "css",
  "json",
];

const isMismatchText = (value = "") => {
  const normalizedValue = value.toLowerCase();

  return (
    normalizedValue.includes("language mismatch") ||
    normalizedValue.includes("wrong language") ||
    normalizedValue.includes("different language") ||
    normalizedValue.includes("select the correct language") ||
    normalizedValue.includes("not valid") && normalizedValue.includes("language")
  );
};

const hasLanguageMismatch = (parsedResult) => {
  return (parsedResult?.issues || []).some((issue) =>
    isMismatchText(issue?.title || "")
  );
};

const buildTitle = (language, code, parsedResult) => {
  const firstLine = code
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (parsedResult?.issues?.[0]?.title && !isMismatchText(parsedResult.issues[0].title)) {
    return parsedResult.issues[0].title.slice(0, 60);
  }

  if (firstLine) {
    return `${language}: ${firstLine}`.slice(0, 60);
  }

  return `${language} review`;
};

export const reviewCode = async (req, res) => {
  try {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const { code, language } = req.body;
    const normalizedCode = code?.trim();
    const normalizedLanguage = language?.trim()?.toLowerCase();

    if (!normalizedCode) {
      return res.status(400).json({ message: "Code is required" });
    }

    if (!normalizedLanguage || !SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
      return res.status(400).json({ message: "Selected language is not supported" });
    }

    const existingHistory = await History.findOne({
      userId: req.user._id,
      language: normalizedLanguage,
      code: normalizedCode,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    if (existingHistory) {
      return res.json({
        result: existingHistory.aiResponse,
        history: existingHistory,
        duplicate: true,
      });
    }

    const prompt = `
Return ONLY valid JSON. No explanation. No markdown. No extra text.

Follow EXACT format:

{
  "score": number,
  "issues": [
    {
      "title": "string",
      "severity": "low|medium|high"
    }
  ],
  "suggestions": [
    {
      "title": "string"
    }
  ]
}

Rules:
- review the code ONLY as ${normalizedLanguage} code
- if the code clearly belongs to another language, do not review it as valid ${normalizedLanguage}
- for a language mismatch, return a low score, put the mismatch in issues, and tell the user to select the correct language
- score must be out of 10
- issues must describe real code problems
- severity must be only: low, medium, high
- suggestions must be actionable improvements
- return ONLY JSON (no text before or after)

Code:
${normalizedCode}
`;

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are a senior software engineer." },
        { role: "user", content: prompt },
      ],
    });

    const result = response.choices[0].message.content;
    let parsedResult;

    try {
      parsedResult = JSON.parse(result);
    } catch (error) {
      console.error("AI PARSE ERROR:", error);
      return res.status(502).json({ message: "Invalid AI response" });
    }

    if (hasLanguageMismatch(parsedResult)) {
      return res.status(422).json({
        message: `Code does not match selected language: ${normalizedLanguage}`,
        result,
        review: {
          code: normalizedCode,
          language: normalizedLanguage,
          score: parsedResult.score ?? 0,
          issues: parsedResult.issues ?? [],
          suggestions: parsedResult.suggestions ?? [],
          aiResponse: result,
          title: `${normalizedLanguage} mismatch`,
        },
        mismatch: true,
      });
    }

    const historyEntry = await History.create({
      userId: req.user._id,
      code: normalizedCode,
      language: normalizedLanguage,
      score: parsedResult.score ?? 0,
      issues: parsedResult.issues ?? [],
      suggestions: parsedResult.suggestions ?? [],
      aiResponse: result,
      title: buildTitle(normalizedLanguage, normalizedCode, parsedResult),
    });

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalReviews: 1 },
      $set: { lastLogin: new Date() },
    });

    return res.json({
      result,
      history: historyEntry,
    });
  } catch (error) {
    console.error("AI ERROR:", error);
    return res.status(500).json({ message: "AI error" });
  }
};
