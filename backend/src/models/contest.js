const mongoose = require("mongoose");

const contestSchema = mongoose.Schema(
  {
    //_id: contestId
    characterName: {
      type: String,
      required: true,
    },
    characterImage: {
      type: String,
      required: true,
    },
    characterDescription: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    winners: [
      {
        rank: { type: Number },
        sketchId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Sketch",
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        prize: { type: String },
      },
    ],
  },
  { timestamps: true },
);

const ContestModel = mongoose.model("Contest", contestSchema);

module.exports = ContestModel;
