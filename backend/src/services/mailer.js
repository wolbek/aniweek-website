const nodemailer = require("nodemailer");

async function sendUploadNotificationToAdmin(userDisplayName, contestId) {
  try {
    // Create a transporter using SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // use STARTTLS (upgrade connection to TLS after connecting)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.verify();
    console.log("Server is ready to take our messages");

    const info = await transporter.sendMail({
      from: `"Owner" ${SMTP_USER}`, // sender address
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
