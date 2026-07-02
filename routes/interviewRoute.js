import express from "express";
import { upload } from "../utils/multer.js";
import {
  analyzeResume,
  finalReport,
  generateQuestion,
  getInterviewReport,
  getMyInterviews,
  submitAnswer
} from "../controller/interviewController.js";

import { isAuthenticated } from "../middleWare/authMiddleWare.js";

const interviewRouter = express.Router();

interviewRouter.post('/resume',isAuthenticated,upload.single("resume"),analyzeResume)
interviewRouter.post("/generate-questions",isAuthenticated,generateQuestion)
interviewRouter.post("/submit-answer",isAuthenticated,submitAnswer)
interviewRouter.post("/finish",isAuthenticated,finalReport)
interviewRouter.get("/get-interview", isAuthenticated,getMyInterviews)
interviewRouter.get("/report/:id",isAuthenticated,getInterviewReport)



export default interviewRouter;