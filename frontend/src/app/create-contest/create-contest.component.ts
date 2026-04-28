import { Component, inject, input, output, signal } from '@angular/core';
import { Contest } from './services/contest.service';
import { CommonModule, DatePipe } from '@angular/common';
import { ContestService } from './services/contest.service';
import { CharacterData } from './services/contest.service';
import { FormsModule } from '@angular/forms';
import { LivechatService } from '../livechat/livechat.service';

@Component({
  selector: 'app-create-contest',
  imports: [DatePipe, CommonModule, FormsModule],
  templateUrl: './create-contest.component.html',
  styleUrl: './create-contest.component.scss',
})
export class CreateContestComponent {
  isModalVisible = signal<boolean>(false);
  activeContest = input<Contest | null>(null);
  contestService = inject(ContestService);
  chat = inject(LivechatService);
  character = signal<CharacterData | null>(null);
  loadingCharacter = signal(false);
  characterError = signal<string | null>(null);

  submitting = signal(false);
  submitError = signal<string | null>(null);

  cancelling = signal(false);
  cancelError = signal<string | null>(null);

  contestToggled = output<void>();

  // See more
  isExpanded = signal<boolean>(false);

  toggleExpand() {
    this.isExpanded.set(this.isExpanded() ? false : true);
  }

  // Create contest modal

  showModal() {
    this.isModalVisible.set(true);
    this.submitError.set(null);
    if (!this.character()) {
      this.rerollCharacter();
    }
  }

  closeModal() {
    this.isModalVisible.set(false);
  }

  // Search character
  searchQuery = '';
  searchResults = signal<CharacterData[]>([]);
  searchingCharacter = signal(false);
  searchError = signal<string | null>(null);

  searchCharacter(): void {
    const query = this.searchQuery.trim();
    if (!query) return;

    this.searchingCharacter.set(true);
    this.searchError.set(null);
    this.searchResults.set([]);

    this.contestService.searchCharacter(query).subscribe({
      next: (data) => {
        this.searchResults.set(data.results);
        this.searchingCharacter.set(false);
      },
      error: (err) => {
        this.searchError.set(err.error?.message ?? 'Failed to search characters');
        this.searchingCharacter.set(false);
      },
    });
  }

  selectCharacter(char: CharacterData): void {
    this.character.set(char);
    this.searchResults.set([]);
    this.searchQuery = '';
  }

  // Reroll character

  rerollCharacter() {
    this.loadingCharacter.set(true);
    this.characterError.set(null);

    this.contestService.fetchRandomCharacter().subscribe({
      next: (data) => {
        this.character.set(data);
        this.loadingCharacter.set(false);
      },
      error: (err) => {
        this.characterError.set(err.error?.message ?? 'Failed to fetch character');
        this.loadingCharacter.set(false);
        // The previous character stored in character() will stay
      },
    });
  }

  canSubmit(): boolean {
    return !!this.character() && !this.submitting();
  }

  submitContest(): void {
    const character = this.character();
    if (!character) return;

    this.submitting.set(true);
    this.submitError.set(null);

    this.contestService.createContest(character).subscribe({
      next: () => {
        this.submitting.set(false);
        this.isModalVisible.set(false);
        this.character.set(null);
        this.contestToggled.emit();
      },
      error: (err) => {
        this.submitError.set(err.error?.message ?? 'Failed to create contest');
        this.submitting.set(false);
        // this.character.set(null);
      },
    });
  }

  cancelContest(): void {
    this.cancelling.set(true);
    this.cancelError.set(null);

    this.contestService.cancelContest().subscribe({
      next: () => {
        this.cancelling.set(false);
        this.contestToggled.emit();
      },
      error: (err) => {
        this.cancelError.set(err.error?.message ?? 'Failed to cancel contest');
        this.cancelling.set(false);
      },
    });
  }
}
