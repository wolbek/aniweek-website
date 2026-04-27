output "sketches_bucket_name" {
  description = "Name of the GCS bucket holding sketch images and creation videos"
  value       = module.storage.sketches_bucket_name
}

output "sketches_bucket_url" {
  description = "GCS URL of the sketches bucket"
  value       = module.storage.sketches_bucket_url
}

output "vm_name" {
  description = "Name of the deployed GCE instance"
  value       = module.compute.vm_name
}

output "vm_external_ip" {
  description = "Static external IP of the VM"
  value       = module.compute.vm_external_ip
}