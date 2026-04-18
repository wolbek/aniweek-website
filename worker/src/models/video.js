const mongoose = require("mongoose");

const videoSchema = mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true },
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    originalFileName: String,
    status: {
      type: String,
      enum: [
        "pending",
        "uploading",
        "uploaded",
        "processing",
        "ready",
        "failed",
      ],
      default: "pending",
    },
    duration: Number,
    thumbnailURL: String,
    manifestURL: String,
    rawObjectPath: String,
    errorMessage: String,
  },
  { timestamps: true },
);

const VideoModel = mongoose.model("Video", videoSchema);

module.exports = VideoModel;
