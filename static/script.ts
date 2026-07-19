declare const Chart: any;

const LIGHT_PRIMARY = '#003a69';
const DARK_PRIMARY = '#0d92cf';
const API_BASE_URL = 'https://weather-api.owl-nest.ch/api';

interface ChartsMap {
  [key: string]: any;
}
interface Stats {
  temperature?: number;
  humidity?: number;
  pressure?: number;
}
interface Measurement {
  time: string;
  temperature: number;
  humidity: number;
  pressure: number;
}

const charts: ChartsMap = {};

const translations: Record<string, Record<string, string>> = {
  fr: {
    dashboardTitle: 'Tableau de bord TYTO',
    dashboardSubtitle: 'Telemetry Yielding Thermal Observations',
    tempAverage: 'Température (Moyenne)',
    humidityAverage: 'Humidité (Moyenne)',
    pressureAverage: 'Pression (Moyenne)',
    min: 'Min:',
    max: 'Max:',
    tempChart: 'Température (°C)',
    humChart: 'Humidité (%)',
    presChart: 'Pression (hPa)',
    project: 'Projet TYTO',
    tytoAPI: 'Tyto API',
    tytoESP: 'Tyto ESP',
    themeDark: 'Passer en mode sombre',
    themeLight: 'Passer en mode clair',
    switchLang: 'Switch to English',
  },
  en: {
    dashboardTitle: 'TYTO dashboard',
    dashboardSubtitle: 'Telemetry Yielding Thermal Observations',
    tempAverage: 'Temperature (Average)',
    humidityAverage: 'Humidity (Average)',
    pressureAverage: 'Pressure (Average)',
    min: 'Min:',
    max: 'Max:',
    tempChart: 'Temperature (°C)',
    humChart: 'Humidity (%)',
    presChart: 'Pressure (hPa)',
    project: 'TYTO Project',
    tytoAPI: 'Tyto API',
    tytoESP: 'Tyto ESP',
    themeDark: 'Switch to dark mode',
    themeLight: 'Switch to light mode',
    switchLang: 'Passer en français',
  },
};

let currentLang = 'fr';

function updateTooltips(): void {
  const isDark = document.body.classList.contains('dark-mode');
  const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
  const langToggle = document.getElementById('langToggle') as HTMLButtonElement;

  themeToggle.title = isDark
    ? translations[currentLang]['themeLight']
    : translations[currentLang]['themeDark'];
  langToggle.title = translations[currentLang]['switchLang'];
}

function changeLanguage(lang: string): void {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  if (charts['chart1']) charts['chart1'].data.datasets[0].label = translations[lang]['tempChart'];
  if (charts['chart2']) charts['chart2'].data.datasets[0].label = translations[lang]['humChart'];
  if (charts['chart3']) charts['chart3'].data.datasets[0].label = translations[lang]['presChart'];
  Object.values(charts).forEach((chart) => chart.update());

  updateTooltips();
}

