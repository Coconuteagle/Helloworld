import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeocodingUrl,
  normalizeLocationResult,
  buildForecastUrl,
  weatherCodeToKorean,
  normalizeForecast,
} from '../weather/app.mjs';

test('buildGeocodingUrl encodes Korean city search for Nominatim', () => {
  const url = new URL(buildGeocodingUrl('서울'));
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search');
  assert.equal(url.searchParams.get('q'), '서울');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('accept-language'), 'ko');
});

test('normalizeLocationResult converts raw coordinates and removes duplicated admin1', () => {
  const normalized = normalizeLocationResult({
    name: '서울특별시',
    display_name: '서울특별시, 대한민국',
    lat: '37.56668',
    lon: '126.97841',
    address: {
      state: '서울특별시',
      country: '대한민국',
    },
  });

  assert.deepEqual(normalized, {
    name: '서울특별시',
    admin1: '',
    country: '대한민국',
    latitude: 37.56668,
    longitude: 126.97841,
    timezone: 'auto',
    label: '서울특별시, 대한민국',
  });
});

test('buildForecastUrl includes current and daily weather fields', () => {
  const url = new URL(buildForecastUrl({ latitude: 37.56, longitude: 126.97, timezone: 'auto' }));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '37.56');
  assert.equal(url.searchParams.get('longitude'), '126.97');
  assert.equal(url.searchParams.get('forecast_days'), '5');
  assert.match(url.searchParams.get('current') ?? '', /temperature_2m/);
  assert.match(url.searchParams.get('daily') ?? '', /weather_code/);
});

test('weatherCodeToKorean maps common weather codes', () => {
  assert.equal(weatherCodeToKorean(0), '맑음');
  assert.equal(weatherCodeToKorean(63), '비');
  assert.equal(weatherCodeToKorean(95), '뇌우');
  assert.equal(weatherCodeToKorean(999), '알 수 없음');
});

test('normalizeForecast reshapes Open-Meteo payload into UI-friendly data', () => {
  const payload = {
    timezone: 'Asia/Seoul',
    current: {
      time: '2026-04-22T09:00',
      temperature_2m: 18.2,
      apparent_temperature: 17.1,
      relative_humidity_2m: 52,
      wind_speed_10m: 11.7,
      weather_code: 2,
    },
    daily: {
      time: ['2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-26'],
      weather_code: [2, 61, 3, 0, 80],
      temperature_2m_max: [21.4, 19.9, 23.1, 26.2, 18.5],
      temperature_2m_min: [11.4, 10.9, 12.1, 15.2, 9.5],
      precipitation_probability_max: [10, 70, 20, 0, 65],
    },
  };

  const normalized = normalizeForecast(payload);

  assert.equal(normalized.timezone, 'Asia/Seoul');
  assert.equal(normalized.current.temperature, 18);
  assert.equal(normalized.current.summary, '부분적으로 흐림');
  assert.equal(normalized.daily.length, 5);
  assert.equal(normalized.daily[1].summary, '비');
  assert.equal(normalized.daily[3].emoji, '☀️');
  assert.match(normalized.daily[0].label, /4\./);
  assert.match(normalized.updatedLabel, /4\./);
});
