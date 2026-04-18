const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const { Storage } = require("@google-cloud/storage");
const { transcodeToHLS, getDuration } = require("./transcode");
const { extractThumbnail } = require("./thumbnail");

const app = express();
app.use(express.json());

const storage = new Storage();
const rawBucket = storage.bucket(process.env.GCS_RAW_BUCKET);
const transcodedBucket = storage.bucket(process.env.GCS_TRANSCODED_BUCKET);

const CDN_BASE_URL = process.env.CDN_BASE_URL;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Worker connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

const VideoModel = require("./models/video");

async function uploadDirectory(localDir, gcsPrefix) {
  const files = fs.readdirSync(localDir);
  const uploads = files.map((file) => {
    const filePath = path.join(localDir, file);
    const destination = `${gcsPrefix}/${file}`;
    return transcodedBucket.upload(filePath, {
      destination,
      metadata: {
        cacheControl: "public, max-age=86400",
      },
    });
  });
  await Promise.all(uploads);
}

async function processVideo(videoId, objectPath) {
  const tmpDir = path.join("/tmp", videoId);
  const inputPath = path.join(tmpDir, "input");
  const hlsOutputDir = path.join(tmpDir, "hls");

  try {
    await VideoModel.findOneAndUpdate({ videoId }, { status: "processing" });

    fs.mkdirSync(tmpDir, { recursive: true });

    console.log(`Downloading ${objectPath}...`);
    await rawBucket.file(objectPath).download({ destination: inputPath });
    console.log("Download complete");

    const duration = await getDuration(inputPath);
    console.log(`Video duration: ${duration}s`);

    console.log("Starting HLS transcode...");
    await transcodeToHLS(inputPath, hlsOutputDir);

    console.log("Extracting thumbnail...");
    await extractThumbnail(inputPath, hlsOutputDir, duration);

    console.log("Uploading transcoded files to GCS...");
    await uploadDirectory(hlsOutputDir, videoId);

    const manifestURL = `${CDN_BASE_URL}/${videoId}/master.m3u8`;
    const thumbnailURL = `${CDN_BASE_URL}/${videoId}/thumbnail.jpg`;

    await VideoModel.findOneAndUpdate(
      { videoId },
      {
        status: "ready",
        duration: Math.round(duration),
        manifestURL,
        thumbnailURL,
      },
    );

    console.log(`Video ${videoId} processing complete`);
  } catch (err) {
    console.error(`Video ${videoId} processing failed:`, err.message);
    await VideoModel.findOneAndUpdate(
      { videoId },
      { status: "failed", errorMessage: err.message },
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

app.post("/", async (req, res) => {
  try {
    const message = req.body.message;
    if (!message?.data) {
      return res.status(400).json({ message: "Invalid Pub/Sub message" });
    }

    const data = JSON.parse(Buffer.from(message.data, "base64").toString());
    const { videoId, objectPath } = data;

    if (!videoId || !objectPath) {
      return res.status(400).json({ message: "Missing videoId or objectPath" });
    }

    res.status(200).json({ received: true });

    processVideo(videoId, objectPath).catch((err) => {
      console.error("Unhandled processing error:", err);
    });
  } catch (err) {
    console.error("Message handler error:", err.message);
    res.status(500).json({ message: "Internal error" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});
