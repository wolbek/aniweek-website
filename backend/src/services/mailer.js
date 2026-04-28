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
      from: `"aniweekcontest" <${SMTP_USER}>`, // sender address
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
      from: `"aniweekcontest" <${SMTP_USER}>`,
      to: email,
      subject: `Congratulations! You won ${ordinal} place!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6c63ff;">Congratulations, ${displayName}!</h1>
          <p>Your sketch for <strong>${characterName}</strong> won <strong>${ordinal} place</strong> in this week's contest!</p>
          <p style="font-size: 1.2em;">Your prize: <strong>${prize}</strong></p>
          <hr />
          <p>To receive your prize, please <strong>reply to this email with your GPay ID</strong> so we can send the payment to you.</p>
          <p>Thank you for participating, and keep drawing!</p>
          <p style="color: #888;">— AniWeekContest Team</p>
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

async function sendContactEmail(userEmail, userName, subject, body) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("[mail] SMTP not configured — skipping contact email");
    return;
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_PASS = process.env.SMTP_PASSWORD;

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
      from: `"aniweekcontest" <${SMTP_USER}>`,
      to: SMTP_USER,
      replyTo: userEmail,
      subject: `[Contact] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c63ff;">New Contact Message</h2>
          <p><strong>From:</strong> ${userName} (${userEmail})</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr />
          <p style="white-space: pre-wrap;">${body}</p>
          <hr />
          <p style="color: #888;">You can reply directly to this email to respond to the user.</p>
        </div>
      `,
    });

    console.log(`[mail] Contact email sent: ${info.messageId}`);
  } catch (err) {
    console.error("[mail] Contact email failed:", err.message);
    throw err;
  }
}

async function sendRejectionNotification(email, displayName, reason) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn(
      "[mail] SMTP not configured — skipping rejection notification",
    );
    return;
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_PASS = process.env.SMTP_PASSWORD;

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
      from: `"aniweekcontest" <${SMTP_USER}>`,
      to: email,
      subject: "Your sketch has been rejected",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6c63ff;">Hi ${displayName},</h2>
          <p>Unfortunately, your sketch submission has been <strong>rejected</strong> by an admin.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <hr />
          <p>You can upload a new sketch for the current contest. If you believe this was a mistake, please contact us.</p>
          <p style="color: #888;">— AniWeekContest Team</p>
        </div>
      `,
    });

    console.log(
      `[mail] Rejection notification sent to ${email}: ${info.messageId}`,
    );
  } catch (err) {
    console.error(
      `[mail] Rejection notification to ${email} failed:`,
      err.message,
    );
  }
}

module.exports = {
  sendUploadNotificationToAdmin,
  sendWinnerNotification,
  sendContactEmail,
  sendRejectionNotification,
};
