import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SunPathComponent } from './sun-path.component';

describe('SunPathComponent', () => {
  let component: SunPathComponent;
  let fixture: ComponentFixture<SunPathComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SunPathComponent],
      providers: [provideZonelessChangeDetection()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SunPathComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
