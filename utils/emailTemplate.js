export const generateEmailTemplate = (url) => {
  return `
    <div style="font-family: Arial">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset.</p>
      <a href="${url}" style="padding:10px;background:#000;color:#fff;text-decoration:none;">
        Reset Password
      </a>
      <p>If you did not request this, ignore this email.</p>
    </div>
  `;
};