import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, signal, Input, computed } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-history-trend',
  imports: [],
  templateUrl: './history-trend.component.html',
  styleUrl: './history-trend.component.scss',
})
export class HistoryTrendComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: false }) private chartContainer!: ElementRef;

  // Internal active D3 chart tab signal
  readonly activeTabSignal = signal<'weekly' | 'monthly' | 'yearly'>('weekly');

  @Input()
  set activeTab(val: 'weekly' | 'monthly' | 'yearly') {
    this.activeTabSignal.set(val);
    if (this.chartContainer) {
      this.drawChart();
    }
  }

  get activeTab(): 'weekly' | 'monthly' | 'yearly' {
    return this.activeTabSignal();
  }

  // Chart datasets
  readonly weeklyData = [
    { label: 'Mon', temp: 28, rain: 15, humidity: 65 },
    { label: 'Tue', temp: 26, rain: 45, humidity: 80 },
    { label: 'Wed', temp: 31, rain: 5, humidity: 55 },
    { label: 'Thu', temp: 27, rain: 20, humidity: 70 },
    { label: 'Fri', temp: 25, rain: 60, humidity: 85 },
    { label: 'Sat', temp: 28, rain: 10, humidity: 68 },
    { label: 'Sun', temp: 30, rain: 2, humidity: 60 }
  ];

  readonly monthlyData = [
    { label: 'Week 1', temp: 27, rain: 120, humidity: 72 },
    { label: 'Week 2', temp: 29, rain: 80, humidity: 68 },
    { label: 'Week 3', temp: 31, rain: 40, humidity: 62 },
    { label: 'Week 4', temp: 28, rain: 150, humidity: 78 }
  ];

  readonly yearlyData = [
    { label: 'Jan', temp: 22, rain: 5, humidity: 45 },
    { label: 'Feb', temp: 24, rain: 8, humidity: 42 },
    { label: 'Mar', temp: 28, rain: 12, humidity: 40 },
    { label: 'Apr', temp: 32, rain: 15, humidity: 38 },
    { label: 'May', temp: 34, rain: 20, humidity: 42 },
    { label: 'Jun', temp: 31, rain: 180, humidity: 75 },
    { label: 'Jul', temp: 28, rain: 250, humidity: 82 },
    { label: 'Aug', temp: 27, rain: 220, humidity: 80 },
    { label: 'Sep', temp: 28, rain: 140, humidity: 78 },
    { label: 'Oct', temp: 29, rain: 45, humidity: 65 },
    { label: 'Nov', temp: 25, rain: 15, humidity: 55 },
    { label: 'Dec', temp: 23, rain: 8, humidity: 48 }
  ];

  // Historical stats computed dynamically based on active timeframe
  readonly avgTemp = computed(() => {
    const data = this.activeTabSignal() === 'weekly'
      ? this.weeklyData
      : this.activeTabSignal() === 'monthly'
        ? this.monthlyData
        : this.yearlyData;
    const sum = data.reduce((acc, curr) => acc + curr.temp, 0);
    return Math.round(sum / data.length);
  });

  readonly totalRainfall = computed(() => {
    const data = this.activeTabSignal() === 'weekly'
      ? this.weeklyData
      : this.activeTabSignal() === 'monthly'
        ? this.monthlyData
        : this.yearlyData;
    const sum = data.reduce((acc, curr) => acc + curr.rain, 0);
    return Math.round(sum);
  });

  readonly avgHumidity = computed(() => {
    const data = this.activeTabSignal() === 'weekly'
      ? this.weeklyData
      : this.activeTabSignal() === 'monthly'
        ? this.monthlyData
        : this.yearlyData;
    const sum = data.reduce((acc, curr) => acc + curr.humidity, 0);
    return Math.round(sum / data.length);
  });

  readonly avgWind = computed(() => {
    // Dynamic wind averages based on selected timeframe
    return this.activeTabSignal() === 'weekly'
      ? 14
      : this.activeTabSignal() === 'monthly'
        ? 12
        : 16;
  });

  private resizeListener?: () => void;

  ngAfterViewInit(): void {
    // Render initial chart
    setTimeout(() => {
      this.drawChart();
    }, 0);

    // Add window resize listener for responsive fluid redraw
    this.resizeListener = () => this.drawChart();
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  drawChart(): void {
    if (!this.chartContainer) return;
    const container = this.chartContainer.nativeElement;

    // Clear previous elements
    d3.select(container).selectAll('*').remove();

    // Retrieve active dataset
    const data = this.activeTabSignal() === 'weekly'
      ? this.weeklyData
      : this.activeTabSignal() === 'monthly'
        ? this.monthlyData
        : this.yearlyData;

    // Responsive margins and dimensions
    const margin = { top: 20, right: 56, bottom: 45, left: 56 };
    const width = Math.max(100, container.clientWidth - margin.left - margin.right);
    const height = Math.max(100, 220 - margin.top - margin.bottom);

    // Create SVG container
    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradient definition for Temperature (Primary fill)
    const defs = svg.append('defs');
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'historicalAreaGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#2e7d32')
      .attr('stop-opacity', 0.20);

    areaGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2e7d32')
      .attr('stop-opacity', 0.002);

    // Scales
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.label))
      .range([0, width]);

    // Independent scales for Temp, Rain, and Humidity
    const yScaleTemp = d3.scaleLinear()
      .domain([0, (d3.max(data, d => d.temp) || 35) + 3])
      .nice()
      .range([height, 0]);

    const yScaleRain = d3.scaleLinear()
      .domain([0, (d3.max(data, d => d.rain) || 100) + 15])
      .nice()
      .range([height, 0]);

    const yScaleHum = d3.scaleLinear()
      .domain([0, 100]) // Humidity is always 0 to 100%
      .range([height, 0]);

    // X Axis
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(8);
    const xAxisGroup = svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .attr('color', 'rgba(0,0,0,0.45)')
      .attr('font-family', 'inherit')
      .attr('font-size', '11px')
      .attr('font-weight', '500');
    xAxisGroup.select('.domain')
      .attr('stroke', 'rgba(0, 0, 0, 0.08)')
      .attr('stroke-width', '1');

    // X Axis Title Label based on active timeframe selected
    const xAxisLabelText = this.activeTabSignal() === 'weekly'
      ? 'Weekly Horizon (Days)'
      : this.activeTabSignal() === 'monthly'
        ? 'Monthly Horizon (Weeks)'
        : 'Yearly Horizon (Months)';

    svg.append('text')
      .attr('y', height + 36)
      .attr('x', width / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(0, 0, 0, 0.45)')
      .attr('font-family', 'inherit')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .text(xAxisLabelText);

    // Y Axis (Left - primary Temperature values)
    const yAxis = d3.axisLeft(yScaleTemp).ticks(5).tickSize(0).tickPadding(8).tickFormat(d => `${d}`);
    const yAxisGroup = svg.append('g')
      .call(yAxis)
      .attr('color', 'rgba(0,0,0,0.45)')
      .attr('font-family', 'inherit')
      .attr('font-size', '11px')
      .attr('font-weight', '500');
    yAxisGroup.select('.domain').remove(); // Hide domain axis line

    // Left Y Axis Title Label (Temperature)
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left + 16)
      .attr('x', 0 - (height / 2))
      .attr('dy', '0.75em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#2e7d32')
      .attr('font-family', 'inherit')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text('Temp (°C)');

    // Y Axis (Right - secondary Humidity values)
    const yAxisRight = d3.axisRight(yScaleHum).ticks(5).tickSize(0).tickPadding(8).tickFormat(d => `${d}`);
    const yAxisRightGroup = svg.append('g')
      .attr('transform', `translate(${width}, 0)`)
      .call(yAxisRight)
      .attr('color', 'rgba(0,0,0,0.45)')
      .attr('font-family', 'inherit')
      .attr('font-size', '11px')
      .attr('font-weight', '500');
    yAxisRightGroup.select('.domain').remove(); // Hide domain axis line

    // Right Y Axis Title Label (Humidity)
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', width + margin.right - 16)
      .attr('x', 0 - (height / 2))
      .attr('dy', '0em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#26a69a')
      .attr('font-family', 'inherit')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text('Humidity (%)');

    // Generators for Temperature (Green)
    const tempLineGenerator = d3.line<any>()
      .x(d => xScale(d.label) as number)
      .y(d => yScaleTemp(d.temp))
      .curve(d3.curveMonotoneX);

    const tempAreaGenerator = d3.area<any>()
      .x(d => xScale(d.label) as number)
      .y0(height)
      .y1(d => yScaleTemp(d.temp))
      .curve(d3.curveMonotoneX);

    // Generators for Rainfall (Blue)
    const rainLineGenerator = d3.line<any>()
      .x(d => xScale(d.label) as number)
      .y(d => yScaleRain(d.rain))
      .curve(d3.curveMonotoneX);

    // Generators for Humidity (Teal)
    const humLineGenerator = d3.line<any>()
      .x(d => xScale(d.label) as number)
      .y(d => yScaleHum(d.humidity))
      .curve(d3.curveMonotoneX);

    // Draw Temperature Area Gradient (Primary)
    svg.append('path')
      .datum(data)
      .attr('fill', 'url(#historicalAreaGradient)')
      .attr('d', tempAreaGenerator);

    // Draw Temperature Line Curve (Green)
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2e7d32')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('d', tempLineGenerator);

    // Draw Rainfall Line Curve (Blue)
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#42a5f5')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', rainLineGenerator);

    // Draw Humidity Line Curve (Teal)
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#26a69a')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', humLineGenerator);

    // Interactive focus elements
    const focus = svg.append('g')
      .attr('class', 'focus')
      .style('display', 'none');

    // Hover vertical dotted line
    focus.append('line')
      .attr('class', 'focus-line')
      .attr('stroke', 'rgba(0, 0, 0, 0.15)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 4')
      .attr('y1', 0)
      .attr('y2', height);

    // Hover pulsing dot for Temperature (Green)
    const focusTemp = focus.append('g').attr('class', 'focus-temp');
    focusTemp.append('circle').attr('r', 7).attr('fill', 'rgba(46, 125, 50, 0.22)');
    focusTemp.append('circle').attr('r', 3.5).attr('fill', '#2e7d32').attr('stroke', '#ffffff').attr('stroke-width', 1.5);

    // Hover pulsing dot for Rainfall (Blue)
    const focusRain = focus.append('g').attr('class', 'focus-rain');
    focusRain.append('circle').attr('r', 7).attr('fill', 'rgba(66, 165, 245, 0.22)');
    focusRain.append('circle').attr('r', 3.5).attr('fill', '#42a5f5').attr('stroke', '#ffffff').attr('stroke-width', 1.5);

    // Hover pulsing dot for Humidity (Teal)
    const focusHum = focus.append('g').attr('class', 'focus-hum');
    focusHum.append('circle').attr('r', 7).attr('fill', 'rgba(38, 166, 154, 0.22)');
    focusHum.append('circle').attr('r', 3.5).attr('fill', '#26a69a').attr('stroke', '#ffffff').attr('stroke-width', 1.5);

    // Sleek HTML tooltip box
    const tooltip = d3.select(container)
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(33, 33, 33, 0.95)')
      .style('color', '#ffffff')
      .style('padding', '8px 14px')
      .style('border-radius', '8px')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('transition', 'opacity 0.15s ease-in-out, transform 0.1s ease-in-out')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('z-index', '10');

    // Capture overlay rect
    svg.append('rect')
      .attr('class', 'overlay')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => {
        focus.style('display', null);
        tooltip.style('opacity', 1);
      })
      .on('mouseout', () => {
        focus.style('display', 'none');
        tooltip.style('opacity', 0);
      })
      .on('mousemove', (event) => {
        const mouseX = d3.pointer(event)[0];
        const domain = xScale.domain();

        let minDiff = Infinity;
        let index = 0;
        domain.forEach((d, i) => {
          const xPos = xScale(d) as number;
          const diff = Math.abs(xPos - mouseX);
          if (diff < minDiff) {
            minDiff = diff;
            index = i;
          }
        });

        const activeItem = data[index];
        const xPos = xScale(activeItem.label) as number;

        // Calculate dynamic dot translation coordinates
        const yTemp = yScaleTemp(activeItem.temp);
        const yRain = yScaleRain(activeItem.rain);
        const yHum = yScaleHum(activeItem.humidity);

        // Position full focus group at xPos
        focus.attr('transform', `translate(${xPos},0)`);

        // Translate indicator line
        focus.select('.focus-line')
          .attr('y1', 0)
          .attr('y2', height);

        // Position individual dots relative to their respective scales!
        focusTemp.attr('transform', `translate(0,${yTemp})`);
        focusRain.attr('transform', `translate(0,${yRain})`);
        focusHum.attr('transform', `translate(0,${yHum})`);

        // Determine tooltips Y center point
        const yTooltip = Math.min(yTemp, yRain, yHum);

        // Format dynamic date header for tooltip
        let tooltipHeader = activeItem.label;
        const currentYear = new Date().getFullYear();

        if (this.activeTabSignal() === 'weekly') {
          const dayMap: { [key: string]: string } = {
            'Mon': `Monday, May 25, ${currentYear}`,
            'Tue': `Tuesday, May 26, ${currentYear}`,
            'Wed': `Wednesday, May 27, ${currentYear}`,
            'Thu': `Thursday, May 28, ${currentYear}`,
            'Fri': `Friday, May 29, ${currentYear}`,
            'Sat': `Saturday, May 30, ${currentYear}`,
            'Sun': `Sunday, May 31, ${currentYear}`
          };
          tooltipHeader = dayMap[activeItem.label] || activeItem.label;
        } else if (this.activeTabSignal() === 'monthly') {
          const weekMap: { [key: string]: string } = {
            'Week 1': `Week 1 (May 1 - 7, ${currentYear})`,
            'Week 2': `Week 2 (May 8 - 14, ${currentYear})`,
            'Week 3': `Week 3 (May 15 - 21, ${currentYear})`,
            'Week 4': `Week 4 (May 22 - 28, ${currentYear})`
          };
          tooltipHeader = weekMap[activeItem.label] || activeItem.label;
        } else if (this.activeTabSignal() === 'yearly') {
          const monthMap: { [key: string]: string } = {
            'Jan': `January ${currentYear}`,
            'Feb': `February ${currentYear}`,
            'Mar': `March ${currentYear}`,
            'Apr': `April ${currentYear}`,
            'May': `May ${currentYear}`,
            'Jun': `June ${currentYear}`,
            'Jul': `July ${currentYear}`,
            'Aug': `August ${currentYear}`,
            'Sep': `September ${currentYear}`,
            'Oct': `October ${currentYear}`,
            'Nov': `November ${currentYear}`,
            'Dec': `December ${currentYear}`
          };
          tooltipHeader = monthMap[activeItem.label] || activeItem.label;
        }

        // Tooltip updates with all three climate metrics
        tooltip
          .html(`
            <div style="font-weight: 700; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 2px;">${tooltipHeader}</div>
            <div style="display: flex; justify-content: space-between; gap: 15px; margin-top: 2px;">
              <span style="color: #a5d6a7;">Temp:</span>
              <span>${activeItem.temp}°C</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 15px; margin-top: 2px;">
              <span style="color: #90caf9;">Rainfall:</span>
              <span>${activeItem.rain}mm</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 15px; margin-top: 2px;">
              <span style="color: #80cbc4;">Humidity:</span>
              <span>${activeItem.humidity}%</span>
            </div>
          `)
          .style('left', `${xPos + margin.left + 15}px`)
          .style('top', `${yTooltip + margin.top - 20}px`);
      });
  }
}
