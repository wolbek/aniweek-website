const mongoose = require("mongoose");

const videoSchema = mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String, // userId is coming from google which is a string, not an objectId
      ref: "User",
      required: true,
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    originalFileName: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "uploading", "uploaded", "processing", "ready", "failed"],
      default: "pending",
    },
    duration: {
      type: Number,
    },
    thumbnailURL: {
      type: String,
    },
    manifestURL: {
      type: String,
    },
    rawObjectPath: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true },
);

videoSchema.index({ userId: 1, contestId: 1 });

const VideoModel = mongoose.model("Video", videoSchema);

module.exports = VideoModel;
