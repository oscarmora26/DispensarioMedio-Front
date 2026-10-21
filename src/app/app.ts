import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppShell } from './core/layout/app-shell';

@Component({
  imports: [AppShell],
  selector: 'dm-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
