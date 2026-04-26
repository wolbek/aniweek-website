const nodemailer = require("nodemailer");

async function sendUploadNotificationToAdmin(userDisplayName, contestId) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("[mail] SMTP not configured — skipping admin notification");
    return;
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_PASS = process.env.SMTP_PASSWORD;

  try {
    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.verify();
    console.log("Server is ready to take our messages");

    const info = await transporter.sendMail({
      from: `"Aniweek" <${SMTP_USER}>`, // sender address
      to: SMTP_USER, // list of recipients
      subject: "Sketch Upload", // subject line
      html: `<b>${userDisplayName} uploaded a sketch for contestId ${contestId}.</b>`, // HTML body
    });

    console.log("[mail] Message sent: ", info.messageId);
  } catch (err) {
    console.error("[mail] notify admin failed:", err.message);
  }
}

async function sendWinnerNotification(
  email,
  displayName,
  rank,
  prize,
  characterName,
) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("[mail] SMTP not configured — skipping winner notification");
    return;
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_PASS = process.env.SMTP_PASSWORD;

  const ordinal = rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd";

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"AniWeek" <${SMTP_USER}>`,
      to: email,
      subject: `Congratulations! You won ${ordinal} place!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6c63ff;">Congratulations, ${displayName}!</h1>
          <p>Your sketch for <strong>${characterName}</strong> won <strong>${ordinal} place</strong> in this week's AniWeek contest!</p>
          <p style="font-size: 1.2em;">Your prize: <strong>${prize}</strong></p>
          <hr />
          <p>To receive your prize, please <strong>reply to this email with your GPay ID</strong> so we can send the payment to you.</p>
          <p>Thank you for participating, and keep drawing!</p>
          <p style="color: #888;">— AniWeek Team</p>
        </div>
      `,
    });

    console.log(
      `[mail] Winner notification sent to ${email}: ${info.messageId}`,
    );
  } catch (err) {
    console.error(
      `[mail] Winner notification sent to ${email} failed:`,
      err.message,
    );
  }
}

module.exports = {
  sendUploadNotificationToAdmin,
  sendWinnerNotification,
};
