variable "project_id" {
  type = string
}

variable "topic_name" {
  type = string
}

variable "region" {
  type = string
}

variable "push_endpoint" {
  description = "Cloud Run service URL to push messages to"
  type        = string
}

variable "service_account_email" {
  description = "Service account used for Pub/Sub push OIDC and Cloud Run invocation"
  type        = string
}

resource "google_pubsub_topic" "video_upload" {
  name    = var.topic_name
  project = var.project_id

  message_retention_duration = "86400s"
}

resource "google_pubsub_subscription" "worker_push" {
  name    = "${var.topic_name}-worker-push"
  project = var.project_id
  topic   = google_pubsub_topic.video_upload.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = var.push_endpoint

    oidc_token {
      service_account_email = var.service_account_email
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  expiration_policy {
    ttl = ""
  }
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  name     = "worker"
  project  = var.project_id
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.service_account_email}"
}

output "topic_name" {
  value = google_pubsub_topic.video_upload.name
}

output "topic_id" {
  value = google_pubsub_topic.video_upload.id
}

output "subscription_name" {
  value = google_pubsub_subscription.worker_push.name
}
