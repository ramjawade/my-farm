import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryTrendComponent } from './history-trend.component';

describe('HistoryTrendComponent', () => {
  let component: HistoryTrendComponent;
  let fixture: ComponentFixture<HistoryTrendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryTrendComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryTrendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
