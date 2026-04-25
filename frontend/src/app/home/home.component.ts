import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../auth/services/auth.service';
import { DatePipe } from '@angular/common';
import { SketchService } from './services/sketch.service';
import { LivechatComponent } from '../livechat/livechat.component';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB

import { Sketch, Sketches } from './services/sketch.service';
import { FormsModule } from '@angular/forms';
import { CreateContestComponent } from '../create-contest/create-contest.component';
import { Contest, ContestService } from '../create-contest/services/contest.service';
@Component({
  selector: 'app-home',
  imports: [LivechatComponent, DatePipe, FormsModule, CreateContestComponent],
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
        }
      },
      error: () => {
        this.activeContest.set(null);
        this.loadingContest.set(false);
      },
    });
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

  loadSketches() {
    this.loadingSketches.set(true);
    this.sketchService.fetchSketches().subscribe({
      next: (res: Sketches) => {
        this.sketches.set(res.sketches);
        this.loadingSketches.set(false);
      },
      error: () => {
        this.sketches.set([]);
        this.loadingSketches.set(false);
      },
    });
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
