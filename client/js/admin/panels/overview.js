export async function render(el, api) {
  const [ov, chart] = await Promise.all([
    api.get('/admin/api/analytics/overview'),
    api.get('/admin/api/analytics/chart'),
  ])

  el.innerHTML = `
    <div class="adm-panel-header">
      <div><div class="adm-panel-title">Overview</div><div class="adm-panel-sub">Platform health at a glance</div></div>
    </div>

    <div class="adm-kpi-grid">
      ${kpi('Total Users',     ov.totalUsers,        ov.newUsersToday + ' new today',       'neu')}
      ${kpi('Active Subs',     ov.activeSubscriptions, pct(ov.activeSubscriptions, ov.totalUsers) + ' of users', 'pos')}
      ${kpi('MRR',             '₱' + fmt(ov.mrr),    ov.mrrGrowth >= 0 ? '+' + ov.mrrGrowth + '% vs last mo' : ov.mrrGrowth + '% vs last mo', ov.mrrGrowth >= 0 ? 'pos' : 'neg')}
      ${kpi('Open Reports',    ov.openReports,        ov.openReports > 0 ? 'Needs review' : 'All clear', ov.openReports > 0 ? 'neg' : 'pos')}
      ${kpi('Events This Mo.', ov.eventsThisMonth,   ov.upcomingEvents + ' upcoming',       'neu')}
      ${kpi('Concierge Queue', ov.pendingBookings,    'Pending assignments',                 ov.pendingBookings > 0 ? 'neg' : 'neu')}
    </div>

    <div class="adm-chart-grid">
      <div class="adm-chart-card">
        <div class="adm-chart-title">New Signups — Last 30 Days</div>
        <div class="adm-chart-wrap"><canvas id="signupChart"></canvas></div>
      </div>
      <div class="adm-chart-card">
        <div class="adm-chart-title">Tier Breakdown</div>
        <div class="adm-chart-wrap"><canvas id="tierChart"></canvas></div>
      </div>
    </div>

    <div class="adm-chart-card" style="margin-top:0">
      <div class="adm-chart-title">Revenue — Last 6 Months (₱)</div>
      <div class="adm-chart-wrap"><canvas id="revenueChart"></canvas></div>
    </div>`

  const CHART_DEFAULTS = {
    color: 'rgba(255,255,255,0.55)',
    borderColor: 'rgba(255,255,255,0.07)',
    font: { family: "'Inter', system-ui, sans-serif", size: 11 },
  }

  // Signup line
  new Chart(document.getElementById('signupChart'), {
    type: 'line',
    data: {
      labels: chart.signups.labels,
      datasets: [{ label: 'Signups', data: chart.signups.data,
        borderColor: '#C1A464', backgroundColor: 'rgba(193,164,100,0.08)',
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#C1A464', tension: 0.35, fill: true }],
    },
    options: opts({ grid: true }),
  })

  // Tier doughnut
  new Chart(document.getElementById('tierChart'), {
    type: 'doughnut',
    data: {
      labels: ['Base', 'Plus', 'Prime'],
      datasets: [{ data: chart.tiers, backgroundColor: ['rgba(255,255,255,0.1)', '#0496C7', '#C1A464'],
        borderWidth: 0, hoverOffset: 4 }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, font: CHART_DEFAULTS.font, padding: 16 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed}` } },
      },
      cutout: '68%',
    },
  })

  // Revenue bar
  new Chart(document.getElementById('revenueChart'), {
    type: 'bar',
    data: {
      labels: chart.revenue.labels,
      datasets: [
        { label: 'Plus', data: chart.revenue.plus,  backgroundColor: 'rgba(4,150,199,0.55)', borderRadius: 4 },
        { label: 'Prime', data: chart.revenue.prime, backgroundColor: 'rgba(193,164,100,0.65)', borderRadius: 4 },
      ],
    },
    options: opts({ stacked: true, grid: true }),
  })
}

function opts({ stacked = false, grid = false } = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { stacked, grid: { color: grid ? 'rgba(255,255,255,0.05)' : 'transparent' },
           ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } } },
      y: { stacked, grid: { color: grid ? 'rgba(255,255,255,0.05)' : 'transparent' },
           ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } } },
    },
  }
}

function kpi(label, value, sub, dir) {
  return `<div class="adm-kpi">
    <div class="adm-kpi-label">${label}</div>
    <div class="adm-kpi-value">${value ?? '—'}</div>
    <div class="adm-kpi-change ${dir}">${sub}</div>
  </div>`
}

function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '0%' }

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return n.toString()
}
