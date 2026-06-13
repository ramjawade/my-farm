import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/auth/auth.service';
import { FarmerRegistrationData } from '../farmer-registration/farmer-registration.models';
import { FarmerRegistrationService } from '../farmer-registration/farmer-registration.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let authService: AuthService;

  const mockUser: FarmerRegistrationData = {
    id: 'f-test',
    fullName: 'Test Farmer Name',
    phone: '1122334455',
    email: 'test@example.com',
    preferredLanguage: 'English',
    userRole: 'Farmer',
    farmName: 'Green Acres',
    farmArea: 5.5,
    farmAreaUnit: 'acres',
    primaryCrops: ['Soybeans', 'Wheat'],
    waterSource: 'Borewell',
    irrigationType: 'Drip',
    farmingMethod: 'Organic',
    locationType: 'manual',
    state: 'Maharashtra',
    district: 'Pune',
    village: 'Mulshi',
    pincode: '411057',
    location: { lat: 18.5, lng: 73.5 },
    createdAt: Date.now()
  };

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        AuthService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    
    // Seed mockUser in the registration service
    const registrationSvc = TestBed.inject(FarmerRegistrationService);
    (registrationSvc as any).farmersSignal.set([mockUser]);

    // Login mock user
    authService.login(mockUser);
    fixture.detectChanges();
  });

  it('should create the profile component', () => {
    expect(component).toBeTruthy();
  });

  it('should display logged in user details in view mode', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.h3')?.textContent).toContain('Test Farmer Name');
    expect(compiled.textContent).toContain('Green Acres');
    expect(compiled.textContent).toContain('1122334455');
    expect(compiled.textContent).toContain('test@example.com');
    expect(compiled.textContent).toContain('Mulshi');
    expect(compiled.textContent).toContain('Pune');
    expect(compiled.textContent).toContain('Maharashtra');
    expect(compiled.textContent).toContain('5.5 acres');
    expect(compiled.textContent).toContain('Borewell');
    expect(compiled.textContent).toContain('Drip');
    expect(compiled.textContent).toContain('Organic');
    
    // Verify crop tags list
    expect(compiled.textContent).toContain('Soybeans');
    expect(compiled.textContent).toContain('Wheat');
  });

  it('should set section and show dialog to true when openEditDialog is called', () => {
    expect(component.showEditDialog()).toBeFalse();
    
    component.openEditDialog('account');
    expect(component.activeSection()).toBe('account');
    expect(component.showEditDialog()).toBeTrue();

    component.openEditDialog('land');
    expect(component.activeSection()).toBe('land');
    expect(component.showEditDialog()).toBeTrue();
  });

  it('should reset agronomic fields when deleteAgronomic is called and confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteAgronomic();
    
    const user = authService.currentUser();
    expect(user?.userRole).toBe('Farmer');
    expect(user?.farmingMethod).toBe('');
    expect(user?.farmSetupCompleted).toBeFalse();
  });

  it('should reset land & location fields when deleteLandLocation is called and confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteLandLocation();
    
    const user = authService.currentUser();
    expect(user?.farmName).toBe('');
    expect(user?.farmArea).toBe(0);
    expect(user?.village).toBe('');
    expect(user?.district).toBe('');
    expect(user?.state).toBe('');
    expect(user?.pincode).toBe('');
    expect(user?.location).toBeNull();
    expect(user?.locationType).toBe('skipped');
    expect(user?.farmSetupCompleted).toBeFalse();
  });

  it('should reset operational fields when deleteOperations is called and confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.deleteOperations();
    
    const user = authService.currentUser();
    expect(user?.waterSource).toBe('');
    expect(user?.irrigationType).toBe('');
    expect(user?.primaryCrops?.length).toBe(0);
    expect(user?.farmSetupCompleted).toBeFalse();
  });
});
