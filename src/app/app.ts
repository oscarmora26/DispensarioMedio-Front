import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [MatIconModule, MatToolbarModule, RouterOutlet],
  selector: 'dm-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
