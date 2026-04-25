const express = require("express");
const requireAdmin = require("../middleware/admin");
const ContestModel = require("../models/contest");

const router = express.Router();

const JIKAN_API_URL_RANDOM_CHARACTER =
  "https://api.jikan.moe/v4/random/characters";

router.get("/random-character", requireAdmin, async (req, res) => {
  try {
    const retries = 3;
    for (let i = 0; i < retries; i++) {
      const jikanRes = await fetch(JIKAN_API_URL_RANDOM_CHARACTER);
      if (!jikanRes.ok) {
        return res.status(502).json({
          message: "Failed to fetch character from Jikan API",
        });
      }

      const { data: characterData } = await jikanRes.json();

      if (
        characterData?.name &&
        characterData?.images?.jpg?.image_url &&
        characterData?.about
      ) {
        return res.status(200).json({
          characterName: characterData.name,
          characterImage: characterData.images.jpg.image_url,
          characterDescription: characterData.about,
        });
      }
    }

    // After retries exhausted
    return res.status(500).json({
      message: "Could not fetch valid character data after retries",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while fetching random character from Jikan",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { characterData } = req.body;

    const activeContest = await ContestModel.findOne({
      status: "active",
    });

    if (activeContest) {
      return res.status(400).json({
        message:
          "Couldn't create a new contest. There is an active contest going on.",
      });
    }

    // Start date and end date is 7 days difference
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    await ContestModel.create({
      startDate,
      endDate,
      characterName: characterData.characterName,
      characterImage: characterData.characterImage,
      characterDescription: characterData.characterDescription,
      status: "active",
    });

    return res.status(200).json({
      message: "Contest created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while creating contest",
    });
  }
});

router.post("/cancel", requireAdmin, async (req, res) => {
  try {
    const result = await ContestModel.updateOne(
      { status: "active" },
      {
        $set: { status: "inactive" },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "No active contest to cancel",
      });
    }

    return res.status(200).json({
      message: "Contest cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while cancelling contest",
    });
  }
});

router.get("/active", async (req, res) => {
  try {
    const contest = await ContestModel.findOne({ status: "active" }).lean();
    return res.status(200).json({ contest: contest || null });
  } catch (err) {
    return res.status(500).json({
      message: "Error while fetching active contest",
    });
  }
});

module.exports = router;
