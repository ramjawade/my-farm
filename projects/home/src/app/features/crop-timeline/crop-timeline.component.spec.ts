import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CropTimelineComponent } from './crop-timeline.component';

describe('CropTimelineComponent', () => {
  let component: CropTimelineComponent;
  let fixture: ComponentFixture<CropTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CropTimelineComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CropTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });
});
