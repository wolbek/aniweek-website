const nodemailer = require("nodemailer");

async function sendUploadNotificationToAdmin(userDisplayName, contestId) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("[mail] SMTP not configured — skipping admin notification");
    return;
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PORT = process.env.SMTP_PORT;
  const SMTP_PASS = process.env.SMTP_PASS;

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
      from: `"Owner" <${SMTP_USER}>`, // sender address
      to: `${SMTP_USER}`, // list of recipients
      subject: "Sketch Upload", // subject line
      html: `<b>${userDisplayName} uploaded a sketch for contestId ${contestId}.</b>`, // HTML body
    });

    console.log("Message sent: ", info.messageId);
  } catch (err) {
    console.error("[mail] notify admin failed:", err.message);
  }
}

module.exports = {
  sendUploadNotificationToAdmin,
};
