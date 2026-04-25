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
  },
  { timestamps: true },
);

const ContestModel = mongoose.model("Contest", contestSchema);

module.exports = ContestModel;
