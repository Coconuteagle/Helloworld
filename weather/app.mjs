const GEOCODING_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_CITY = '서울';
const FORECAST_DAYS = 5;

const WEATHER_LABELS = new Map([
  [[0], '맑음'],
  [[1], '대체로 맑음'],
  [[2], '부분적으로 흐림'],
  [[3], '흐림'],
  [[45, 48], '안개'],
  [[51, 53, 55], '이슬비'],
  [[56, 57], '어는 이슬비'],
  [[61, 63, 65], '비'],
  [[66, 67], '어는 비'],
  [[71, 73, 75, 77], '눈'],
  [[80, 81, 82], '소나기'],
  [[85, 86], '눈 소나기'],
  [[95], '뇌우'],
  [[96, 99], '우박 동반 뇌우'],
]);

const WEATHER_EMOJIS = new Map([
  [[0], '☀️'],
  [[1], '🌤️'],
  [[2], '⛅'],
  [[3], '☁️'],
  [[45, 48], '🌫️'],
  [[51, 53, 55, 56, 57], '🌦️'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️'],
  [[71, 73, 75, 77, 85, 86], '❄️'],
  [[95, 96, 99], '⛈️'],
]);

function findMappedValue(table, code, fallback) {
  for (const [codes, value] of table.entries()) {
    if (codes.includes(Number(code))) {
      return value;
    }
  }
  return fallback;
}

export function buildGeocodingUrl(city) {
  const query = String(city ?? '').trim();
  if (!query) {
    throw new Error('도시명을 먼저 넣어라.');
  }

  const url = new URL(GEOCODING_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'ko');
  return url.toString();
}

export function normalizeLocationResult(result) {
  if (!result) {
    throw new Error('위치 정보가 비어 있다.');
  }

  const address = result.address ?? {};
  const name = result.name
    ?? address.city
    ?? address.town
    ?? address.county
    ?? address.state
    ?? String(result.display_name ?? '').split(',')[0].trim();
  let admin1 = address.state ?? address.region ?? address.county ?? '';
  const country = address.country ?? '';
  const latitude = Number(result.lat ?? result.latitude);
  const longitude = Number(result.lon ?? result.longitude);

  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('위치 정보를 정상적으로 읽지 못했다.');
  }

  if (admin1 === name) {
    admin1 = '';
  }

  return {
    name,
    admin1,
    country,
    latitude,
    longitude,
    timezone: 'auto',
    label: result.display_name ?? [name, admin1, country].filter(Boolean).join(', '),
  };
}

export function buildForecastUrl({ latitude, longitude, timezone = 'auto' }) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new Error('예보 조회용 좌표가 잘못됐다.');
  }

  const url = new URL(FORECAST_BASE_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  return url.toString();
}

export function weatherCodeToKorean(code) {
  return findMappedValue(WEATHER_LABELS, code, '알 수 없음');
}

export function weatherCodeToEmoji(code) {
  return findMappedValue(WEATHER_EMOJIS, code, '🌈');
}

function roundNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function formatDayLabel(dateText) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateText}T12:00:00`));
}

function formatUpdatedLabel(dateText) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateText));
}

export function normalizeForecast(apiPayload) {
  const current = apiPayload?.current;
  const daily = apiPayload?.daily;
  if (!current || !daily || !Array.isArray(daily.time)) {
    throw new Error('날씨 데이터 형식이 이상하다.');
  }

  const forecast = daily.time.map((dateText, index) => {
    const code = Number(daily.weather_code?.[index]);
    return {
      date: dateText,
      label: formatDayLabel(dateText),
      code,
      summary: weatherCodeToKorean(code),
      emoji: weatherCodeToEmoji(code),
      max: roundNumber(daily.temperature_2m_max?.[index]),
      min: roundNumber(daily.temperature_2m_min?.[index]),
      precipitationProbability: roundNumber(daily.precipitation_probability_max?.[index]),
    };
  });

  return {
    timezone: apiPayload.timezone ?? 'auto',
    updatedAt: current.time,
    updatedLabel: formatUpdatedLabel(current.time),
    current: {
      temperature: roundNumber(current.temperature_2m),
      feelsLike: roundNumber(current.apparent_temperature),
      humidity: roundNumber(current.relative_humidity_2m),
      windSpeed: roundNumber(current.wind_speed_10m),
      code: Number(current.weather_code),
      summary: weatherCodeToKorean(current.weather_code),
      emoji: weatherCodeToEmoji(current.weather_code),
    },
    daily: forecast,
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`네트워크 응답이 이상하다. (${response.status})`);
  }

  return response.json();
}

async function searchCity(city, signal) {
  const results = await fetchJson(buildGeocodingUrl(city), signal);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('도시를 못 찾았다. 다른 이름으로 다시 쳐봐.');
  }
  return normalizeLocationResult(results[0]);
}

async function fetchForecast(location, signal) {
  return fetchJson(
    buildForecastUrl({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
    }),
    signal,
  );
}

function formatCoordinate(location) {
  return `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`;
}

function formatMetric(value, unit = '') {
  return value == null ? '-' : `${value}${unit}`;
}

function renderForecastCards(items, forecastGrid) {
  forecastGrid.innerHTML = items
    .map((item) => `
      <article class="forecast-card">
        <p>${item.label}</p>
        <div class="forecast-emoji" aria-hidden="true">${item.emoji}</div>
        <strong>${item.summary}</strong>
        <div class="temps">
          <span>최고 ${formatMetric(item.max, '°')}</span>
          <span>최저 ${formatMetric(item.min, '°')}</span>
        </div>
        <span>강수 ${formatMetric(item.precipitationProbability, '%')}</span>
      </article>
    `)
    .join('');
}

function bindUi() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('cityInput');
  const searchButton = document.getElementById('searchButton');
  const statusText = document.getElementById('statusText');
  const locationName = document.getElementById('locationName');
  const locationMeta = document.getElementById('locationMeta');
  const timezoneValue = document.getElementById('timezoneValue');
  const coordValue = document.getElementById('coordValue');
  const updatedAt = document.getElementById('updatedAt');
  const weatherSummary = document.getElementById('weatherSummary');
  const currentTemp = document.getElementById('currentTemp');
  const weatherEmoji = document.getElementById('weatherEmoji');
  const feelsLikeValue = document.getElementById('feelsLikeValue');
  const humidityValue = document.getElementById('humidityValue');
  const windValue = document.getElementById('windValue');
  const forecastGrid = document.getElementById('forecastGrid');
  const chips = [...document.querySelectorAll('[data-city]')];

  let activeController = null;

  const setStatus = (message, tone = 'idle') => {
    statusText.textContent = message;
    statusText.dataset.tone = tone;
  };

  const setBusy = (busy) => {
    searchButton.disabled = busy;
    searchButton.textContent = busy ? '불러오는 중...' : '날씨 보기';
  };

  const render = (location, forecast) => {
    locationName.textContent = location.name;
    locationMeta.textContent = location.label;
    timezoneValue.textContent = forecast.timezone;
    coordValue.textContent = formatCoordinate(location);
    updatedAt.textContent = `업데이트 ${forecast.updatedLabel}`;
    weatherSummary.textContent = forecast.current.summary;
    currentTemp.textContent = formatMetric(forecast.current.temperature, '°C');
    weatherEmoji.textContent = forecast.current.emoji;
    feelsLikeValue.textContent = formatMetric(forecast.current.feelsLike, '°C');
    humidityValue.textContent = formatMetric(forecast.current.humidity, '%');
    windValue.textContent = formatMetric(forecast.current.windSpeed, ' km/h');
    renderForecastCards(forecast.daily, forecastGrid);
  };

  const runSearch = async (rawCity) => {
    const city = String(rawCity ?? '').trim();
    if (!city) {
      setStatus('도시명 비어 있다. 하나 넣어라.', 'error');
      input.focus();
      return;
    }

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    setBusy(true);
    setStatus(`${city} 날씨 조회 중...`, 'idle');

    try {
      const location = await searchCity(city, controller.signal);
      const rawForecast = await fetchForecast(location, controller.signal);
      const forecast = normalizeForecast(rawForecast);
      render(location, forecast);
      setStatus(`${location.name} 날씨 업데이트 끝.`, 'success');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      setStatus(error?.message ?? '날씨를 불러오지 못했다.', 'error');
    } finally {
      if (activeController === controller) {
        activeController = null;
      }
      setBusy(false);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch(input.value);
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.city ?? '';
      runSearch(input.value);
    });
  });

  input.value = DEFAULT_CITY;
  runSearch(DEFAULT_CITY);
}

if (typeof document !== 'undefined') {
  bindUi();
}

export {
  DEFAULT_CITY,
  FORECAST_DAYS,
  formatDayLabel,
  formatUpdatedLabel,
};
