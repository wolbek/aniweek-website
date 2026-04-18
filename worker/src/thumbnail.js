const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

function extractThumbnail(inputPath, outputDir, duration) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });

    const seekTime = duration > 8 ? 2 : duration * 0.25;
    const outputPath = path.join(outputDir, "thumbnail.jpg");

    ffmpeg(inputPath)
      .seekInput(seekTime)
      .frames(1)
      .outputOptions(["-vf", "scale=640:-2", "-q:v", "2"])
      .output(outputPath)
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .run();
  });
}

module.exports = { extractThumbnail };
