import jwt from "jsonwebtoken";
import { User } from "../models/usermodel.js";
import {AsyncHandler} from "./asynchandler.js";
import ErrorHandler from "../middleware/errorhandler.js";

export const isAuthenticated = AsyncHandler(async (req, res, next) => {
  let token;

  // from cookie OR header
  if (req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("Login required", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  req.user = user;

  next();
});