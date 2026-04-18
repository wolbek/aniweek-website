output "raw_bucket_url" {
  description = "URL of the raw video upload bucket"
  value       = module.storage.raw_bucket_url
}

output "transcoded_bucket_url" {
  description = "URL of the transcoded video bucket"
  value       = module.storage.transcoded_bucket_url
}

output "pubsub_topic" {
  description = "Pub/Sub topic name for video upload events"
  value       = module.pubsub.topic_name
}

output "worker_service_url" {
  description = "Cloud Run worker service URL"
  value       = module.cloud_run.service_url
}

output "cdn_ip_address" {
  description = "Global IP address for CDN"
  value       = module.cdn.cdn_ip_address
}
