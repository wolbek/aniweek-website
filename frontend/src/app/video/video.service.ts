import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Video {
  videoId: string;
  userId: string;
  originalFileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
  duration?: number;
  thumbnailURL?: string;
  manifestURL?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadUrlResponse {
  videoId: string;
  signedUrl: string;
  objectPath: string;
}

export interface VideoListResponse {
  videos: Video[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private http = inject(HttpClient);

  requestUploadUrl(
    fileName: string,
    contentType: string,
  ): Observable<UploadUrlResponse> {
    return this.http.get<UploadUrlResponse>('/api/video/upload-url', {
      params: { fileName, contentType },
    });
    /*
    On error all this is returned:

    Observable Error Stream: Instead of emitting a value to the next callback, the Observable triggers the error callback of your subscription.
    HttpErrorResponse Object: This object contains technical details about the failure, including:
      Status Code: For example, 404 (Not Found), 500 (Server Error), or 0 (Network/Connection issue).
      Error Message: A developer-friendly description of what went wrong.
      Error Body: Any data or JSON error response sent back by your server.
    */
  }

  uploadToGCS(
    signedUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.send(file);
    });
  }

  confirmUpload(videoId: string): Observable<{ videoId: string; status: string }> {
    return this.http.post<{ videoId: string; status: string }>(
      `/api/video/${videoId}/confirm-upload`,
      {},
    );
  }

  getVideo(videoId: string): Observable<Video> {
    return this.http.get<Video>(`/api/video/${videoId}`);
  }

  listVideos(page = 1, limit = 20): Observable<VideoListResponse> {
    return this.http.get<VideoListResponse>('/api/video', {
      params: { page: page.toString(), limit: limit.toString() },
    });
  }
}
