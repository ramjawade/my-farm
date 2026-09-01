import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrl: './footer.scss'
})
export class Footer {
  protected readonly year = new Date().getFullYear();
}
