variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "vm_name" {
  description = "Name of the GCE instance"
  type        = string
  default     = "aniweek-vm"
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "e2-small"
}

variable "network" {
  description = "VPC network name"
  type        = string
  default     = "default"
}
