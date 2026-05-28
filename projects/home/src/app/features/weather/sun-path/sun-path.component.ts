import { Component, computed, input, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-sun-path',
  imports: [],
  templateUrl: './sun-path.component.html',
  styleUrl: './sun-path.component.scss',
})
export class SunPathComponent implements OnInit, OnDestroy {
  // Inputs for customizable sunrise/sunset times
  readonly sunriseTime = input('6:01 AM');
  readonly sunsetTime = input('6:54 PM');

  // Dynamic live clock signal
  readonly currentTime = signal('');
  private timerId?: any;

  // SVG Sizing and Circle variables (cut-to-cut available space parameters)
  readonly width = 360;
  readonly height = 125;
  readonly radius = 115;
  readonly centerX = 180;
  readonly centerY = 118;
 
  // Geometry details for chord limits (15 degrees above the diameter line)
  readonly startAngle = 165;
  readonly endAngle = 15;
  readonly angleRange = 150; // Total sweep of 150 degrees
 
  // Mathematically computed start/end endpoints at Y = 118 - 115 * sin(15 deg) = 88.2
  readonly startX = 68.9;
  readonly startY = 88.2;
  readonly endX = 291.1;
  readonly endY = 88.2;
 
  // Declarative SVG path representing the chord arc
  readonly arcPath = `M ${this.startX} ${this.startY} A ${this.radius} ${this.radius} 0 0 1 ${this.endX} ${this.endY}`;
 
  // Arc sweep length: radius * (angleRange in radians) = 115 * (150 * Math.PI / 180) = ~301.07
  readonly circumference = 115 * (150 * Math.PI / 180);
 
  // Dasharray configuration
  readonly dashArray = `${this.circumference} ${this.circumference}`;

  // Helper method to parse time string (e.g. "6:01 AM") into seconds since midnight
  private parseTimeToSeconds(timeStr: string): number {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }

    return (hours * 60 + minutes) * 60;
  }

  // Reactively track the current time in seconds, floored to 30-minute intervals
  readonly flooredTimeSeconds = computed(() => {
    this.currentTime(); // Register dependency on the clock updates
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Floor minutes to the last 30-minute block (e.g. 17:22 -> 17:00, 17:31 -> 17:30)
    const flooredMinutes = Math.floor(currentMinutes / 30) * 30;
    return flooredMinutes * 60;
  });

  // Reactively calculate whether it is currently daytime (based on the 30-minute floored time)
  readonly isDaytime = computed(() => {
    const sunrise = this.parseTimeToSeconds(this.sunriseTime());
    const sunset = this.parseTimeToSeconds(this.sunsetTime());
    const current = this.flooredTimeSeconds();

    return current > sunrise && current < sunset;
  });

  // Reactively calculate live daylight progress (value between 0 and 1) based on the 30-minute floored time
  readonly liveProgress = computed(() => {
    const sunrise = this.parseTimeToSeconds(this.sunriseTime());
    const sunset = this.parseTimeToSeconds(this.sunsetTime());
    const current = this.flooredTimeSeconds();

    if (current <= sunrise) return 0;
    if (current >= sunset) return 1;

    const total = sunset - sunrise;
    if (total <= 0) return 0.5;

    return (current - sunrise) / total;
  });

  // Reactively calculate live nighttime progress (value between 0 and 1) based on the 30-minute floored time
  readonly nightProgress = computed(() => {
    const sunrise = this.parseTimeToSeconds(this.sunriseTime());
    const sunset = this.parseTimeToSeconds(this.sunsetTime());
    const current = this.flooredTimeSeconds();

    const totalSecondsInDay = 24 * 3600;
    const nightDuration = (totalSecondsInDay - sunset) + sunrise;

    if (current >= sunset) {
      return (current - sunset) / nightDuration;
    } else if (current <= sunrise) {
      return ((totalSecondsInDay - sunset) + current) / nightDuration;
    }

    return 0; // Daytime fallback
  });

  // Unified active progress based on Day vs Night
  readonly activeProgress = computed(() => {
    return this.isDaytime() ? this.liveProgress() : this.nightProgress();
  });

  // Dashoffset dynamically recalculated based on active progress
  readonly dashOffset = computed(() => {
    const p = this.activeProgress();
    return this.circumference * (1 - p);
  });

  // Symmetrical coordinates of the celestial body (Sun/Moon) dynamically calculated along the chord arc sweep
  readonly celestialPosition = computed(() => {
    const p = this.activeProgress();
    // Angle in degrees moving from 165° (Rise) to 15° (Set)
    const angleDeg = this.startAngle - (this.angleRange * p);
    const angleRad = angleDeg * Math.PI / 180;
    const cx = this.centerX + this.radius * Math.cos(angleRad);
    const cy = this.centerY - this.radius * Math.sin(angleRad);
    return { cx, cy };
  });

  ngOnInit(): void {
    this.updateClock();
    // Refresh the clock every second to ensure absolute real-time accuracy and smooth travel of the sun/moon
    this.timerId = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateClock(): void {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Make 0 represent 12
    this.currentTime.set(`${hours}:${minutes}:${seconds} ${ampm}`);
  }
}
