variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

variable "raw_bucket_name" {
  description = "GCS bucket for raw video uploads"
  type        = string
}

variable "transcoded_bucket_name" {
  description = "GCS bucket for transcoded video output"
  type        = string
}

variable "pubsub_topic_name" {
  description = "Pub/Sub topic for video upload events"
  type        = string
}

variable "worker_image" {
  description = "Container image for the transcoding worker (e.g. gcr.io/PROJECT/worker:latest)"
  type        = string
}

variable "mongodb_uri" {
  description = "MongoDB connection URI for the worker"
  type        = string
  sensitive   = true
}

variable "cdn_base_url" {
  description = "Base URL for CDN-served transcoded content (set after first apply)"
  type        = string
}

variable "service_account_email" {
  description = "Single service account email used across services"
  type        = string
}
