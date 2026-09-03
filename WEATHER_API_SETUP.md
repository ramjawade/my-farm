# Weather API Setup Guide

This guide explains how to configure the OpenWeatherMap API key for live weather data in the My Farm application.

## Overview

The weather system uses a three-tier data source fallback:

1. **Live** — Real-time data from OpenWeatherMap API (when API key is configured)
2. **Cache** — Previously fetched data (when API is unavailable)
3. **Demo** — Mock data (when both API and cache are unavailable)

The data source is displayed as a badge in the weather dashboard header:
- **Live** (green) — Using real-time API data
- **Cached** (orange) — Using previously cached data
- **Demo** (gray) — Using mock demonstration data

## Getting an API Key

1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Generate an API key from your account dashboard
4. Keep the key confidential — treat it like a password

## Development Setup

### Local Development

For local development, the app uses a demo key by default. To use a live API key:

1. Create or edit `projects/home/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  appVersion: '0.1.0',
  buildStamp: 'dev',
  openWeatherApiKey: 'your-api-key-here',
};
```

2. Restart the development server
3. The weather dashboard will now fetch live data (badge shows "Live")

### Never Commit Secrets

**Important:** Never commit the actual API key to the repository. The environment.ts file should be kept with an empty key or `'demo-key'` for shared development.

For personal development, use:
- Environment variable injection (recommended for CI/CD)
- Local .env file (gitignored)
- IDE environment variable configuration

## Production Setup

The production build uses placeholders that are replaced at build time.

### CI/CD Configuration

Add a GitHub Actions secret in your repository settings:

1. Go to Settings → Secrets and Variables → Actions
2. Click "New repository secret"
3. Name: `OPENWEATHER_API_KEY`
4. Value: Your actual API key
5. Click "Add secret"

### Build-Time Replacement

The CI/CD pipeline automatically replaces the placeholder during the build:

```yaml
# In .github/workflows/deploy.yml
- name: Add API keys to environment
  run: |
    sed -i "s/__OPENWEATHER_API_KEY__/${{ secrets.OPENWEATHER_API_KEY }}/g" \
      projects/home/src/environments/environment.prod.ts
```

After deployment, the production build will have the API key embedded and the weather dashboard will display live data.

## API Rate Limits

The free tier of OpenWeatherMap includes:

- **1,000 calls/day** for the current weather endpoint
- **5-day forecast** available
- **Weather alerts** available

### Best Practices

1. **Cache aggressively** — Data is cached for 30 minutes to reduce API calls
2. **Avoid duplicate requests** — Weather is only fetched when the component initializes or location changes
3. **Monitor usage** — Check your OpenWeatherMap account dashboard for daily call counts

## Troubleshooting

### Weather Shows "Demo" Badge

This means either:
- No API key is configured in the environment
- The API key is invalid or has expired
- The OpenWeatherMap API is experiencing downtime

**Solution:** Check your environment configuration and API key validity.

### Weather Shows "Cached" Badge

The live API request failed, but previously cached data is available.

**Possible causes:**
- Network connectivity issue
- API rate limit exceeded
- OpenWeatherMap API downtime

**Solution:** Check network connectivity and API rate limit. The app will automatically retry with fresh data when the connection is restored.

### Location Not Updating

The weather uses this location priority:

1. **Farm centroid** — Calculates center point of the first saved land
2. **Profile location** — Uses user's village and state from settings
3. **Default** — Falls back to Nashik, Maharashtra if no location is set

**Solution:** Add a saved farm or update your profile location in Settings.

## API Endpoints Used

The app calls these OpenWeatherMap endpoints:

- `GET /data/2.5/weather` — Current weather conditions
- `GET /data/2.5/forecast` — 5-day forecast (40 data points)
- `GET /data/2.5/weather/alerts` — Weather alerts (if available)

See [OpenWeatherMap API documentation](https://openweathermap.org/api) for details.

## Key Rotation

To rotate the API key:

1. Generate a new key in your OpenWeatherMap account
2. Update the GitHub Actions secret with the new key
3. Trigger a new deployment
4. Invalidate the old key in your OpenWeatherMap account

No code changes are needed for key rotation — only the CI/CD secret needs to be updated.
