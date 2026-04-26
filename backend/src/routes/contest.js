const express = require("express");
const requireAdmin = require("../middleware/admin");
const ContestModel = require("../models/contest");
const SketchModel = require("../models/sketch");
const { publicUrlForObject } = require("../services/gcs");
const { redis, KEYS } = require("../services/redis");

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

    const contest = await ContestModel.create({
      startDate,
      endDate,
      characterName: characterData.characterName,
      characterImage: characterData.characterImage,
      characterDescription: characterData.characterDescription,
      status: "active",
    });

    await redis.set(KEYS.ACTIVE_CONTEST, JSON.stringify(contest));

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

    await redis.del(KEYS.ACTIVE_CONTEST);

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
    const cache = await redis.get(KEYS.ACTIVE_CONTEST);

    if (cache) {
      return res.status(200).json({ contest: JSON.parse(cache) });
    }

    const contest = await ContestModel.findOne({ status: "active" }).lean();

    if (contest) {
      await redis.set(KEYS.ACTIVE_CONTEST, contest);
    }

    return res.status(200).json({ contest: contest || null });
  } catch (err) {
    return res.status(500).json({
      message: "Error while fetching active contest",
    });
  }
});

router.get("/prev-winners", async (req, res) => {
  try {
    const cache = await redis.get(KEYS.PREV_WINNERS);
    if (cache) {
      return res.status(200).json(JSON.parse(cache));
    }

    const contest = await ContestModel.findOne({
      status: "inactive",
      "winners.0": { $exists: true },
    })
      .sort({ endDate: -1 })
      .populate("winners.userId", ["displayName", "photo"])
      .lean();

    if (!contest) {
      return res.status(200).json(null);
    }

    const winnersData = await Promise.all(
      contest.winners.map(async (winner) => {
        const sketch = await SketchModel.findOne({
          _id: winner.sketchId,
        }).lean();

        return {
          rank: winner.rank,
          prize: winner.prize,
          displayName: winner.userId?.displayName ?? "Unknown",
          photo: winner.userId?.photo ?? null,
          sketchImageUrl: sketch
            ? publicUrlForObject(sketch.imageObjectPath)
            : null,
        };
      }),
    );

    const result = {
      characterName: contest.characterName,
      characterImage: contest.characterImage,
      endDate: contest.endDate,
      winners: winnersData,
    };

    await redis.set(KEYS.PREV_WINNERS, JSON.stringify(result));

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      message: "Error while fetching previous winners",
    });
  }
});

module.exports = router;
