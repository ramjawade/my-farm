import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { ProfileEditDialogComponent } from './profile-edit-dialog.component';
import { AuthService } from '../../../core/auth/auth.service';
import { FarmerRegistrationData } from '../../farmer-registration/farmer-registration.models';

describe('ProfileEditDialogComponent', () => {
  let component: ProfileEditDialogComponent;
  let fixture: ComponentFixture<ProfileEditDialogComponent>;
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
    primaryCrops: ['Soybeans'],
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
      imports: [ProfileEditDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        AuthService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileEditDialogComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    
    // Login mock user
    authService.login(mockUser);
  });

  it('should create the dialog component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize and populate account section fields on show', async () => {
    fixture.componentRef.setInput('section', 'account');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.editFullName()).toBe('Test Farmer Name');
    expect(component.editEmail()).toBe('test@example.com');
    expect(component.editPreferredLanguage()).toBe('English');
  });

  it('should initialize and populate agronomic section fields on show', async () => {
    fixture.componentRef.setInput('section', 'agronomic');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.editUserRole()).toBe('Farmer');
    expect(component.editFarmingMethod()).toBe('Organic');
  });

  it('should initialize and populate land section fields on show', async () => {
    fixture.componentRef.setInput('section', 'land');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.editFarmName()).toBe('Green Acres');
    expect(component.editFarmArea()).toBe(5.5);
    expect(component.editFarmAreaUnit()).toBe('acres');
    expect(component.locationMethod()).toBe('manual');
    expect(component.editVillage()).toBe('Mulshi');
    expect(component.editDistrict()).toBe('Pune');
    expect(component.editState()).toBe('Maharashtra');
    expect(component.editPincode()).toBe('411057');
  });

  it('should toggle crop checkboxes in operations section', async () => {
    fixture.componentRef.setInput('section', 'operations');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedCrops()).toEqual(['Soybeans']);

    // Select Wheat
    component.toggleCrop('Wheat');
    expect(component.selectedCrops()).toEqual(['Soybeans', 'Wheat']);

    // Remove Soybeans
    component.toggleCrop('Soybeans');
    expect(component.selectedCrops()).toEqual(['Wheat']);
  });

  it('should update profile and close dialog on save for account section', async () => {
    fixture.componentRef.setInput('section', 'account');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    component.editFullName.set('Updated Full Name');
    component.editEmail.set('updated@example.com');
    
    spyOn(authService, 'updateProfile').and.callThrough();
    component.save();
    
    expect(authService.updateProfile).toHaveBeenCalledWith({
      fullName: 'Updated Full Name',
      phone: '1122334455',
      email: 'updated@example.com',
      preferredLanguage: 'English'
    });
    expect(component.show()).toBeFalse();
  });

  it('should update profile and close dialog on save for operations section', async () => {
    fixture.componentRef.setInput('section', 'operations');
    component.show.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    component.editWaterSource.set('River');
    component.editIrrigationType.set('Sprinkler');
    component.selectedCrops.set(['Wheat', 'Cotton']);

    spyOn(authService, 'updateProfile').and.callThrough();
    component.save();

    expect(authService.updateProfile).toHaveBeenCalledWith({
      waterSource: 'River',
      irrigationType: 'Sprinkler',
      primaryCrops: ['Wheat', 'Cotton']
    });
    expect(component.show()).toBeFalse();
  });
});
