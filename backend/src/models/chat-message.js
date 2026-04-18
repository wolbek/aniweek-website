const mongoose = require("mongoose");

const chatMessageSchema = mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatSession",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      maxLength: 2000
    },
    userId: {
      type: String,
      ref: "User",
      required: true
    },
  },
  { timestamps: true },
);

const ChatMessageModel = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = ChatMessageModel;
