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
    normalizedValue.startsWith("language mismatch") ||
    normalizedValue.includes("selected language does not match") ||
    normalizedValue.includes("code does not match selected language") ||
    normalizedValue.includes("this code belongs to another language") ||
    normalizedValue.includes("please select the correct language")
  );
};

const LANGUAGE_PATTERNS = {
  javascript: [/\b(const|let|var|function|console\.log|=>)\b/, /;\s*$/m],
  typescript: [/\b(interface|type|implements|enum)\b/, /:\s*[A-Z][A-Za-z<>|[\]]*/],
  python: [/\bdef\s+\w+\s*\(|\bimport\s+\w+/, /:\s*$/m],
  java: [/\bpublic\s+class\b|\bSystem\.out\.println\b/, /\bpublic\s+static\s+void\s+main\b/],
  cpp: [/#include\s*<\w+>/, /\bstd::|\bcout\s*<</],
  csharp: [/\busing\s+System\b|\bConsole\.WriteLine\b/, /\bnamespace\b/],
  go: [/\bpackage\s+main\b|\bfunc\s+main\s*\(/, /\bfmt\./],
  rust: [/\bfn\s+main\s*\(/, /\blet\s+mut\b|\bprintln!\s*\(/],
  php: [/<\?php/, /\becho\b|\$\w+/],
  dart: [/\bvoid\s+main\s*\(/, /\bfinal\b|\bString\b/],
  flutter: [/import\s+'package:flutter\//, /\bWidget\b|\bScaffold\b|\bMaterialApp\b/],
  ruby: [/\bdef\s+\w+/, /\bputs\b|\bend\b/],
  kotlin: [/\bfun\s+main\s*\(/, /\bval\b|\bvar\b/],
  swift: [/\bimport\s+SwiftUI\b|\bimport\s+Foundation\b/, /\bfunc\b|\blet\b|\bvar\b/],
  sql: [/\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/i, /\bfrom\b|\bwhere\b/i],
  bash: [/^#!\/bin\/(ba)?sh/m, /\becho\b|\bfi\b|\bthen\b/],
  "node.js": [/\brequire\s*\(|\bmodule\.exports\b/, /\bexpress\s*\(|\bprocess\./],
  "express.js": [/\bexpress\s*\(/, /\bapp\.(get|post|put|delete|use)\s*\(/],
  mongodb: [/\bdb\.\w+\.(find|insertOne|updateOne|aggregate)\b/, /\{\s*["']?\$\w+/],
  html: [/<[a-z][\s\S]*>/i, /<\/[a-z]+>/i],
  css: [/[.#]?[a-z0-9_-]+\s*\{[^}]*\}/i, /:\s*[^;]+;/],
  json: [/^\s*[\[{]/, /"\s*:\s*/],
};

const matchesSelectedLanguage = (language, code) => {
  const patterns = LANGUAGE_PATTERNS[language];

  if (!patterns?.length) {
    return false;
  }

  return patterns.some((pattern) => pattern.test(code));
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
  "languageMatch": boolean,
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
- set languageMatch to true only if the code genuinely matches ${normalizedLanguage}
- for a language mismatch, set languageMatch to false, return a low score, put the mismatch in issues, and tell the user to select the correct language
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

    const languageMatch = parsedResult?.languageMatch;
    const explicitMismatch = languageMatch === false;
    const fallbackMismatch =
      languageMatch === undefined &&
      (parsedResult?.issues || []).some((issue) =>
        isMismatchText(issue?.title || "")
      );

    const heuristicMatch = matchesSelectedLanguage(
      normalizedLanguage,
      normalizedCode
    );

    if ((explicitMismatch || fallbackMismatch) && !heuristicMatch) {
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
