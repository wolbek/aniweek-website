variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "raw_bucket_name" {
  type = string
}

variable "transcoded_bucket_name" {
  type = string
}

resource "google_storage_bucket" "raw" {
  name          = var.raw_bucket_name
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
    method          = ["PUT", "GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "transcoded" {
  name          = var.transcoded_bucket_name
  project       = var.project_id
  location      = var.region
  storage_class = "STANDARD"
  force_destroy = true

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length", "Accept-Ranges", "Content-Range", "Range"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "transcoded_public_read" {
  bucket = google_storage_bucket.transcoded.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

output "raw_bucket_url" {
  value = google_storage_bucket.raw.url
}

output "raw_bucket_name" {
  value = google_storage_bucket.raw.name
}

output "transcoded_bucket_url" {
  value = google_storage_bucket.transcoded.url
}

output "transcoded_bucket_name" {
  value = google_storage_bucket.transcoded.name
}
