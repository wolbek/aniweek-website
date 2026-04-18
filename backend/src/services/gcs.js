const { Storage } = require("@google-cloud/storage");

const storage = new Storage();
const rawBucket = storage.bucket(process.env.GCS_RAW_BUCKET);

async function generateSignedUploadUrl(objectPath, contentType) {
  const [url] = await rawBucket.file(objectPath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });
  return url;
}

async function deleteFileFromGCS(objectPath) {
  try {
    await rawBucket.file(objectPath).delete();
  } catch (err) {
    if (err.code === 404) return;
    throw err;
  }
}

module.exports = { generateSignedUploadUrl, deleteFileFromGCS };
