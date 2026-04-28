terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "storage" {
  source = "./modules/storage"

  project_id           = var.project_id
  region               = var.region
  sketches_bucket_name = var.sketches_bucket_name
}

module "artifact_registry" {
  source = "./modules/artifact-registry"

  project_id      = var.project_id
  region          = var.region
  repository_name = var.repository_name
}

module "compute" {
  source = "./modules/compute"

  project_id   = var.project_id
  region       = var.region
  zone         = var.zone
  vm_name      = var.vm_name
  machine_type = var.machine_type
  service_account_email = var.service_account_email
}