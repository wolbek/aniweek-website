const express = require("express");
const crypto = require("crypto");
const VideoModel = require("../models/video");
const ContestModel = require("../models/contest");
const { generateSignedUploadUrl, deleteFileFromGCS } = require("../services/gcs");
const { publishVideoUploadEvent } = require("../services/pubsub");

const router = express.Router();

const ALLOWED_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/webm"
])

router.get("/upload-url", async (req, res) => {

  try {
    const { fileName, contentType } = req.query;
    if (!fileName || !contentType) {
      return res.status(400).json({ message: "fileName and contentType are required" });
    }

    if(!ALLOWED_CONTENT_TYPES.has(contentType)){
      return res.status(400).json({ message: "Unsupported video content type" });
    }

    const contest = await ContestModel.findOne({ status:'active' }, { _id:1 }).lean();
    if(!contest) {
      return res.status(400).json({ message: "No active contest found. Cannot upload video." });
    }
    const userVideo = await VideoModel.findOne({ userId: req.user.userId, contestId: contest._id });
    if (userVideo) {
      // We only want user to upload one video per contest
      //delete the current doc
      // delete the file from the GCS bucket-
      await Promise.all([
        VideoModel.deleteOne({ _id: userVideo._id }),
        deleteFileFromGCS(userVideo.rawObjectPath)
      ])
      
    }

    const videoId = crypto.randomUUID();
    const ext = fileName.split(".").pop();
    const objectPath = `${videoId}/raw.${ext}`;

    
    if (!contest) {
      return res.status(400).json({ message: "No active contest found" });
    }

    const video = await VideoModel.create({
      videoId,
      userId: req.user.userId,
      contestId: contest._id,
      originalFileName: fileName,
      status: "pending",
      rawObjectPath: objectPath,
    });

    const signedUrl = await generateSignedUploadUrl(objectPath, contentType);

    res.json({
      videoId: video.videoId,
      signedUrl,
      objectPath,
    });
  } catch (err) {
    console.error("upload-url error:", err.message);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

router.post("/:videoId/confirm-upload", async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await VideoModel.findOneAndUpdate(
      { videoId, userId: req.user.userId, status: "pending" },
      { status: "uploaded" },
      { new: true },
    ).lean();

    if (!video) {
      return res.status(404).json({ message: "Video not found or already processed" });
    }

    await publishVideoUploadEvent({
      videoId: video.videoId,
      objectPath: video.rawObjectPath,
    });

    res.json({ videoId: video.videoId, status: video.status });
  } catch (err) {
    console.error("confirm-upload error:", err.message);
    res.status(500).json({ message: "Failed to confirm upload" });
  }
});

router.get("/:videoId", async (req, res) => {
  try {
    const video = await VideoModel.findOne({ videoId: req.params.videoId }).lean();
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    res.json(video);
  } catch (err) {
    console.error("get-video error:", err.message);
    res.status(500).json({ message: "Failed to fetch video" });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
      VideoModel.find({ userId: req.user.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VideoModel.countDocuments({ userId: req.user.userId }),
    ]);

    res.json({
      videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("list-videos error:", err.message);
    res.status(500).json({ message: "Failed to list videos" });
  }
});

module.exports = router;
