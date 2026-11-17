const nodemailer = require("nodemailer");
async function sendVerification(email, code) {
 const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
 if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.log(`[DEV EMAIL VERIFICATION] ${email}: code ${code} (configure SMTP before public launch)`);
  return false;
 }
 const transporter = nodemailer.createTransport({
  host: SMTP_HOST, port: Number(SMTP_PORT || 587), secure: SMTP_SECURE === "true",
  auth: { user: SMTP_USER, pass: SMTP_PASS }
 });
 await transporter.sendMail({
  from: MAIL_FROM || SMTP_USER, to: email,
  subject: "Verify your CIPHER Code Academy account",
  text: `Your verification code is ${code}. It expires in 15 minutes.`
 });
 return true;
}
module.exports = { sendVerification };
