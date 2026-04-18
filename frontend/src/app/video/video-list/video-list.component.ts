import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VideoService, Video } from '../video.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-list.component.html',
  styleUrl: './video-list.component.scss',
})
export class VideoListComponent implements OnInit {
  private videoService = inject(VideoService);
  private router = inject(Router);

  videos = signal<Video[]>([]);
  loading = signal(true);
  currentPage = signal(1);
  totalPages = signal(1);

  async ngOnInit() {
    await this.loadPage(1);
  }

  async loadPage(page: number) {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.videoService.listVideos(page));
      this.videos.set(response.videos);
      this.currentPage.set(response.pagination.page);
      this.totalPages.set(response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load videos', err);
    } finally {
      this.loading.set(false);
    }
  }

  openVideo(video: Video) {
    if (video.status === 'ready') {
      this.router.navigate(['/video', video.videoId]);
    }
  }

  goToUpload() {
    this.router.navigate(['/video', 'upload']);
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
