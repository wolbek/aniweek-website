import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class ContestService {
  private http = inject(HttpClient);

  fetchRandomCharacter(): Observable<CharacterData> {
    return this.http.get<CharacterData>('/api/contest/random-character');
  }

  getActiveContest(): Observable<ActiveContestResponse> {
    return this.http.get<ActiveContestResponse>('/api/contest/active');
  }

  createContest(characterData: CharacterData) {
    return this.http.post<CharacterData>('api/contest', { characterData });
  }

  cancelContest() {
    return this.http.post('/api/contest/cancel', {});
  }

  getPrevContestWinners(): Observable<PrevContestWinnersResponse | null> {
    return this.http.get<PrevContestWinnersResponse | null>('/api/contest/prev-winners');
  }
}
