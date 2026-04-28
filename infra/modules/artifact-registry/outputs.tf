output "repository_url" {
  description = "Full Docker registry URL for pushing/pulling images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}

output "repository_name" {
  description = "Name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.docker.repository_id
}
