const mongoose = require("mongoose");

const chatSessionSchema = mongoose.Schema({
  active: {
    type: Boolean,
    default: true,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  stoppedAt: {
    type: Date,
  },
});

const chatSessionModel = mongoose.model("ChatSession", chatSessionSchema);

module.exports = chatSessionModel;
