const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const {
  generateSignedUploadUrl,
  objectExists,
  publicUrlForObject,
  deleteObject,
} = require("../services/gcs");

const { sendUploadNotificationToAdmin } = require("../services/mailer");
const requireAdmin = require("../middleware/admin");

const UserModel = require("../models/user");
const SketchModel = require("../models/sketch");
const ContestModel = require("../models/contest");
const { redis, KEYS } = require("../services/redis");

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_VIDEO_CONTENT_TYPES = new Set(["video/mp4", "video/webm"]);

async function getActiveContestId() {
  const cache = await redis.get(KEYS.ACTIVE_CONTEST);
  if (cache) {
    const parsedCache = JSON.stringify(cache);
    if (parsedCache?._id) return parsedCache._id;
  }

  const contest = await ContestModel.findOne(
    { status: "active" },
    { _id: 1 },
  ).lean();

  return contest?._id ?? null;
}

// Create GCP signed url for image and video and share to frontend for direct upload.
router.post("/upload-urls", async (req, res) => {
  const { imageContentType, videoContentType } = req.body;

  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(imageContentType)) {
    return res.status(400).json({ message: "Unsupported image content type" });
  }
  if (!ALLOWED_VIDEO_CONTENT_TYPES.has(videoContentType)) {
    return res.status(400).json({ message: "Unsupported video content type" });
  }

  const contestId = await getActiveContestId();
  if (!contestId) {
    return res.status(404).json({ message: "No active contest" });
  }

  const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
  if (!dbUser) {
    return res.status(404).json({ message: "User not found" });
  }

  const imageSubmissionId = crypto.randomUUID();
  const videoSubmissionId = crypto.randomUUID();

  // We are storing data according to contests. I am using googleId for the name of folder.
  const imageObjectPath = `contest-${contestId}/user-${dbUser.userId}/image-${imageSubmissionId}.jpg`; // .jpg directly works?
  const videoObjectPath = `contest-${contestId}/user-${dbUser.userId}/video-${videoSubmissionId}.mp4`; // .mp4 directly works?

  try {
    const [imageSignedUrl, videoSignedUrl] = await Promise.all([
      generateSignedUploadUrl(imageObjectPath, imageContentType),
      generateSignedUploadUrl(videoObjectPath, videoContentType),
    ]);

    return res.status(200).json({
      image: {
        signedUrl: imageSignedUrl,
        objectPath: imageObjectPath,
        contentType: imageContentType,
      },
      video: {
        signedUrl: videoSignedUrl,
        objectPath: videoObjectPath,
        contentType: videoContentType,
      },
    });
  } catch (err) {
    console.error("[sketch] upload-urls failed:", err.message);
    return res
      .status(500)
      .json({ message: "Error while generating upload URLs" });
  }
});

// Upload metadata after image and video upload
router.post("/", async (req, res) => {
  try {
    const { image, video } = req.body;

    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(image.contentType)) {
      return res
        .status(400)
        .json({ message: "Unsupported image content type" });
    }

    if (!ALLOWED_VIDEO_CONTENT_TYPES.has(video.contentType)) {
      return res
        .status(400)
        .json({ message: "Unsupported video content type" });
    }

    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const contestId = await getActiveContestId();
    if (!contestId) {
      return res.status(404).json({ message: "No active contest" });
    }

    // Sanity check: object paths must live under this user's namespace so a client can't supply someone else's path.
    const expectedPrefix = `contest-${contestId}/user-${dbUser.userId}/`;
    if (
      !image.objectPath.startsWith(expectedPrefix) ||
      !video.objectPath.startsWith(expectedPrefix)
    ) {
      return res.status(400).json({ message: "Invalid upload paths" });
    }

    // Verify both files actually landed in GCS before persisting metadata.
    const [imageOk, videoOk] = await Promise.all([
      objectExists(image.objectPath),
      objectExists(video.objectPath),
    ]);

    if (!imageOk || !videoOk) {
      return res.status(400).json({
        message:
          "One or both files were not found in storage. Please retry the upload.",
      });
    }

    // Replace existing submission (delete old GCS objects + DB row).
    const existing = await SketchModel.findOne({
      userId: dbUser._id,
      contestId: contestId,
    }).lean();

    if (existing) {
      await Promise.all([
        deleteObject(existing.imageObjectPath),
        deleteObject(existing.videoObjectPath),
      ]);
      await SketchModel.deleteOne({ _id: existing._id });
    }

    const sketch = await SketchModel.create({
      userId: dbUser._id, // I'll not store googleId but _id of User for populate
      contestId: contestId,
      imageObjectPath: image.objectPath,
      imageContentType: image.contentType,
      imageSize: Number(image.size),
      videoObjectPath: video.objectPath,
      videoContentType: video.contentType,
      videoSize: Number(video.size),
    });

    try {
      await sendUploadNotificationToAdmin(dbUser.displayName, contestId);
    } catch (err) {
      console.log(err);
    }

    return res.status(201).json({
      message: "Sketch image and video metadata uploaded to DB.",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while storing metadata.",
    });
  }
});

