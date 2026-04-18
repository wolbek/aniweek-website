variable "transcoded_bucket_name" {
  type = string
}

resource "google_compute_backend_bucket" "transcoded" {
  name        = "aniweek-video-cdn-backend"
  bucket_name = var.transcoded_bucket_name
  enable_cdn  = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 86400
    max_ttl                      = 604800
    signed_url_cache_max_age_sec = 0
  }
}

resource "google_compute_url_map" "cdn" {
  name            = "aniweek-video-cdn-url-map"
  default_service = google_compute_backend_bucket.transcoded.id
}

resource "google_compute_target_http_proxy" "cdn" {
  name    = "aniweek-video-cdn-proxy"
  url_map = google_compute_url_map.cdn.id
}

resource "google_compute_global_address" "cdn" {
  name = "aniweek-video-cdn-ip"
}

resource "google_compute_global_forwarding_rule" "cdn" {
  name       = "aniweek-video-cdn-forwarding"
  target     = google_compute_target_http_proxy.cdn.id
  ip_address = google_compute_global_address.cdn.address
  port_range = "80"
}

output "cdn_ip_address" {
  value = google_compute_global_address.cdn.address
}

output "cdn_url" {
  value = "http://${google_compute_global_address.cdn.address}"
}
