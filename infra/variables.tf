variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

variable "sketches_bucket_name" {
  description = "GCS bucket for user sketch images and creation videos"
  type        = string
}