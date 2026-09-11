import { Component, inject } from '@angular/core';
import { EnvironmentService } from '../../core/services/environment.service';

@Component({
  standalone: true,
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  private readonly envService = inject(EnvironmentService);

  protected readonly year = new Date().getFullYear();
  protected readonly version = this.envService.appVersion;
  protected readonly build = this.envService.buildStamp;
}
