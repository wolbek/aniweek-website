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

const JIKAN_API_URL_RANDOM_CHARACTER =
  "https://api.jikan.moe/v4/random/characters";

const JIKAN_API_URL_SEARCH_CHARACTER = "https://api.jikan.moe/v4/characters";

router.get("/random-character", requireAuth, requireAdmin, async (req, res) => {
  try {
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1000 * i));

      console.log(`[Jikan] random-character attempt ${i + 1}/${maxRetries}`);

      let jikanRes;
      try {
        jikanRes = await fetch(JIKAN_API_URL_RANDOM_CHARACTER);
      } catch (fetchErr) {
        console.error(
          `[Jikan] fetch threw on attempt ${i + 1}:`,
          fetchErr.message,
        );
        continue;
      }

      console.log(`[Jikan] attempt ${i + 1} status: ${jikanRes.status}`);

      if (jikanRes.status === 429) {
        console.log(`[Jikan] rate limited, will retry...`);
        continue;
      }
      if (!jikanRes.ok) {
        const body = await jikanRes.text();
        console.error(`[Jikan] non-ok response body:`, body.slice(0, 300));
        continue;
      }

      const json = await jikanRes.json();
      const characterData = json?.data;

      if (characterData?.name && characterData?.images?.jpg?.image_url) {
        return res.status(200).json({
          characterName: characterData.name,
          characterImage: characterData.images.jpg.image_url,
          characterDescription:
            characterData.about || "No description available.",
        });
      }

      console.log(
        `[Jikan] attempt ${i + 1} got incomplete data, missing:`,
        !characterData?.name ? "name" : "",
        !characterData?.images?.jpg?.image_url ? "image" : "",
      );
    }

    return res.status(502).json({
      message:
        "Could not fetch a valid character after retries. Please try again.",
    });
  } catch (err) {
    console.error("random-character error:", err.message);
    return res.status(500).json({
      message: "Error while fetching random character from Jikan",
    });
  }
});

router.get("/search-character", requireAuth, requireAdmin, async (req, res) => {
  try {
    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const url = `${JIKAN_API_URL_SEARCH_CHARACTER}?q=${encodeURIComponent(query)}&limit=10`;
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 600 * i));

      let jikanRes;
      try {
        jikanRes = await fetch(url);
      } catch {
        continue;
      }

      if (jikanRes.status === 429) continue;
      if (!jikanRes.ok) continue;

      const { data } = await jikanRes.json();

      const results = (data || [])
        .filter((c) => c?.name && c?.images?.jpg?.image_url)
        .map((c) => ({
          characterName: c.name,
          characterImage: c.images.jpg.image_url,
          characterDescription: c.about || "No description available.",
        }));

      return res.status(200).json({ results });
    }

    return res.status(502).json({
      message: "Failed to search characters. Please try again.",
    });
  } catch (err) {
    console.error("search-character error:", err.message);
    return res.status(500).json({
      message: "Error while searching characters from Jikan",
    });
  }
});

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
