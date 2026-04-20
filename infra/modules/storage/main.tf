variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "sketches_bucket_name" {
  type = string
}

resource "google_storage_bucket" "sketches" {
  name          = var.sketches_bucket_name
  project       = var.project_id
  location      = var.region
  storage_class = "STANDARD"
  force_destroy = true

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["PUT", "GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length", "Content-Disposition"]
    max_age_seconds = 3600
  }
}

# Public read access so the frontend can fetch images and videos directly
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.sketches.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

output "sketches_bucket_name" {
  value = google_storage_bucket.sketches.name
}

output "sketches_bucket_url" {
  value = google_storage_bucket.sketches.url
}

