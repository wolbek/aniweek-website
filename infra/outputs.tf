output "sketches_bucket_name" {
  description = "Name of the GCS bucket holding sketch images and creation videos"
  value       = module.storage.sketches_bucket_name
}

output "sketches_bucket_url" {
  description = "GCS URL of the sketches bucket"
  value       = module.storage.sketches_bucket_url
}