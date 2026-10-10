/** Bootstrap Icons class for a weather condition code (OpenWeather icon codes). */
export function weatherIconClass(conditionCode: string): string {
  const iconMap: Record<string, string> = {
    '01d': 'bi-sun-fill',
    '01n': 'bi-moon-fill',
    '02d': 'bi-cloud-sun-fill',
    '02n': 'bi-cloud-moon-fill',
    '03d': 'bi-cloud-fill',
    '03n': 'bi-cloud-fill',
    '04d': 'bi-cloud-fill',
    '04n': 'bi-cloud-fill',
    '09d': 'bi-cloud-drizzle-fill',
    '09n': 'bi-cloud-drizzle-fill',
    '10d': 'bi-cloud-rain-fill',
    '10n': 'bi-cloud-rain-fill',
    '11d': 'bi-cloud-lightning-rain-fill',
    '11n': 'bi-cloud-lightning-rain-fill',
    '13d': 'bi-snow',
    '13n': 'bi-snow',
    '50d': 'bi-cloud-mist-fill',
    '50n': 'bi-cloud-mist-fill',
  };
  return iconMap[conditionCode] || 'bi-cloud-fill';
}
