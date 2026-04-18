const { PubSub } = require("@google-cloud/pubsub");

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
const topic = pubsub.topic(process.env.PUBSUB_TOPIC);

async function publishVideoUploadEvent({ videoId, objectPath }) {
  if (!videoId || !objectPath) {
    throw new Error("videoId and objectPath are required to publish video");
  }
  const data = JSON.stringify({ videoId, objectPath });
  const messageId = await topic.publishMessage({ data: Buffer.from(data) });
  return messageId;
}

module.exports = { publishVideoUploadEvent };
