
export const sendToken = (user, statusCode, message, res) => {
  const token = user.getJWTToken();

  const cookieExpire = Number(process.env.COOKIE_EXPIRE) || 7;

  const options = {
    expires: new Date(
      Date.now() + cookieExpire * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    message,
    user,
    token,
  });
};