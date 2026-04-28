import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';

export interface Sketch {
  _id: string;
  displayName: string;
  photo: string;
  imageUrl: string;
  videoUrl: string;
  createdAt: string;
  votes: number;
  isOwner: boolean;
  hasVoted: boolean;
  rejected: boolean;
  rejectedReason: string;
}

export interface Sketches {
  sketches: Sketch[];
  page: number;
  totalPages: number;
  totalCount: number;
}

interface VoteResponse {
  votes: number;
  hasVoted: boolean;
}

interface UploadUrlsResponse {
  image: {
    signedUrl: string;
    objectPath: string;
    contentType: string;
  };
  video: {
    signedUrl: string;
    objectPath: string;
    contentType: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class SketchService {
  private http = inject(HttpClient);

  upload(image: File, video: File): Observable<Object> {
    return this.http
      .post<UploadUrlsResponse>('/api/sketch/upload-urls', {
        imageContentType: image.type,
        videoContentType: video.type,
      })
      .pipe(
        switchMap((res) => {
          return from(
            Promise.all([
              this.putToGcs(res.image.signedUrl, image),
              this.putToGcs(res.video.signedUrl, video),
            ]),
          ).pipe(
            switchMap(() => {
              return this.http.post('/api/sketch', {
                image: {
                  objectPath: res.image.objectPath,
                  contentType: res.image.contentType,
                  size: image.size,
                },
                video: {
                  objectPath: res.video.objectPath,
                  contentType: res.video.contentType,
                  size: video.size,
                },
              });
            }),
          );
        }),
      );
  }

  async putToGcs(signedUrl: string, file: File): Promise<void> {
    const res = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload to storage failed (${res.status}): ${text}`);
    }
  }

  fetchSketches(page: number = 1): Observable<Sketches> {
    return this.http.get<Sketches>('/api/sketch', { params: { page: page.toString() } });
  }

  fetchMySketch(): Observable<Sketch> {
    return this.http.get<Sketch>('/api/sketch/me');
  }

  vote(sketchId: string): Observable<VoteResponse> {
    return this.http.post<VoteResponse>(`/api/sketch/vote/${sketchId}`, {});
  }

  unvote(sketchId: string): Observable<VoteResponse> {
    return this.http.delete<VoteResponse>(`/api/sketch/vote/${sketchId}`);
  }

  deleteSketch(sketchId: string): Observable<void> {
    return this.http.delete<void>(`/api/sketch/${sketchId}`);
  }

  rejectSketch(sketchId: string, reason: string) {
    return this.http.post(`/api/sketch/reject/${sketchId}`, { rejectReason: reason });
  }

  unrejectSketch(sketchId: string) {
    return this.http.delete(`/api/sketch/reject/${sketchId}`);
  }
}