function updateChartColors() {
  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#e0e0e0' : '#666666';
  const primary = isDark ? DARK_PRIMARY : LIGHT_PRIMARY;

  Chart.defaults.color = textColor;

  Object.values(charts).forEach((chart) => {
    if (chart.data?.datasets?.[0]) {
      chart.data.datasets[0].borderColor = primary;
      chart.data.datasets[0].backgroundColor = `${primary}33`;
    }

    if (chart.options) {
      chart.options.color = textColor;
      if (chart.options.scales) {
        if (chart.options.scales.x?.ticks) chart.options.scales.x.ticks.color = textColor;
        if (chart.options.scales.y?.ticks) chart.options.scales.y.ticks.color = textColor;
      }
    }

    chart.update();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const langToggle = document.getElementById('langToggle') as HTMLButtonElement;
  langToggle.addEventListener('click', () => {
    const newLang = currentLang === 'fr' ? 'en' : 'fr';
    changeLanguage(newLang);
  });

  const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
  if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

  const isDarkInitial = document.body.classList.contains('dark-mode');
  themeToggle.innerHTML = isDarkInitial
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    updateChartColors();
    updateTooltips();
  });

  updateTooltips();

  Chart.defaults.color = document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#666666';
  const primaryColor = document.body.classList.contains('dark-mode') ? DARK_PRIMARY : LIGHT_PRIMARY;
  initChart('chart1', translations[currentLang]['tempChart'], primaryColor);
  initChart('chart2', translations[currentLang]['humChart'], primaryColor);
  initChart('chart3', translations[currentLang]['presChart'], primaryColor);

  const segments = document.querySelectorAll('.segment');

  const activeSegment = document.querySelector('.segment.active') as HTMLButtonElement;
  updateData(Number.parseInt(activeSegment.dataset.value!));

  segments.forEach((segment) => {
    segment.addEventListener('click', (e) => {
      segments.forEach((btn) => btn.classList.remove('active'));

      const target = e.target as HTMLButtonElement;
      target.classList.add('active');

      updateData(Number.parseInt(target.dataset.value!));
    });
  });
});

function initChart(canvasId: string, label: string, color: string): void {
  const ctx = document.getElementById(canvasId) as HTMLCanvasElement;
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: label,
          data: [],
          borderColor: color,
          backgroundColor: `${color}33`,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
      },
      scales: { x: { ticks: { maxTicksLimit: 8 } } },
    },
  });
}

async function updateData(hours: number): Promise<void> {
  try {
    const [avgRes, minRes, maxRes, histRes] = await Promise.all([
      fetch(`${API_BASE_URL}/measurements/average?hours=${hours}`),
      fetch(`${API_BASE_URL}/measurements/min?hours=${hours}`),
      fetch(`${API_BASE_URL}/measurements/max?hours=${hours}`),
      fetch(`${API_BASE_URL}/measurements?hours=${hours}`),
    ]);

    if (avgRes.ok) {
      const avg: Stats = await avgRes.json();
      document.getElementById('avg-temp')!.innerText = avg.temperature
        ? `${avg.temperature} °C`
        : '-- °C';
      document.getElementById('avg-hum')!.innerText = avg.humidity ? `${avg.humidity} %` : '-- %';
      document.getElementById('avg-pres')!.innerText = avg.pressure
        ? `${avg.pressure} hPa`
        : '-- hPa';
    }

    if (minRes.ok) {
      const min: Stats = await minRes.json();
      document.getElementById('min-temp')!.innerText =
        min.temperature !== undefined ? `${min.temperature} °C` : '--';
      document.getElementById('min-hum')!.innerText =
        min.humidity !== undefined ? `${min.humidity} %` : '--';
      document.getElementById('min-pres')!.innerText =
        min.pressure !== undefined ? `${min.pressure} hPa` : '--';
    }

    if (maxRes.ok) {
      const max: Stats = await maxRes.json();
      document.getElementById('max-temp')!.innerText =
        max.temperature !== undefined ? `${max.temperature} °C` : '--';
      document.getElementById('max-hum')!.innerText =
        max.humidity !== undefined ? `${max.humidity} %` : '--';
      document.getElementById('max-pres')!.innerText =
        max.pressure !== undefined ? `${max.pressure} hPa` : '--';
    }

    if (histRes.ok) {
      const history: Measurement[] = await histRes.json();

      const labels = history.map((m) => {
        const date = new Date(m.time);
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      });

      charts['chart1'].data.labels = labels;
      charts['chart1'].data.datasets[0].data = history.map((m) => m.temperature);
      charts['chart1'].update();

      charts['chart2'].data.labels = labels;
      charts['chart2'].data.datasets[0].data = history.map((m) => m.humidity);
      charts['chart2'].update();

      charts['chart3'].data.labels = labels;
      charts['chart3'].data.datasets[0].data = history.map((m) => m.pressure);
      charts['chart3'].update();
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des données :', error);
  }
}
