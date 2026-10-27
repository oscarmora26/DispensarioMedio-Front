import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface MedicationConfirmData {
  description: string;
  activate: boolean;
}

@Component({
  selector: 'dm-medication-confirm',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './medication-confirm.html',
  styleUrl: './medication-confirm.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationConfirmDialog {
  protected readonly data = inject<MedicationConfirmData>(MAT_DIALOG_DATA);
}
