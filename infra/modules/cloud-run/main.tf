variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_account_email" {
  type = string
}

variable "worker_image" {
  type = string
}

variable "mongodb_uri" {
  type      = string
  sensitive = true
}

variable "cdn_base_url" {
  type = string
}

variable "raw_bucket_name" {
  type = string
}

variable "transcoded_bucket_name" {
  type = string
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "worker"
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account_email

    containers {
      image = var.worker_image

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
      }

      env {
        name  = "GCS_RAW_BUCKET"
        value = var.raw_bucket_name
      }
      env {
        name  = "GCS_TRANSCODED_BUCKET"
        value = var.transcoded_bucket_name
      }
      env {
        name  = "CDN_BASE_URL"
        value = var.cdn_base_url
      }
      env {
        name  = "MONGODB_URI"
        value = var.mongodb_uri
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    timeout = "1800s"
  }
}

output "service_url" {
  value = google_cloud_run_v2_service.worker.uri
}

output "service_name" {
  value = google_cloud_run_v2_service.worker.name
}
