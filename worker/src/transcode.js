const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

const RENDITIONS = [
  { name: "1080p", width: 1920, height: 1080, videoBitrate: "5000k", audioBitrate: "192k", maxrate: "5350k", bufsize: "7500k" },
  { name: "720p", width: 1280, height: 720, videoBitrate: "2800k", audioBitrate: "128k", maxrate: "2996k", bufsize: "4200k" },
  { name: "480p", width: 854, height: 480, videoBitrate: "1400k", audioBitrate: "128k", maxrate: "1498k", bufsize: "2100k" },
  { name: "240p", width: 426, height: 240, videoBitrate: "600k", audioBitrate: "64k", maxrate: "642k", bufsize: "900k" },
];

function getDuration(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

function transcodeRendition(inputPath, outputDir, rendition) {
  return new Promise((resolve, reject) => {
    const playlistName = `${rendition.name}.m3u8`;
    const segmentPattern = path.join(outputDir, `${rendition.name}_%03d.ts`);
    const playlistPath = path.join(outputDir, playlistName);

    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        `-b:v ${rendition.videoBitrate}`,
        `-maxrate ${rendition.maxrate}`,
        `-bufsize ${rendition.bufsize}`,
        `-vf scale=${rendition.width}:${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`,
        "-c:a aac",
        `-b:a ${rendition.audioBitrate}`,
        "-ar 48000",
        "-hls_time 6",
        "-hls_playlist_type vod",
        `-hls_segment_filename ${segmentPattern}`,
        "-f hls",
      ])
      .output(playlistPath)
      .on("end", () => resolve(playlistPath))
      .on("error", reject)
      .run();
  });
}

function generateMasterPlaylist(outputDir) {
  let content = "#EXTM3U\n#EXT-X-VERSION:3\n\n";

  for (const r of RENDITIONS) {
    const bandwidth = parseInt(r.videoBitrate) * 1000 + parseInt(r.audioBitrate) * 1000;
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${r.width}x${r.height}\n`;
    content += `${r.name}.m3u8\n`;
  }

  const masterPath = path.join(outputDir, "master.m3u8");
  fs.writeFileSync(masterPath, content);
  return masterPath;
}

async function transcodeToHLS(inputPath, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const rendition of RENDITIONS) {
    console.log(`Transcoding ${rendition.name}...`);
    await transcodeRendition(inputPath, outputDir, rendition);
    console.log(`Finished ${rendition.name}`);
  }

  const masterPath = generateMasterPlaylist(outputDir);
  console.log("Master playlist generated");

  return masterPath;
}

module.exports = { transcodeToHLS, getDuration, RENDITIONS };
