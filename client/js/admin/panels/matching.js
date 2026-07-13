import { badge, toast } from '../ui.js'

export async function render(el, api) {
  el.innerHTML = `
    <div class="adm-panel-header">
      <div>
        <div class="adm-panel-title">Matching</div>
        <div class="adm-panel-sub">Queue health, deliveries, and connection funnel</div>
      </div>
    </div>
    <div class="adm-loading"><div class="adm-spinner"></div></div>`

  try {
    const { overview: ov, chart, deliveries } = await api.get('/admin/api/matching/dashboard', { days: 7, limit: 15 })

    const tierSub = `Base ${ov.deliveriesByTier.base} · Plus ${ov.deliveriesByTier.plus} · Prime ${ov.deliveriesByTier.prime}`

    el.innerHTML = `
      <div class="adm-panel-header">
        <div>
          <div class="adm-panel-title">Matching</div>
          <div class="adm-panel-sub">Queue health, deliveries, and connection funnel</div>
        </div>
      </div>

      <div class="adm-kpi-grid">
        ${kpi('Deliveries Today', ov.deliveriesToday, tierSub, 'neu')}
        ${kpi('Alignment Ready', ov.alignmentReady, 'Can receive curated matches', 'pos')}
        ${kpi('Connect Rate', ov.connectRate + '%', `${ov.feedback.connect} connects of ${sumFb(ov.feedback)} actions`, ov.connectRate >= 15 ? 'pos' : 'neu')}
        ${kpi('Accept Rate', ov.acceptRate + '%', `${ov.connections.accepted} accepted requests`, ov.acceptRate >= 50 ? 'pos' : 'neu')}
        ${kpi('Pending Requests', ov.connections.pending, 'Awaiting response', ov.connections.pending > 0 ? 'neg' : 'pos')}
        ${kpi('Base at Daily Cap', ov.baseAtCap, 'Hit 6/day delivery limit', ov.baseAtCap > 0 ? 'neu' : 'pos')}
      </div>

      <div class="adm-chart-grid">
        <div class="adm-chart-card">
          <div class="adm-chart-title">Deliveries — Last 7 Days</div>
          <div class="adm-chart-wrap"><canvas id="matchDeliveryChart"></canvas></div>
        </div>
        <div class="adm-chart-card">
          <div class="adm-chart-title">Member Actions</div>
          <div class="adm-chart-wrap"><canvas id="matchFeedbackChart"></canvas></div>
        </div>
      </div>

      <div class="adm-table-wrap" style="margin-top:24px">
        <div class="adm-chart-title" style="margin-bottom:12px">Recent Deliveries</div>
        <table class="adm-table">
          <thead>
            <tr><th>Viewer</th><th>Tier</th><th>Candidate</th><th>Delivered</th><th>Time</th></tr>
          </thead>
          <tbody id="matchRecentBody"></tbody>
        </table>
      </div>`

    renderDeliveryChart(chart)
    renderFeedbackChart(ov.feedback)
    renderRecentTable(el.querySelector('#matchRecentBody'), deliveries)
  } catch (e) {
    el.innerHTML = `
      <div class="adm-panel-header">
        <div><div class="adm-panel-title">Matching</div></div>
      </div>
      <div style="padding:40px;color:var(--adm-text-dim)">Failed to load matching data: ${esc(e.message)}</div>`
    toast(e.message, 'error')
  }
}

function renderDeliveryChart(chart) {
  new Chart(document.getElementById('matchDeliveryChart'), {
    type: 'bar',
    data: {
      labels: chart.labels,
      datasets: [
        { label: 'Base',  data: chart.base,  backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 4 },
        { label: 'Plus',  data: chart.plus,  backgroundColor: 'rgba(4,150,199,0.55)',   borderRadius: 4 },
        { label: 'Prime', data: chart.prime, backgroundColor: 'rgba(193,164,100,0.65)', borderRadius: 4 },
      ],
    },
    options: chartOpts(true),
  })
}

function renderFeedbackChart(fb) {
  new Chart(document.getElementById('matchFeedbackChart'), {
    type: 'doughnut',
    data: {
      labels: ['Connect', 'Pass', 'Decline'],
      datasets: [{
        data: [fb.connect, fb.pass, fb.decline],
        backgroundColor: ['rgba(193,164,100,0.75)', 'rgba(255,255,255,0.12)', 'rgba(220,80,80,0.55)'],
        borderWidth: 0,
        hoverOffset: 4,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.55)', font: { size: 11 }, padding: 14 } },
      },
    },
  })
}

function renderRecentTable(tbody, rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="adm-table-empty">No deliveries recorded yet.</td></tr>`
    return
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="adm-td-name">${esc(r.viewerName)}</td>
      <td>${badge(r.viewerTier, r.viewerTier)}</td>
      <td>${esc(r.candidateName)}</td>
      <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtDate(r.deliveredOn)}</td>
      <td style="font-size:0.78rem;color:var(--adm-text-faint)">${fmtTime(r.createdAt)}</td>
    </tr>`).join('')
}

function chartOpts(stacked) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } } } },
    scales: {
      x: { stacked, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
      y: { stacked, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 } } },
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

function sumFb(fb) {
  return (fb.pass || 0) + (fb.decline || 0) + (fb.connect || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
