require("dotenv").config();
let express = require("express");
let app = express();
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
const mongoose = require("mongoose");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

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
      callbackURL: "/auth/google/callback",
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
    // Auth token has the user details (userId, displayName, email, photo) so we are setting it to req.user
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
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

// Other routes
app.use("/sketch", verifyJwt, sketchRoutes);

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

  socket.on("send-message", async (data) => {
    if (!activeSession) return;
    const text = typeof data?.text == "string" ? data.text.trim() : "";
    if (!text || text.length > MAX_MESSAGE_LENGTH) return;

    try {
      const msg = await ChatMessageModel.create({
        sessionId: activeSession._id,
        text: text,
        userId: dbUser._id,
      });

      io.emit("new-message", {
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
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
