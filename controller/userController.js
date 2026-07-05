
import {dbConnection} from '../dataBase/dbConnection.js'
import bcrypt from "bcrypt"
import  {sendToken}  from '../utils/sendToken.js'
import { generatePasswordResetToken } from "../utils/generatePasswordResetToken.js";
import  sendEmail  from '../utils/sendEmail.js'
import { generateEmailTemplate } from "../utils/emailTemplate.js";
import crypto from "crypto"


import ErrorHandler from '../middleware/errorHandler.js'
import {AsyncHandler} from "../middleware/asyncHandler.js"
import { User } from "../models/userModel.js";





// AUTHENTICATION FUNCTIONS
export const register = AsyncHandler(async (req, res, next) => {
  try {
    // Destructure the required fields from request body
    const { name, email, password} = req.body;

    // ------------------------
    // 1️⃣ Check for missing fields
    // ------------------------
    if (!name || !email || !password) {
      return next(new ErrorHandler("All Fields Are Required", 400));
    }

    // ------------------------
    // 2️⃣ Validate phone number format
    // Example: +923XXXXXXXXX (Pakistan mobile numbers)
    // -----------------------




    if (password.length < 8 || password.length > 16) {
            return next(new ErrorHandler("Password must be between 8 & 20 characters.",400))
        }

    // ------------------------
    // 3️⃣ Check if user with verified email or phone already exists
    // ------------------------
    const existingUser = await User.findOne({
      $or: [
        { email, accountVerified: true }
      ]
    });

    if (existingUser) {
      return next(new ErrorHandler("Email or Phone is already used.", 400));
    }

    // ------------------------
    // 4️⃣ Limit unverified registration attempts
    // ------------------------
    const registrationAttemptsByUser = await User.find({
      $or: [
        { email, accountVerified: false }
      ]
    });

    if (registrationAttemptsByUser.length > 3) {
      return next(new ErrorHandler(
        "You have exceeded the maximum number of attempts (3). Please try again after an hour.",
        400
      ));
    }

    // ------------------------
    // 5️⃣ Create new user
    // ------------------------
    const userData = { name, email, password, };
    const user = await User.create(userData);

   


     // Save user with the verification code and expiry
    await user.save();

    sendToken(user, 200, "Registered successfully. Please verify your email.", res);
    
  } catch (error) {
    // Pass errors to global error handler
    next(error);
  }


})


// Login controller
export const login = AsyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // 1️⃣ Validate input
  if (!email || !password) {
    return next(new ErrorHandler("Enter Your Email and Password", 400));
  }

  // 2️⃣ Find user by email
  const user = await User.findOne({ email }).select("+password");

  // 3️⃣ Check if user exists
  if (!user) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // 4️⃣ Compare password
  const isPasswordMatch = await bcrypt.compare(password, user.password);

  // 5️⃣ If password incorrect
  if (!isPasswordMatch) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  // 6️⃣ Send JWT token
  sendToken(user, 200, "Logged In", res);
});


export const getUser = AsyncHandler(async (req, res, next) => {
  // GET USER FROM REQUEST (set by auth middleware)
  const user = req.user;

  res.status(200).json({
    success: true,
    user,
  });
});


export const logOut = AsyncHandler(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: true,
      sameSite: "none",
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});




export const forgotPassword = AsyncHandler(async (req, res, next) => {
  const { email } = req.body;
  const { frontedUrl } = req.query; // optional fallback from query string

  // 1️⃣ Find user
  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorHandler("User not found with this email", 404));
  }

  // 2️⃣ Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // hash token (store securely in DB)
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // expiry (10 minutes from now)
  const resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  // 3️⃣ Save token configuration details in DB
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpire = resetPasswordExpire;

  await user.save({ validateBeforeSave: false });

  // 4️⃣ Create reset URL (Moved safely AFTER token generation with hardcoded fallback string)
  const baseUrl = process.env.FRONTEND_URL || frontedUrl || "https://onlineinterviewmanagementsystem.netlify.app";
  const resetPasswordUrl = `${baseUrl}/password/reset/${resetToken}`;

  const message = generateEmailTemplate(resetPasswordUrl);

  try {
    // 5️⃣ Send email
    await sendEmail({
      email: user.email,
      subject: "Password Recovery",
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    // 6️⃣ cleanup if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHandler("Email could not be sent", 500));
  }
});





