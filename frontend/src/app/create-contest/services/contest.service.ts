import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface Contest {
  _id: string;
  characterName: string;
  characterImage: string;
  characterDescription: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive';
}

interface ActiveContestResponse {
  contest: Contest | null;
}

export interface CharacterData {
  characterName: string;
  characterImage: string;
  characterDescription: string;
}

export interface WinnerEntry {
  rank: number;
  prize: string;
  displayName: string;
  photo: string | null;
  sketchImageUrl: string | null;
}
export interface PrevContestWinnersResponse {
  characterName: string;
  characterImage: string;
  endDate: string;
  winners: WinnerEntry[];
}

interface JikanCharacterResponse {
  data: {
    name: string;
    images: { jpg: { image_url: string } };
    about: string | null;
  };
}

interface JikanSearchResponse {
  data: Array<{
    name: string;
    images: { jpg: { image_url: string } };
    about: string | null;
  }>;
}

const JIKAN_BASE = 'https://api.jikan.moe/v4';

@Injectable({
  providedIn: 'root',
})
export class ContestService {
  private http = inject(HttpClient);

  fetchRandomCharacter(): Observable<CharacterData> {
    return this.http.get<JikanCharacterResponse>(`${JIKAN_BASE}/random/characters`).pipe(
      map((res) => ({
        characterName: res.data.name,
        characterImage: res.data.images.jpg.image_url,
        characterDescription: res.data.about || 'No description available.',
      })),
    );
  }

  searchCharacter(query: string): Observable<{ results: CharacterData[] }> {
    return this.http
      .get<JikanSearchResponse>(`${JIKAN_BASE}/characters`, {
        params: { q: query, limit: '10' },
      })
      .pipe(
        map((res) => ({
          results: (res.data || [])
            .filter((c) => c?.name && c?.images?.jpg?.image_url)
            .map((c) => ({
              characterName: c.name,
              characterImage: c.images.jpg.image_url,
              characterDescription: c.about || 'No description available.',
            })),
        })),
      );
  }

  getActiveContest(): Observable<ActiveContestResponse> {
    return this.http.get<ActiveContestResponse>('/api/contest/active');
  }

  createContest(characterData: CharacterData) {
    return this.http.post<CharacterData>('/api/contest', { characterData });
  }

  cancelContest() {
    return this.http.post('/api/contest/cancel', {});
  }

  getPrevContestWinners(): Observable<PrevContestWinnersResponse | null> {
    return this.http.get<PrevContestWinnersResponse | null>('/api/contest/prev-winners');
  }
}
