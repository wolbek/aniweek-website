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
        return res.status(200).json(characterData);
      }
    }

    // After retries exhausted
    return res.status(500).json({
      message: "Could not fetch valid character data after retries",
    });
  } catch (err) {
    res.status(500).json({
      message: "Error while fetching random character from Jikan",
    });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, characterData } = req.body;

    await ContestModel.updateOne(
      { status: "active" },
      {
        $set: { status: "inactive" },
      },
    );

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
    await ContestModel.updateOne(
      { status: "active" },
      {
        $set: { status: "inactive" },
      },
    );

    return res.status(200).json({
      message: "Contest cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while cancelling contest",
    });
  }
});

module.exports = router;
