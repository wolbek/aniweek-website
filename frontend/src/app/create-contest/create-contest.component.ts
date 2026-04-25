import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-create-contest',
  imports: [],
  templateUrl: './create-contest.component.html',
  styleUrl: './create-contest.component.scss',
})
export class CreateContestComponent {
  isModalVisible = signal<boolean>(false);

  showModal() {
    this.isModalVisible.set(this.isModalVisible() ? false : true);
  }
}
