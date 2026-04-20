const mongoose = require("mongoose");

const sketchSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // I'll not store googleId but _id of User for populate
      ref: "User",
      required: true,
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contest",
    },
    imageObjectPath: {
      type: String,
      required: true,
    },
    imageContentType: {
      type: String,
      required: true,
    },
    imageSize: {
      type: Number,
    },
    videoObjectPath: {
      type: String,
      required: true,
    },
    videoContentType: {
      type: String,
      required: true,
    },
    videoSize: {
      type: Number,
    },
    votes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    rejected: {
      type: Boolean,
      default: false,
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    rejectedBy: {
      type: String,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

const SketchModel = mongoose.model("Sketch", sketchSchema);

module.exports = SketchModel;
