import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-crop-timeline',
  imports: [RouterOutlet],
  templateUrl: './crop-timeline.component.html',
  styleUrl: './crop-timeline.component.scss',
})
export class CropTimelineComponent {}