// Get sketches
router.get("/", async (req, res) => {
  try {
    const contestId = await getActiveContestId();
    if (!contestId) {
      return res.status(404).json({ message: "No active contest" });
    }

    const PAGE_SIZE = 20;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * PAGE_SIZE;

    const pipeline = [
      { $match: { contestId: contestId } },
      { $addFields: { voteCount: { $size: "$votes" } } },
      { $sort: { voteCount: -1, createdAt: 1 } },
      {
        $facet: {
          sketches: [{ $skip: skip }, { $limit: PAGE_SIZE }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await SketchModel.aggregate(pipeline);
    const totalCount = result.total[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    await SketchModel.populate(result.sketches, {
      path: "userId",
      select: "displayName photo",
    });

    const shapedSketches = result.sketches.map((sketch) => {
      return {
        _id: sketch._id,
        displayName: sketch.userId.displayName,
        photo: sketch.userId.photo,
        imageUrl: publicUrlForObject(sketch.imageObjectPath),
        videoUrl: publicUrlForObject(sketch.videoObjectPath),
        createdAt: sketch.createdAt,
        votes: sketch.voteCount,
        isOwner: sketch.userId._id.toString() === req.user._id,
        hasVoted: sketch.votes.some((v) => v.toString() === req.user.userId),
        rejected: sketch.rejected,
        rejectedReason: sketch.rejectedReason,
      };
    });

    return res.status(200).json({
      sketches: shapedSketches,
      page,
      totalPages,
      totalCount,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error while fetching sketches",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const sketch = await SketchModel.findOne({
      userId: dbUser._id,
    }).populate("userId", ["displayName", "photo"]);

    if (!sketch) return res.status(200).json(null);

    const shapedSketch = {
      _id: sketch._id,
      displayName: sketch.userId.displayName,
      photo: sketch.userId.photo,
      imageUrl: publicUrlForObject(sketch.imageObjectPath),
      videoUrl: publicUrlForObject(sketch.videoObjectPath),
      createdAt: sketch.createdAt,
      votes: sketch.votes.length,
      isOwner: sketch.userId._id === req.user.userId,
      hasVoted: sketch.votes.includes(req.user.userId),
      rejected: sketch.rejected,
      rejectedReason: sketch.rejectedReason,
    };

    return res.status(200).json(shapedSketch);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error while fetching user's sketch" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const sketch = await SketchModel.findOne({
      _id: req.params.id,
      userId: dbUser._id,
    });
    if (!sketch) {
      return res
        .status(404)
        .json({ message: "Sketch not found for the user." });
    }

    await Promise.all([
      deleteObject(sketch.imageObjectPath),
      deleteObject(sketch.videoObjectPath),
    ]);
    await sketch.deleteOne({ _id: sketch._id });

    return res
      .status(204)
      .json({ message: "Deleted the submitted sketch image and video." });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error while deleting sketch image and video." });
  }
});

router.post("/reject/:id", requireAdmin, async (req, res) => {
  try {
    const rejectReason = req.body.rejectReason.trim();
    if (!rejectReason) {
      return res.status(400).json({ message: "A reason is required." });
    }

    if (rejectReason.length > process.env.REJECTION_REASON_MAX_LENGTH) {
      return res
        .status(400)
        .json(
          `Reason must be under ${REJECTION_REASON_MAX_LENGTH} characters.`,
        );
    }

    const sketch = await SketchModel.findOneAndUpdate(
      { _id: req.params.id },
      {
        $set: {
          rejected: true,
          rejectedReason: rejectReason,
          rejectedAt: new Date(),
          rejectedBy: req.user.userId,
        },
      },
      { new: true },
    ).lean();

    if (!sketch) {
      return res.status(404).json({ message: "Sketch not found." });
    }

    return res
      .status(200)
      .json({ message: "Successfully rejected the sketch." });
  } catch (err) {
    return res.status(500).json({ message: "Error while rejecting sketch." });
  }
});

router.delete("/reject/:id", async (req, res) => {
  try {
    const sketch = await SketchModel.findOneAndUpdate(
      {
        _id: req.params.id,
      },
      {
        $set: {
          rejected: false,
          rejectedReason: null,
          rejectedAt: null,
          rejectedBy: null,
        },
      },
      { new: true },
    );

    if (!sketch) {
      return res.status(404).json({ message: "Sketch not found." });
    }

    return res
      .status(200)
      .json({ message: "Rejection is removed from the sketch." });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error while removing the rejection from the sketch" });
  }
});

router.post("/vote/:id", async (req, res) => {
  try {
    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const existing = await SketchModel.findOne(
      { _id: req.params.id },
      { rejected: 1 },
    ).lean();

    if (!existing) {
      return res.status(404).json({ message: "Sketch not found." });
    }

    if (existing.rejected) {
      return res
        .status(403)
        .json({ message: "Voting is disabled for rejected sketches." });
    }

    const sketch = await SketchModel.findOneAndUpdate(
      { _id: req.params.id },
      {
        $addToSet: { votes: dbUser._id },
      },
      { new: true },
    ).lean();

    return res.status(201).json({ votes: sketch.votes.length, hasVoted: true });
  } catch (err) {
    return res.status(500).json({ message: "Error while creating a vote" });
  }
});

router.delete("/vote/:id", async (req, res) => {
  try {
    const dbUser = await UserModel.findOne({ userId: req.user.userId }).lean();
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    const sketch = await SketchModel.findOneAndUpdate(
      { _id: req.params.id },
      {
        $pull: { votes: dbUser._id },
      },
      { new: true },
    ).lean();

    if (!sketch) {
      return res.status(404).json({ message: "Sketch not found" });
    }

    return res
      .status(200)
      .json({ votes: sketch.votes.length, hasVoted: false });
  } catch (err) {
    return res.status(500).json({ message: "Error while deleting the vote" });
  }
});

module.exports = router;
