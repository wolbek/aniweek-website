import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VideoService } from '../video.service';
import { firstValueFrom } from 'rxjs';

type UploadStep = 'select' | 'uploading' | 'processing' | 'ready' | 'failed';

@Component({
  selector: 'app-video-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-upload.component.html',
  styleUrls: ['./video-upload.component.scss'],
})
export class VideoUploadComponent {
  private videoService = inject(VideoService);
  private router = inject(Router);

  step = signal<UploadStep>('select');
  isDragOver = signal(false);
  uploadProgress = signal(0);
  selectedFileName = signal('');
  errorMessage = signal('');
  currentVideoId = signal('');

  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave() {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.startUpload(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.startUpload(file);
    input.value = '';
  }

  private async startUpload(file: File) {
    this.errorMessage.set('');

    if (!file.type.startsWith('video/')) {
      this.errorMessage.set('Please select a video file.');
      return;
    }
    if (file.size > this.MAX_FILE_SIZE) {
      this.errorMessage.set('File exceeds the 2 GB size limit.');
      return;
    }

    this.selectedFileName.set(file.name);
    this.step.set('uploading');
    this.uploadProgress.set(0);

    try {
      const { videoId, signedUrl } = await firstValueFrom(
        this.videoService.requestUploadUrl(file.name, file.type),
      );
      this.currentVideoId.set(videoId);

      await this.videoService.uploadToGCS(signedUrl, file, (percent) => {
        this.uploadProgress.set(percent);
      });

      await firstValueFrom(this.videoService.confirmUpload(videoId));

      this.step.set('processing');
      this.pollStatus(videoId);
    } catch (err: any) {
      // console.log("Error message",err.message);
      console.log(err);
      this.errorMessage.set(err.error.message || 'Upload failed');
      this.step.set('failed');
    }
  }

  private pollStatus(videoId: string) {
    this.pollTimer = setInterval(async () => {
      try {
        const video = await firstValueFrom(this.videoService.getVideo(videoId));
        if (video.status === 'ready') {
          this.stopPolling();
          this.step.set('ready');
        } else if (video.status === 'failed') {
          this.stopPolling();
          this.errorMessage.set(video.errorMessage || 'Transcoding failed');
          this.step.set('failed');
        }
      } catch {
        // keep polling on transient errors
      }
    }, 5000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  goToVideo() {
    this.router.navigate(['/video', this.currentVideoId()]);
  }

  reset() {
    this.stopPolling();
    this.step.set('select');
    this.uploadProgress.set(0);
    this.selectedFileName.set('');
    this.errorMessage.set('');
    this.currentVideoId.set('');
  }
}
