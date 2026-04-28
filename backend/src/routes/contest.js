const express = require("express");
const requireAdmin = require("../middleware/admin");
const ContestModel = require("../models/contest");
const SketchModel = require("../models/sketch");
const { publicUrlForObject } = require("../services/gcs");
const { redis, KEYS } = require("../services/redis");

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

router.post("/", requireAuth, requireAdmin, async (req, res) => {
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

router.post("/cancel", requireAuth, requireAdmin, async (req, res) => {
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
