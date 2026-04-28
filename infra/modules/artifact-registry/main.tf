resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repository_name
  format        = "DOCKER"
  description   = "Docker images for AniWeek frontend and backend"

  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-latest-3"
    action = "KEEP"

    most_recent_versions {
      keep_count = 3
    }
  }
}
