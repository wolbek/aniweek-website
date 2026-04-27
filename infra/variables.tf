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

variable "zone" {
  description = "GCP zone for compute resources"
  type        = string
  default     = "asia-south1-b"
}

variable "vm_name" {
  description = "Name of the GCE VM instance"
  type        = string
  default     = "aniweek-vm"
}

variable "machine_type" {
  description = "GCE machine type for the VM"
  type        = string
  default     = "e2-small"
}