import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { VideoService, Video } from '../video.service';
import { firstValueFrom } from 'rxjs';
import Hls from 'hls.js';

interface QualityLevel {
  index: number;
  label: string;
  height: number;
}

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private videoService = inject(VideoService);

  videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  video = signal<Video | null>(null);
  loading = signal(true);
  error = signal('');
  qualityLevels = signal<QualityLevel[]>([]);
  currentQualityIndex = signal(-1);
  currentQualityLabel = signal('Auto');
  showQualityMenu = signal(false);

  private hls: Hls | null = null;

  async ngOnInit() {
    const videoId = this.route.snapshot.paramMap.get('id');
    if (!videoId) {
      this.error.set('No video ID provided');
      this.loading.set(false);
      return;
    }

    try {
      const video = await firstValueFrom(this.videoService.getVideo(videoId));
      this.video.set(video);

      if (video.status !== 'ready' || !video.manifestURL) {
        this.error.set(
          video.status === 'failed'
            ? `Processing failed: ${video.errorMessage || 'Unknown error'}`
            : 'Video is still being processed. Please check back later.',
        );
        this.loading.set(false);
        return;
      }

      this.loading.set(false);

      setTimeout(() => this.initPlayer(video.manifestURL!), 0);
    } catch {
      this.error.set('Failed to load video');
      this.loading.set(false);
    }
  }

  private initPlayer(manifestUrl: string) {
    const videoEl = this.videoRef()?.nativeElement;
    if (!videoEl) return;

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      this.hls.loadSource(manifestUrl);
      this.hls.attachMedia(videoEl);

      this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels: QualityLevel[] = data.levels.map((level, index) => ({
          index,
          label: `${level.height}p`,
          height: level.height,
        }));
        levels.sort((a, b) => b.height - a.height);
        this.qualityLevels.set(levels);
      });

      this.hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (this.currentQualityIndex() === -1) {
          const level = this.hls?.levels[data.level];
          this.currentQualityLabel.set(`Auto (${level?.height}p)`);
        }
      });

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              this.hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              this.hls?.recoverMediaError();
              break;
            default:
              this.error.set('A playback error occurred');
              this.hls?.destroy();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = manifestUrl;
    } else {
      this.error.set('HLS playback is not supported in this browser');
    }
  }

  toggleQualityMenu() {
    this.showQualityMenu.set(!this.showQualityMenu());
  }

  setQuality(index: number) {
    if (!this.hls) return;

    this.currentQualityIndex.set(index);
    this.showQualityMenu.set(false);

    if (index === -1) {
      this.hls.currentLevel = -1;
      this.currentQualityLabel.set('Auto');
    } else {
      this.hls.currentLevel = index;
      const level = this.hls.levels[index];
      this.currentQualityLabel.set(`${level.height}p`);
    }
  }

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  ngOnDestroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }
}
