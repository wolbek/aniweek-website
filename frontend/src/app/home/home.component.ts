import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { CommonModule, DatePipe } from '@angular/common';
import { SketchService } from './services/sketch.service';
import { LivechatComponent } from '../livechat/livechat.component';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

import { Sketch, Sketches } from './services/sketch.service';
import { FormsModule } from '@angular/forms';
import { CreateContestComponent } from '../create-contest/create-contest.component';
import {
  Contest,
  ContestService,
  PrevContestWinnersResponse,
} from '../create-contest/services/contest.service';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-home',
  imports: [
    LivechatComponent,
    DatePipe,
    FormsModule,
    CreateContestComponent,
    CommonModule,
    RouterLink,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);

  private sketchService = inject(SketchService);
  private contestService = inject(ContestService);

  loadingContest = signal(true);
  activeContest = signal<Contest | null>(null);

  ngOnInit(): void {
    this.loadActiveContest();
  }

  loadActiveContest(): void {
    this.loadingContest.set(true);
    this.contestService.getActiveContest().subscribe({
      next: (res) => {
        this.activeContest.set(res.contest);
        this.loadingContest.set(false);

        if (res.contest) {
          this.loadSketches();
          this.loadMySketch();
          this.countdownVisible.set(true);
          this.startCountDown(res.contest.startDate, res.contest.endDate);
        } else {
          this.loadPrevContestWinners();
          this.countdownVisible.set(false);
        }
      },
      error: () => {
        this.activeContest.set(null);
        this.loadingContest.set(false);
        this.loadPrevContestWinners();
      },
    });
  }

  // Show contest winners
  prevContestWinners = signal<PrevContestWinnersResponse | null>(null);
  loadingWinners = signal(false);
  // We don't show error here. We just skip showing if any errors

  loadPrevContestWinners(): void {
    this.loadingWinners.set(true);
    this.contestService.getPrevContestWinners().subscribe({
      next: (res) => {
        this.prevContestWinners.set(res);
        this.loadingWinners.set(false);
      },
      error: () => {
        this.prevContestWinners.set(null);
        this.loadingWinners.set(false);
      },
    });
  }

  // See more
  isExpanded = signal<boolean>(false);

  toggleExpand() {
    this.isExpanded.set(this.isExpanded() ? false : true);
  }

  // Timer

  countdownVisible = signal<boolean>(false);
  countdownDays = signal(0);
  countdownHours = signal(0);
  countdownMinutes = signal(0);
  countdownSeconds = signal(0);

  contestEnded = signal(false); // No need but just calculating it for now. May use in future

  startCountDown(startDateStr: string, endDateStr: string) {
    this.contestEnded.set(false);
    const tick = () => {
      const now = Date.now();
      const end = new Date(endDateStr).getTime();

      const diff = end - now;

      this.countdownDays.set(Math.floor(diff / (1000 * 60 * 60 * 24)));
      this.countdownHours.set(Math.floor((diff / (1000 * 60 * 60)) % 24));
      this.countdownMinutes.set(Math.floor((diff / (1000 * 60)) % 60));
      this.countdownSeconds.set(Math.floor((diff / 1000) % 60));
    };
    setInterval(tick, 1000);
  }

  // Image Select

  imageSelected = signal<File | null>(null);
  imagePreviewUrl = signal<string | null>(null);
  imageError = signal<string | null>(null);

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const image = input.files?.[0] ?? null;
    this.imageError.set(null);

    if (this.imagePreviewUrl()) {
      URL.revokeObjectURL(this.imagePreviewUrl()!);
    }

    if (image && image.size > MAX_IMAGE_SIZE) {
      this.imageError.set('Image must be under 2MB');
      this.imageSelected.set(null);
      this.imagePreviewUrl.set(null);
      input.value = '';
      return;
    }

    if (image && !image.type.startsWith('image/')) {
      this.imageError.set('Please select a valid image file (jpeg, png or webp)');
      this.imageSelected.set(null);
      this.imagePreviewUrl.set(null);
      input.value = '';
      return;
    }

    this.imageSelected.set(image);
    this.imagePreviewUrl.set(image ? URL.createObjectURL(image) : null);
    this.imageError.set(null);
  }

  // Video Select

  videoSelected = signal<File | null>(null);
  videoPreviewUrl = signal<string | null>(null);
  videoError = signal<string | null>(null);

  onVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const video = input.files?.[0] ?? null;
    this.videoError.set(null);

    if (this.videoPreviewUrl()) {
      URL.revokeObjectURL(this.videoPreviewUrl()!);
    }

    if (video && video.size > MAX_VIDEO_SIZE) {
      this.videoError.set('Video must be under 30 MB.');
      this.videoSelected.set(null);
      this.videoPreviewUrl.set(null);
      input.value = '';
      return;
    }

    if (video && !video.type.startsWith('video/')) {
      this.videoError.set('Please select a valid video file (jpeg, png or webp)');
      this.videoSelected.set(null);
      this.videoPreviewUrl.set(null);
      input.value = '';
      return;
    }

    this.videoSelected.set(video);
    this.videoPreviewUrl.set(video ? URL.createObjectURL(video) : null);
    this.videoError.set(null);
  }

  // Image & Video upload (should happen after select)

  uploading = signal(false);
  uploadError = signal<string | null>(null);

  // Check if can upload

  canUpload(): boolean {
    return !!this.imageSelected() && !!this.videoSelected() && !this.uploading();
  }

  onUploadClick(): void {
    if (!this.canUpload()) return;

    const image = this.imageSelected();
    const video = this.videoSelected();

    if (!image || !video) return;

    this.uploading.set(true);
    this.uploadError.set(null);

    this.sketchService.upload(image, video).subscribe({
      next: () => {
        this.uploading.set(false);
        this.clearSelection();
        this.loadSketches();
        this.loadMySketch();
      },
      error: (err) => {
        this.uploadError.set(err.error?.message ?? 'Upload failed. Please try again.');
        this.uploading.set(false);
      },
    });
  }

  // Clear the form on upload

  clearSelection(): void {
    if (this.imagePreviewUrl()) {
      URL.revokeObjectURL(this.imagePreviewUrl()!);
    }

    if (this.videoPreviewUrl()) {
      URL.revokeObjectURL(this.videoPreviewUrl()!);
    }

    this.imageSelected.set(null);
    this.imagePreviewUrl.set(null);
    this.imageError.set(null);
    this.videoSelected.set(null);
    this.videoPreviewUrl.set(null);
    this.videoError.set(null);
    this.uploadError.set(null);
  }

  // Loading drawings after upload

  loadingSketches = signal(false);
  sketches = signal<Sketch[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);

  loadSketches(page: number = 1) {
    this.loadingSketches.set(true);
    this.sketchService.fetchSketches(page).subscribe({
      next: (res: Sketches) => {
        this.sketches.set(res.sketches);
        this.currentPage.set(res.page);
        this.totalPages.set(res.totalPages);
        this.loadingSketches.set(false);
      },
      error: () => {
        this.sketches.set([]);
        this.loadingSketches.set(false);
      },
    });
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.loadSketches(page);
  }

  // Load user's sketch (gets used to update myExistingSketch which gets used in component.html)

  myExistingSketch = signal<Sketch | null>(null);

  loadMySketch() {
    this.sketchService.fetchMySketch().subscribe({
      next: (sketch) => this.myExistingSketch.set(sketch),
      error: () => this.myExistingSketch.set(null),
    });
  }

  // Open and close image

  activeImageUrl = signal<string | null>(null);

  openImage(imageUrl: string): void {
    this.activeImageUrl.set(imageUrl);
  }

  closeImage(): void {
    this.activeImageUrl.set(null);
  }

  // Open and close video

  activeVideoUrl = signal<string | null>(null);

  openVideo(videoUrl: string): void {
    this.activeVideoUrl.set(videoUrl);
  }

  closeVideo(): void {
    this.activeVideoUrl.set(null);
  }

  // Vote
  toggleVote(sketch: Sketch): void {
    if (sketch.rejected) return;

    const res = sketch.hasVoted
      ? this.sketchService.unvote(sketch._id)
      : this.sketchService.vote(sketch._id);

    res.subscribe({
      next: (res) => {
        this.sketches.update((list) => {
          return list.map((sk) => {
            return sk._id === sketch._id ? { ...sk, votes: res.votes, hasVoted: res.hasVoted } : sk;
          });
        });
      },
    });
  }

  // Is Admin
  isAdmin(): boolean {
    return this.auth.userDataSignal()?.role === 'admin';
  }

  // Delete sketch
  deleting = signal(false);
  deleteSketchId = signal<string | null>(null);

  requestDelete(sketch: Sketch): void {
    this.deleteSketchId.set(sketch._id);
  }

  confirmDelete(): void {
    const id = this.deleteSketchId();
    if (!id) return;
    this.deleting.set(true);

    this.sketchService.deleteSketch(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteSketchId.set(null);
        this.sketches.update((list) => {
          return list.filter((sk) => sk._id !== id);
        });
      },
      error: () => {
        this.deleting.set(false);
        this.deleteSketchId.set(null);
      },
    });
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.deleteSketchId.set(null);
  }

  // Reject sketch

  rejectingSketch = signal<Sketch | null>(null);
  rejectReason = signal<string>('');
  rejecting = signal(false);
  rejectError = signal<string | null>(null);

  openRejectForm(sketch: Sketch): void {
    this.rejectingSketch.set(sketch);
    this.rejectReason.set('');
    this.rejectError.set(null);
  }

  cancelReject(): void {
    if (this.rejecting()) return;
    this.rejectingSketch.set(null);
    this.rejectReason.set('');
    this.rejectError.set(null);
  }

  submitReject(): void {
    const sketchId = this.rejectingSketch()?._id;
    const reason = this.rejectReason().trim();

    if (!sketchId || !reason) return;

    this.rejecting.set(true);
    this.rejectError.set(null);

    this.sketchService.rejectSketch(sketchId, reason).subscribe({
      next: () => {
        this.rejecting.set(false);
        this.rejectingSketch.set(null);
        this.rejectReason.set('');
        this.sketches.update((list) => {
          return list.map((sk) => {
            if (sk._id === sketchId) sk.rejected = true;
            return sk;
          });
        });
      },
      error: (err) => {
        this.rejecting.set(false);
        this.rejectError.set(err.error?.message ?? 'Failed to mark as rejected. Please try again.');
        this.rejectingSketch.set(null);
        this.rejectReason.set('');
      },
    });
  }

  unreject(sketch: Sketch): void {
    this.sketchService.unrejectSketch(sketch._id).subscribe({
      next: () => {
        this.sketches.update((list) => {
          return list.map((sk) => {
            if (sk._id === sketch._id) {
              sk.rejected = false;
            }
            return sk;
          });
        });
      },
    });
  }

  onContestToggled(): void {
    this.loadActiveContest();
  }

  logout(): void {
    this.auth.logout();
  }
}
