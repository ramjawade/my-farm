import { Injectable } from '@angular/core';
import { WeatherData, WeatherLocation } from './weather.models';

@Injectable({ providedIn: 'root' })
export class WeatherCacheService {
  private cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;
  private readonly MAX_AGE_MS = 2 * 60 * 60 * 1000;

  private getCacheKey(location: WeatherLocation): string {
    return `${location.lat},${location.lng}`;
  }

  set(location: WeatherLocation, data: WeatherData): void {
    const key = this.getCacheKey(location);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(location: WeatherLocation): WeatherData | null {
    const key = this.getCacheKey(location);
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  isFresh(location: WeatherLocation): boolean {
    const key = this.getCacheKey(location);
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.CACHE_TTL_MS;
  }

  isStale(location: WeatherLocation): boolean {
    const key = this.getCacheKey(location);
    const cached = this.cache.get(key);
    if (!cached) return true;
    const age = Date.now() - cached.timestamp;
    return age >= this.CACHE_TTL_MS && age < this.MAX_AGE_MS;
  }

  clear(): void {
    this.cache.clear();
  }

  getCacheAge(location: WeatherLocation): number {
    const key = this.getCacheKey(location);
    const cached = this.cache.get(key);
    return cached ? Date.now() - cached.timestamp : -1;
  }
}
