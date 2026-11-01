import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Footer } from '../footer/footer';
import { BannerHost } from '../banner-host/banner-host';

@Component({
  standalone: true,
  selector: 'app-main',
  imports: [RouterOutlet, Footer, BannerHost],
  templateUrl: './main.html',
  styleUrl: './main.scss',
})
export class Main {}
