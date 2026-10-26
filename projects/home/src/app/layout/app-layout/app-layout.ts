import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { Main } from '../main/main';
import { MobileHeader } from '../mobile-header/mobile-header';
import { Sidebar } from '../sidebar/sidebar';
import { TabBar } from '../tab-bar/tab-bar';
import { AuthService } from '../../core/auth/auth.service';
import { ChatOrchestratorService } from '../../features/chat-bot/chat-orchestrator.service';
import { ChatBotContainerComponent } from '../../features/chat-bot/chat-bot-container/chat-bot-container.component';
import { LoaderOutletComponent, ToastOutletComponent } from 'shared';

@Component({
  standalone: true,
  selector: 'app-layout',
  imports: [
    Sidebar,
    MobileHeader,
    Main,
    TabBar,
    RouterOutlet,
    TranslatePipe,
    ToastOutletComponent,
    LoaderOutletComponent,
    ChatBotContainerComponent,
  ],
  // One conversation for the overlay and the /chat page; it ends with the signed-in layout.
  providers: [ChatOrchestratorService],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {
  readonly authService = inject(AuthService);

  /** A plain `#id` link would navigate under `<base href>`, so move focus here. */
  skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}
