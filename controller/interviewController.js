import fs from "fs";
import { errorMonitor } from "events";
import { nextTick } from "process";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PDFParser = require("pdf2json");
import { AsyncHandler } from "../middleware/asyncHandler.js";
import { askAi } from "../services/openRouter.service.js";
import ErrorHandler from "../middleware/errorHandler.js";
import { User } from "../models/userModel.js";
import Interview from "../models/interviewModel.js";








export const analyzeResume = AsyncHandler(async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorHandler("Resume Required", 400));
    }

    const filepath = req.file.path;

    const resumeText = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => {
        reject(new Error(errData.parserError));
      });

      pdfParser.on("pdfParser_dataReady", () => {
        const rawText = pdfParser.getRawTextContent();
        resolve(rawText.replace(/\s+/g, " ").trim());
      });

      pdfParser.loadPDF(filepath);
    });

    const messeges = [
      {
        role: "system",
        content: `
You are a resume parser.

Return ONLY valid JSON.
No markdown.
No explanation.
No backticks.

Format:
{
  "role": "",
  "experience": "",
  "projects": [],
  "skills": []
}
`,
      },
      {
        role: "user",
        content: resumeText,
      },
    ];

    const aiResponse = await askAi(messeges);

    const safeParseAI = (text) => {
      try {
        if (!text) throw new Error("Empty AI response");

        let cleaned = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace === -1) {
          throw new Error("No JSON found in AI response");
        }

        cleaned = cleaned.slice(firstBrace, lastBrace + 1);

        return JSON.parse(cleaned);
      } catch (err) {
        console.error("JSON Parse Failed:", err.message);
        console.log("Raw AI Output:", text);
        return null;
      }
    };

    const parsed = safeParseAI(aiResponse);

    fs.unlinkSync(filepath);

    if (!parsed) {
      return next(new ErrorHandler("Failed to parse AI response", 500));
    }

    res.json({
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      resumeText,
    });
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return next(new ErrorHandler(error.message || "Failed to analyze resume", 500));
  }
});


export const generateQuestion = AsyncHandler(async (req, res) => {
  try {
    let { role, experience, mode, resumwText, projects, skills } = req.body;

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return next(
        new ErrorHandler("Role , Experience and mode are required", 400),
      );
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ErrorHandler("User Not Found", 404));
    }

    if (user.credits < 50) {
      return next(
        new ErrorHandler("Not enough credits. Minimum 50 required", 400),
      );
    }

    const projectText =
      Array.isArray(projects) && projects.length ? projects.join(", ") : "None";

    const skillsText =
      Array.isArray(skills) && skills.length ? skills.join(", ") : "None";

    const safeResume = resumwText?.trim() || "None";

    const userPrompt = `
    Role :${role}
    Experience : ${experience}
    Interview Mode : ${mode}
    Projects:${projectText}
    Skills: ${skillsText}
    Resume: ${safeResume}
    `;

    if (!userPrompt.trim()) {
      return next(new ErrorHandler("Prompt content is empty", 404));
    }

    const messages = [
      {
        role: "system",
        content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:
- Each question must contain between 15 and 25 words.
- Each question must be a single complete sentence.
- Do NOT number them.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- One question per line only.
- Keep language simple and conversational.
- Questions must feel practical and realistic.

Difficulty progression:
Question 1 → easy  
Question 2 → easy  
Question 3 → medium  
Question 4 → medium  
Question 5 → hard  
`,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const aiResponse = await askAi(messages);

    // FIXED CONDITION
    if (!aiResponse || !aiResponse.trim()) {
      return next(new ErrorHandler("AI returned empty response", 500));
    }

    const questionArray = aiResponse
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, 5);

    if (questionArray.length === 0) {
      return next(new ErrorHandler("AI failed to generate Questions", 500));
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userid: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      questions: questionArray.map((q, index) => ({
        question: q,
        difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
        timeLimit: [60, 60, 90, 90, 120][index],
      })),
    });

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      questions: interview.questions,
    });

  } catch (error) {
    return res
      .status(500)
      .json({ message: `Failed to create interview ${error}` });
  }
});



export const submitAnswer = AsyncHandler(async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body;

    const interview = await Interview.findById(interviewId);
    const question = interview.questions[questionIndex];

    // if no answer
    if (!answer) {
      question.score = 0;
      question.feedback = "You did not submit an answer";
      question.answer = "";

      await interview.save();

      return res.json({
        feedback: question.feedback,
      });
    }

    // if time exceeded

    if (timeTaken > question.timeLimit) {
      question.score = 0;
      ((question.feedback = "Time limit exceeded, Answer not evaluated "),
        (question.answer = answer));

      await interview.save();

      return res.json({
        feedback: question.feedback,
      });
    }

    //** Submit Answer Prompt **

    const messages = [
      {
        role: "system",
        content: `
You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (0 to 10):

1. Confidence – Does the answer sound clear, confident, and well-presented?
2. Communication – Is the language simple, clear, and easy to understand?
3. Correctness – Is the answer accurate, relevant, and complete?

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write natural human feedback.
- 10 to 15 words only.
- Sound like real interview feedback.
- Can suggest improvement if needed.
- Do NOT repeat the question.
- Do NOT explain scoring.
- Keep tone professional and honest.

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}
`,
      },
      {
        role: "user",
        content: `
Question: ${question.question}
Answer: ${answer}
`,
      },
    ];

    const aiResponse = await askAi(messages);

    const parsed = JSON.parse(aiResponse);

    question.answer = answer;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.store = parsed.finalScore;
    question.feedback = parsed.feedback;

    await interview.save();

    return res.status(200).json({ feedback: parsed.feedback });
  } catch (error) {
    return res.status(500).json({ message: `Failed to submit answer${error}` });
  }
});



export const finalReport = AsyncHandler(async (req, res) => {
  try {
    const { interviewId } = req.body;

    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return next(new ErrorHandler("Failed to find Interview", 404));
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions ? totalScore / totalQuestions : 0;

    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;

    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;

    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    await interview.save();

    return res.status(200).json({
      finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),

      questionWiseScore: interview.questions.map((q) => ({
        question: q.question || "",
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
      })),
    });

  } catch (error) {
    return res.status(500).json({
      message: `Failed to Finish Interview ${error.message}`,
    });
  }
});



export const getMyInterviews = AsyncHandler(async (req, res) => {
  try {
    const interview = await Interview.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("role experience mode finalScore status createdAt");

    return res.status(200).json({
      interview,
    });

  } catch (error) {
    return res.status(500).json({
      message: `failed to find currentUser Interview ${error}`,
    });
  }
});


export const getInterviewReport = AsyncHandler(async (req, res) => {
  try {

    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      throw new ErrorHandler("Interview Not Found", 404)
    }

    const questions = interview.questions || []

    const totalQuestions = questions.length

    let totalConfidence = 0
    let totalCommunication = 0
    let totalCorrectness = 0

    questions.forEach((q) => {
      totalConfidence += q.confidence || 0
      totalCommunication += q.communication || 0
      totalCorrectness += q.correctness || 0
    })

    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0
    const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0
    const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0

    const finalScore =
      (avgConfidence + avgCommunication + avgCorrectness) / 3

    return res.status(200).json({
      finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: questions
    })

  } catch (error) {
    return res.status(500).json({
      message: `Failed to find currentUser Interview ${error.message}`
    })
  }
})