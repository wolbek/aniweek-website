resource "google_compute_address" "static_ip" {
  name    = "${var.vm_name}-ip"
  project = var.project_id
  region  = var.region
}

resource "google_compute_firewall" "allow_http" {
  name    = "${var.vm_name}-allow-http"
  project = var.project_id
  network = var.network

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
}

resource "google_compute_instance" "aniweek" {
  name         = var.vm_name
  project      = var.project_id
  zone         = var.zone
  machine_type = var.machine_type

  tags = ["http-server", "https-server"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-standard"
    }
  }

  network_interface {
    network = var.network

    access_config {
      nat_ip = google_compute_address.static_ip.address
    }
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    set -e

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
      apt-get update
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
      apt-get update
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable docker
      systemctl start docker
    fi

    # Install gcloud CLI if not present (needed for Docker credential helper)
    if ! command -v gcloud &> /dev/null; then
      curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
      echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list
      apt-get update
      apt-get install -y google-cloud-cli
    fi

    # Configure Docker to authenticate with Artifact Registry
    gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet

    # Prepare project directory
    mkdir -p /opt/aniweek

    echo "Docker, Docker Compose, and Artifact Registry auth are ready."
    echo "Deploy by pulling images: cd /opt/aniweek && docker compose pull && docker compose up -d"
  SCRIPT

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  allow_stopping_for_update = true
}
