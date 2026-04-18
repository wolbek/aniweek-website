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

  project_id             = var.project_id
  region                 = var.region
  raw_bucket_name        = var.raw_bucket_name
  transcoded_bucket_name = var.transcoded_bucket_name
}

module "pubsub" {
  source = "./modules/pubsub"

  project_id            = var.project_id
  region                = var.region
  topic_name            = var.pubsub_topic_name
  push_endpoint         = module.cloud_run.service_url
  service_account_email = var.service_account_email
}

module "cdn" {
  source = "./modules/cdn"

  transcoded_bucket_name = module.storage.transcoded_bucket_name
}

module "cloud_run" {
  source = "./modules/cloud-run"

  project_id            = var.project_id
  region                = var.region
  service_account_email = var.service_account_email
  worker_image          = var.worker_image
  mongodb_uri           = var.mongodb_uri
  cdn_base_url          = var.cdn_base_url

  raw_bucket_name        = var.raw_bucket_name
  transcoded_bucket_name = var.transcoded_bucket_name
}
