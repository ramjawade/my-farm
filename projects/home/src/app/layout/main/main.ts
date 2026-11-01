import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Footer } from '../footer/footer';
import { OfflineBanner } from '../offline-banner/offline-banner';

@Component({
  standalone: true,
  selector: 'app-main',
  imports: [RouterOutlet, Footer, OfflineBanner],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {}