export const resetPassword = AsyncHandler(async (req, res, next) => {
  // 1️⃣ Get token from URL params
  const { token } = req.params;

  // 2️⃣ Hash token (matches forgotPassword generation scheme)
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // 3️⃣ Find user with valid token + not expired
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  // 4️⃣ Validate token authenticity
  if (!user) {
    return next(new ErrorHandler("Invalid or expired reset token", 400));
  }

  // 5️⃣ Validate input (Updated: Only require password since frontend handles confirmation matching)
  const { password } = req.body;

  if (!password) {
    return next(new ErrorHandler("New password is required", 400));
  }

  // 6️⃣ Length check
  if (password.length < 8 || password.length > 20) {
    return next(
      new ErrorHandler("Password must be between 8 & 20 characters.", 400)
    );
  }

  // 7️⃣ Hash new password 
  // (Note: If your UserSchema has a pre("save") hook that automatically hashes modified passwords,
  // simply do: user.password = password; instead of using bcrypt manually here)
  const hashedPassword = await bcrypt.hash(password, 10);

  // 8️⃣ Update user record profile variables
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  // 9️⃣ Send token authentication authorization state back
  sendToken(user, 200, "Password reset successfully 🎉", res);
});

export const updatePassword = AsyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // 1️⃣ Validate input
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(
      new ErrorHandler("Please provide all required fields", 400)
    );
  }

  // 2️⃣ Get user from DB (important: need fresh password)
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // 3️⃣ Check current password
  const isPasswordMatch = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordMatch) {
    return next(new ErrorHandler("Current password is incorrect", 400));
  }

  // 4️⃣ Check new password match
  if (newPassword !== confirmNewPassword) {
    return next(new ErrorHandler("New passwords do not match", 400));
  }

  // 5️⃣ Password length validation
  if (newPassword.length < 8 || newPassword.length > 16) {
    return next(
      new ErrorHandler("Password must be between 8 and 16 characters", 400)
    );
  }

  // 6️⃣ Prevent reuse of old password
  const isSameAsOld = await bcrypt.compare(newPassword, user.password);

  if (isSameAsOld) {
    return next(
      new ErrorHandler(
        "New password cannot be same as current password",
        400
      )
    );
  }

  // 7️⃣ Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 8️⃣ Update DB
  user.password = hashedPassword;
  await user.save();

  // 9️⃣ Response
  res.status(200).json({
    success: true,
    message: "Password updated successfully.",
  });
});


// Controller to update user profile, including optional avatar image
export const updateProfile = AsyncHandler(async (req, res, next) => {
  const { name, email } = req.body;

  // 1️⃣ Validation
  if (!name || !email || !name.trim() || !email.trim()) {
    return next(new ErrorHandler("Please provide all required fields.", 400));
  }

  // 2️⃣ Get user from DB
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  let avatarData = null;

  // 3️⃣ Handle avatar upload
  if (req.file) {
    try {
      // delete old avatar if exists
      if (user.avatar?.public_id) {
        await cloudinary.v2.uploader.destroy(user.avatar.public_id);
      }

      // upload new avatar
      const result = await cloudinary.v2.uploader.upload(req.file.path, {
        folder: "Ecommerce_Avatars",
        width: 150,
        crop: "scale",
      });

      avatarData = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    } finally {
      // remove temp file
      fs.unlinkSync(req.file.path);
    }
  }

  // 4️⃣ Update fields
  user.name = name;
  user.email = email;

  if (avatarData) {
    user.avatar = avatarData;
  }

  // 5️⃣ Save user
  await user.save();

  // 6️⃣ Response
  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    user,
  });
});



export const googleAuth = AsyncHandler(async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ name, email, provider: "google", });
    }

    return sendToken(user, 200, "Google Auth Successful", res);
  } catch (error) {
    next(error);
  }
});


export const getCurrentUser = AsyncHandler(async (req, res, next) => {
  try{
      const userId = req.user._id;
      const user = await User.findById(userId);
      if(!user){
        return next(new ErrorHandler("User not found", 404));
      }
      res.status(200).json({
        success: true,
        user
      });
  } catch(error){
    next(error);
  }
}  )