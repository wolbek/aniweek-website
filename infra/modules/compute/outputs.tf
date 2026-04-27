output "vm_name" {
  description = "Name of the GCE instance"
  value       = google_compute_instance.aniweek.name
}

output "vm_external_ip" {
  description = "Static external IP of the VM"
  value       = google_compute_address.static_ip.address
}
