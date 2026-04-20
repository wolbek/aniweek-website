const { Storage } = require("@google-cloud/storage");

const BUCKET_NAME = process.env.GCS_BUCKET;
if (!BUCKET_NAME) {
  console.warn(
    "[gcs] GCS_BUCKET env var is not set; uploads and reads will fail.",
  );
}

const storage = new Storage();
const bucket = BUCKET_NAME ? storage.bucket(process.env.GCS_BUCKET) : null;

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

async function generateSignedUploadUrl(objectPath, contentType) {
  if (!bucket) throw new Error("GCS bucket is not configured");
  const [url] = await bucket.file(objectPath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType,
  });
  return url;
}

async function objectExists(objectPath) {
  if (!bucket || !objectPath) return false;
  try {
    const [exists] = await bucket.file(objectPath).exists();
    return exists;
  } catch (err) {
    console.error("[gcs] exists check failed for", objectPath, err.message);
    return false;
  }
}

function publicUrlForObject(objectPath) {
  if (!objectExists(objectPath)) return null;
  return `https://storage.googleapis.com/${BUCKET_NAME}/${encodeURI(objectPath)}`;
}

async function deleteObject(objectPath) {
  if (!objectExists(objectPath)) return;
  try {
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch (err) {
    console.error("[gcs] delete failed for", objectPath, err.message);
    throw err;
  }
}

module.exports = {
  generateSignedUploadUrl,
  objectExists,
  publicUrlForObject,
  deleteObject,
};
