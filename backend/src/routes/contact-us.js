const express = require("express");
const router = express.Router();
const UserModel = require("../models/user");
const { sendContactEmail } = require("../services/mailer");

router.post("/", async (req, res) => {
  try {
    const { subject, body } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      return res
        .status(400)
        .json({ message: "Subject and message body are required." });
    }

    if (subject.length > process.env.CONTACT_US_MAX_SUBJECT_LENGTH) {
      return res.status(400).json({
        message: `Subject must be under ${process.env.CONTACT_US_MAX_SUBJECT_LENGTH} characters.`,
      });
    }

    if (body.length > process.env.CONTACT_US_MAX_BODY_LENGTH) {
      return res.status(400).json({
        message: `Message must be under ${process.env.CONTACT_US_MAX_BODY_LENGTH} characters.`,
      });
    }

    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await sendContactEmail(
      dbUser.email,
      dbUser.displayName,
      subject.trim(),
      body.trim(),
    );

    return res.status(200).json({ message: "Message sent successfully." });
  } catch (err) {
    console.error("[contact] Error:", err.message);
    return res
      .status(500)
      .json({ message: "Failed to send message. Please try again later." });
  }
});

module.exports = router;
