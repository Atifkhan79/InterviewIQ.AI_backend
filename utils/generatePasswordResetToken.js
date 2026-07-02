import crypto from "crypto";

export const generatePasswordResetToken = () => {
  // 1️⃣ Generate random token (plain token sent to email)
  const resetToken = crypto.randomBytes(32).toString("hex");

  // 2️⃣ Hash token (store in DB)
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // 3️⃣ Expiry time (10 minutes)
  const resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return {
    resetToken,          // send to user via email
    hashedToken,         // store in DB
    resetPasswordExpire, // store in DB
  };
};