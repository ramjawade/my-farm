import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  protected readonly year = new Date().getFullYear();
  protected readonly version = environment.appVersion;
  protected readonly build = environment.buildStamp;
}
