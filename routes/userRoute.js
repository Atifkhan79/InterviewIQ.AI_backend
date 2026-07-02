import express from "express";
import { upload } from "../utils/multer.js";
import {
  register,
  login,
  getUser,
  logOut,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateProfile,
  googleAuth,
  getCurrentUser
} from "../controller/userController.js";

import { isAuthenticated } from "../middleWare/authMiddleWare.js";

const userRouter = express.Router();

// Auth
userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.post("/google",googleAuth);

userRouter.get("/current-user", isAuthenticated, getCurrentUser);

// Profile
userRouter.get("/me", isAuthenticated, getUser);
userRouter.put("/update-profile", isAuthenticated, upload.single("avatar"), updateProfile);

// Password
userRouter.put("/password/update", isAuthenticated, updatePassword);
userRouter.post("/password/forgot", forgotPassword);
userRouter.put("/password/reset/:token", resetPassword);


// Logout
userRouter.post("/logout", isAuthenticated, logOut);

export default userRouter;