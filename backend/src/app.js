require("dotenv").config();
let express = require("express");
let app = express();
app.set("trust proxy", true);
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
const mongoose = require("mongoose");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const cron = require("node-cron");
const { sendWinnerNotification } = require("./services/mailer");
const { redis, KEYS } = require("./services/redis");
const { censorText } = require("./utils/profanity");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

const UserModel = require("./models/user");
const ChatSessionModel = require("./models/chat-session");
const ChatMessageModel = require("./models/chat-message");

const sketchRoutes = require("./routes/sketch");
const contestRoutes = require("./routes/contest");
const contactUsRoutes = require("./routes/contact-us");

const ContestModel = require("./models/contest");
const SketchModel = require("./models/sketch");

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.use(passport.initialize());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `http://localhost:3000/auth/google/callback`, // Local
      // callbackURL: `${process.env.FRONTEND_URL}/api/auth/google/callback`, // Prod
      scope: ["openid", "profile", "email"],
      state: false,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      const user = {
        userId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: profile.photos?.[0]?.value,
      };
      try {
        const newUser = await UserModel.findOneAndUpdate(
          { userId: profile.id },
          {
            $set: user, // Updates these fields every time they log in (e.g., new profile pic)
            $setOnInsert: { role: "user" }, // ONLY sets this field if it's a brand new user
          },
          { upsert: true, new: true },
        ).lean();
        return done(null, newUser);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

app.get("/auth/google", passport.authenticate("google", { session: false }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/auth`,
  }),
  (req, res) => {
    const token = jwt.sign(req.user, JWT_SECRET, {
      // req.user is an object, that is the payload we are providing for jwt signature.
      expiresIn: "24h",
    }); // Auth token has the user details
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  },
);

const verifyJwt = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

const optionalJwt = (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    } catch {
      // ignore invalid token for public routes
    }
  }
  next();
};

app.get("/auth/user", verifyJwt, async (req, res) => {
  const dbUser = await UserModel.findOne({
    userId: req.user.userId,
  }).lean();
  if (!dbUser) {
    return res.status(404).json({ message: "User not found" });
  }
  const { userId, displayName, email, photo, role } = dbUser;
  res.json({ userId, displayName, email, photo, role });
});

app.use("/sketch", optionalJwt, sketchRoutes);
app.use("/contest", optionalJwt, contestRoutes);
app.use("/contact-us", verifyJwt, contactUsRoutes);

// Socket.io livechat -----------------------------------------------------------

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});

let activeSession = null;

async function restoreActiveSession() {
  activeSession = await ChatSessionModel.findOne({ active: true }).lean();
}
restoreActiveSession();

const MAX_MESSAGE_LENGTH = 2000;
const CHAT_HISTORY_LIMIT = 200;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required"));

  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  let dbUser;
  try {
    dbUser = await UserModel.findOne({
      userId: socket.user.userId,
    }).lean();

    if (!dbUser) {
      socket.disconnect(true);
      return;
    }
  } catch {
    socket.disconnect(true);
    return;
  }

  const isActive = !!activeSession;
  socket.emit("livechat-status", { active: isActive });
  if (isActive) {
    const messages = await ChatMessageModel.find({
      sessionId: activeSession._id,
    })
      .sort({ createdAt: 1 })
      .limit(CHAT_HISTORY_LIMIT)
      .populate("userId", ["displayName", "photo", "role"])
      .lean();

    const shapedMessages = messages.map((m) => ({
      _id: m._id,
      text: m.text,
      displayName: m.userId?.displayName,
      photo: m.userId?.photo,
      role: m.userId?.role,
      timestamp: m.createdAt,
    }));
    socket.emit("chat-history", shapedMessages);
  }

  socket.on("start-livechat", async () => {
    if (socket.user.role !== "admin") return;
    activeSession = await ChatSessionModel.create({});
    io.emit("livechat-status", { active: true });
    io.emit("chat-history", []);
  });

  socket.on("stop-livechat", async () => {
    if (socket.user.role !== "admin") return;
    if (activeSession) {
      await ChatSessionModel.findByIdAndUpdate(activeSession._id, {
        active: false,
        stoppedAt: Date.now(),
      });
      activeSession = null;
      io.emit("livechat-status", { active: false });
    }
  });

  const messageTimes = [];

  socket.on("send-message", async (data) => {
    if (!activeSession) return;
    let text = typeof data?.text == "string" ? data.text.trim() : "";
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;
    text = censorText(text);

    // Rate limiting for livchat messages
    const now = Date.now();

    while (
      messageTimes.length > 0 &&
      now - messageTimes[0] > RATE_LIMIT_WINDOW_MS
    ) {
      messageTimes.shift();
    }
    // Now only those times remain in messageTimes which is within rate limit window
    if (messageTimes.length >= RATE_LIMIT_MAX) {
      socket.emit("rate-limited", {
        message: `Only ${RATE_LIMIT_MAX} messages per minute allowed`,
      });
      return;
    }

    messageTimes.push(now);

    try {
      const msg = await ChatMessageModel.create({
        sessionId: activeSession._id,
        text: text,
        userId: dbUser._id,
      });

      io.emit("new-message", {
        _id: msg._id,
        text: msg.text,
        displayName: dbUser.displayName,
        photo: dbUser.photo,
        role: dbUser.role,
        timestamp: msg.createdAt,
      });
    } catch (err) {
      console.error("send-message error:", err.message);
    }
  });

  socket.on("delete-message", async (data) => {
    if (dbUser.role !== "admin") return;
    const messageId = data?.messageId;
    if (!messageId) return;

    try {
      const deleted = await ChatMessageModel.findOneAndDelete({
        _id: messageId,
      });
      if (deleted) {
        io.emit("message-deleted", { messageId });
      }
    } catch (err) {
      console.error("delete-message error:", err.message);
    }
  });
});

const PRIZE_MAP = {
  1: "Rs 500",
  2: "Rs 200",
  3: "Rs 100",
};

// Daily job at 12:00 AM IST to deactivate contest
cron.schedule(
  "0 0 * * *",
  async () => {
    try {
      const today = new Date();

      const expiredContest = await ContestModel.findOne({
        status: "active",
        endDate: { $lt: today },
      });

      if (!expiredContest) {
        console.log("Contest scheduler: no expired contest found");
        return;
      }

      const topSketches = await SketchModel.aggregate([
        { $match: { contestId: expiredContest._id, rejected: { $ne: true } } },
        { $addFields: { voteCount: { $size: "$votes" } } },
        { $sort: { voteCount: -1, createdAt: 1 } },
        { $limit: 3 },
      ]);

      const winners = [];

      for (let i = 0; i < topSketches.length; i++) {
        const sketch = topSketches[i];
        const rank = i + 1;
        winners.push({
          rank,
          sketchId: sketch._id,
          userId: sketch.userId,
          prize: PRIZE_MAP[rank],
        });
      }

      await ContestModel.updateOne(
        { _id: expiredContest._id },
        { $set: { status: "inactive", winners } },
      );

      // Sending email to winners
      for (const winner of winners) {
        try {
          const user = await UserModel.findOne({ _id: winner.userId }).lean();
          if (user?.email) {
            await sendWinnerNotification(
              user.email,
              user.displayName,
              winner.rank,
              winner.prize,
              expiredContest.characterName,
            );
          }
        } catch (err) {
          console.error(
            `Failed to email winner rank ${winner.rank}: `,
            err.message,
          );
        }
      }

      await redis.del(KEYS.ACTIVE_CONTEST);

      if (winners.length > 0) {
        const winnersData = await Promise.all(
          winners.map(async (winner) => {
            const user = await UserModel.findOne({ _id: winner.userId }).lean();
            const sketch = await SketchModel.findOne({
              _id: winner.sketchId,
            }).lean();

            return {
              rank: winner.rank,
              prize: winner.prize,
              displayName: user?.displayName ?? "Unknown",
              photo: user?.photo ?? null,
              sketchImageUrl: sketch
                ? publicUrlForObject(sketch.imageObjectPath)
                : null,
            };
          }),
        );
        await redis.set(
          KEYS.PREV_WINNERS,
          JSON.stringify({
            characterName: expiredContest.characterName,
            characterImage: expiredContest.characterImage,
            endDate: expiredContest.endDate,
            winners: winnersData,
          }),
        );
      } else {
        await redis.del(KEYS.PREV_WINNERS);
      }

      console.log(
        `Contest scheduler ran successfully: deactivated contest ${expiredContest._id}`,
      );
    } catch (err) {
      console.error("Contest scheduler error: ", err.message);
    }
  },
  { timestamp: "Asia/Kolkata" },
);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
