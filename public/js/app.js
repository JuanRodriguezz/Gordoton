// public/js/app.js
// Módulos del frontend para HU-01, HU-04 y HU-05.
// Se comunica con la API REST en /api/*

const API = 'http://localhost:3000/api';

// ══════════════════════════════════════════════════
// UTILIDADES GLOBALES
// ══════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const UI = {
  toast(msg, dur = 2800) {
    const t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => { t.style.display = 'none'; }, dur);
  },
  abrirModal(id)  { $(id).style.display = 'flex'; },
  cerrarModal(id) { $(id).style.display = 'none'; },
  abrirModalCrear() {
    $('crear-nombre').value = '';
    $('crear-descripcion').value = '';
    $('crear-inicio').value = '';
    $('crear-fin').value = '';
    $('crear-error').style.display = 'none';
    UI.abrirModal('modal-crear');
  },
  showError(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.style.display = 'block';
  },
  fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
    return `${String(d.getDate()).padStart(2,'0')} ${m} ${d.getFullYear()}`;
  },
};

async function apiFetch(url, opts = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error en la solicitud');
  return data;
}

// ══════════════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════════════
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('page-' + btn.dataset.page).classList.add('active');

    // Cargar datos al cambiar de página
    if (btn.dataset.page === 'gordotones')   Gordotones.cargar();
    if (btn.dataset.page === 'dashboard')    Dashboard.inicializar();
    if (btn.dataset.page === 'ranking')      Ranking.inicializar();
    if (btn.dataset.page === 'carga-masiva') CargaMasiva.inicializar();
  });
});

// ══════════════════════════════════════════════════
// MÓDULO: GORDOTONES (HU-01 — listado + crear)
// ══════════════════════════════════════════════════
const Gordotones = {
  datos: [],

  async cargar() {
    try {
      const res = await apiFetch('/gordotones');
      this.datos = res.data;
      this.renderMetrics();
      this.renderTabla();
    } catch (e) {
      $('tbody-gordotones').innerHTML = `<tr><td colspan="6" class="loading-cell">Error: ${e.message}</td></tr>`;
    }
  },

  renderMetrics() {
    const total     = this.datos.length;
    const activos   = this.datos.filter(g => g.estado === 'Activo').length;
    const partic    = this.datos.reduce((a, g) => a + (g.totalParticipantes || 0), 0);
    $('metrics-gordotones').innerHTML = `
      <div class="metric">
        <div class="metric-label">Total gordotones</div>
        <div class="metric-value">${total}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Activos ahora</div>
        <div class="metric-value pos">${activos}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Participantes totales</div>
        <div class="metric-value">${partic}</div>
      </div>`;
  },

  renderTabla() {
    if (!this.datos.length) {
      $('tbody-gordotones').innerHTML = `<tr><td colspan="6" class="loading-cell">No hay gordotones registrados aún.</td></tr>`;
      return;
    }
    $('tbody-gordotones').innerHTML = this.datos.map(g => `
      <tr>
        <td><strong>${g.nombre}</strong></td>
        <td>${UI.fmtFecha(g.fechaInicio)}</td>
        <td>${UI.fmtFecha(g.fechaFin)}</td>
        <td><span class="badge badge-${g.estado.toLowerCase()}">${g.estado}</span></td>
        <td><span class="badge badge-count">${g.totalParticipantes || 0} inscritos</span></td>
        <td>
          <button class="btn-icon" onclick="Gordotones.cambiarEstado('${g._id}','${g.estado}')"
            title="${g.estado === 'Activo' ? 'Finalizar' : 'Reactivar'}">
            ${g.estado === 'Activo' ? '⏹' : '▶'}
          </button>
        </td>
      </tr>`).join('');
  },

  async crear() {
    $('crear-error').style.display = 'none';
    const nombre      = $('crear-nombre').value.trim();
    const descripcion = $('crear-descripcion').value.trim();
    const fechaInicio = $('crear-inicio').value;
    const fechaFin    = $('crear-fin').value;

    if (!nombre || !fechaInicio || !fechaFin) {
      return UI.showError('crear-error', 'Nombre, fecha de inicio y fecha de fin son obligatorios.');
    }
    if (fechaInicio > fechaFin) {
      return UI.showError('crear-error', 'La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
    try {
      await apiFetch('/gordotones', {
        method: 'POST',
        body: JSON.stringify({ nombre, descripcion, fechaInicio, fechaFin }),
      });
      UI.cerrarModal('modal-crear');
      UI.toast('✅ Gordotón creado correctamente');
      this.cargar();
    } catch (e) {
      UI.showError('crear-error', e.message);
    }
  },

  async cambiarEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'Activo' ? 'Finalizado' : 'Activo';
    if (!confirm(`¿Cambiar estado a "${nuevoEstado}"?`)) return;
    try {
      await apiFetch(`/gordotones/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      UI.toast(`Estado actualizado a "${nuevoEstado}"`);
      this.cargar();
    } catch (e) {
      UI.toast('❌ ' + e.message);
    }
  },
};

// ══════════════════════════════════════════════════
// MÓDULO: DASHBOARD (HU-04)
// ══════════════════════════════════════════════════
const Dashboard = {
  charts: {},
  gordotones: [],

  async inicializar() {
    if (this.gordotones.length) return;
    try {
      const res = await apiFetch('/gordotones');
      this.gordotones = res.data;
      const sel = $('dash-gordoton');
      sel.innerHTML = '<option value="">— Selecciona un gordotón —</option>';
      this.gordotones.forEach(g => {
        sel.innerHTML += `<option value="${g._id}">${g.nombre}</option>`;
      });
    } catch (e) {
      UI.toast('Error cargando gordotones: ' + e.message);
    }
  },

  async onGordotonChange() {
    const gId = $('dash-gordoton').value;
    const selPart = $('dash-participante');
    selPart.innerHTML = '<option value="">— Selecciona un participante —</option>';
    selPart.disabled = true;
    $('dash-content').style.display = 'none';
    $('dash-empty').style.display = 'block';
    $('dash-empty-msg').textContent = 'Selecciona un participante para ver su avance.';

    if (!gId) return;
    try {
      const res = await apiFetch(`/dashboard/${gId}/participantes`);
      res.data.forEach(p => {
        selPart.innerHTML += `<option value="${p._id}">${p.nombre}${!p.tieneActualizaciones ? ' (sin datos)' : ''}</option>`;
      });
      selPart.disabled = false;
    } catch (e) {
      UI.toast('Error cargando participantes: ' + e.message);
    }
  },

  async cargar() {
    const gId  = $('dash-gordoton').value;
    const pId  = $('dash-participante').value;
    if (!gId || !pId) return;

    const desde = $('dash-desde').value;
    const hasta = $('dash-hasta').value;
    let qs = '';
    if (desde) qs += `fechaInicio=${desde}&`;
    if (hasta) qs += `fechaFin=${hasta}`;

    try {
      const res = await apiFetch(`/dashboard/${gId}/${pId}${qs ? '?' + qs : ''}`);

      if (res.vacio) {
        $('dash-content').style.display = 'none';
        $('dash-empty').style.display = 'block';
        $('dash-empty-msg').textContent = res.mensaje;
        return;
      }

      $('dash-empty').style.display = 'none';
      $('dash-content').style.display = 'block';

      this.renderMetrics(res.resumen);
      this.renderCharts(res.graficas, res.resumen);
    } catch (e) {
      UI.toast('Error: ' + e.message);
    }
  },

  renderMetrics(r) {
    // esMejora: define si el cambio es positivo para la competencia
    //   peso    → bajar es mejora (delta negativo = verde)
    //   grasa   → bajar es mejora (delta negativo = verde)
    //   musculo → subir es mejora (delta positivo = verde)
    const esMejora = (v, campo) => {
      if (v === 0) return null; // neutro
      if (campo === 'musculo') return v > 0;
      return v < 0;
    };

    const fmt = (v, campo, unidad = '') => {
      const mejora = esMejora(v, campo);
      const cls    = mejora === null ? 'neu' : (mejora ? 'pos' : 'neg');
      // Flecha = dirección REAL del cambio (▲ subió, ▼ bajó)
      // Color  = si ese cambio es buena o mala noticia
      const flecha = v === 0 ? '→' : (v > 0 ? '▲' : '▼');
      const sign   = v > 0 ? '+' : '';
      return `<span class="${cls}">${flecha} ${sign}${v}${unidad}</span>`;
    };

    $('dash-metrics').innerHTML = `
      <div class="metric">
        <div class="metric-label">Δ PESO</div>
        <div class="metric-value">${fmt(r.deltaPeso.valor, 'peso', ' kg')}</div>
        <div class="metric-sub">${r.pesoInicial} → ${r.pesoActual} kg · ${r.ultimaFecha}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Δ GRASA</div>
        <div class="metric-value">${fmt(r.deltaGrasa.valor, 'grasa')}</div>
        <div class="metric-sub">${r.grasaInicial} → ${r.grasaActual} · ${r.ultimaFecha}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Δ MÚSCULO</div>
        <div class="metric-value">${fmt(r.deltaMusculo.valor, 'musculo', ' kg')}</div>
        <div class="metric-sub">${r.musculoInicial} → ${r.musculoActual} kg · ${r.ultimaFecha}</div>
      </div>`;
  },

  renderCharts(g, resumen) {
    // Prepend del punto inicial: el participante tiene valores base registrados
    // al inscribirse (pesoInicial, grasaInicial, musculoInicial).
    // Ese punto no aparece en ACTUALIZACION pero es el origen real de la línea.
    // Lo añadimos al inicio de cada serie con la etiqueta "Inicio".
    if (resumen) {
      g = {
        ...g,
        labels:      ['Inicio', ...g.labels],
        peso:        { serie: [resumen.pesoInicial,    ...g.peso.serie] },
        composicion: {
          grasa:   [resumen.grasaInicial,   ...g.composicion.grasa],
          musculo: [resumen.musculoInicial, ...g.composicion.musculo],
        },
        scores: {
          grasa:   [0, ...g.scores.grasa],
          musculo: [0, ...g.scores.musculo],
          recomp:  [0, ...g.scores.recomp],
        },
      };
    }
    const dark   = matchMedia('(prefers-color-scheme: dark)').matches;
    const grid   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const txtClr = dark ? '#a0a09a' : '#5a5a56';

    const defaults = {
      responsive: true,
      animation: { duration: 300 },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 }, color: txtClr } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
      },
      scales: {
        x: { grid: { color: grid }, ticks: { color: txtClr, font: { size: 11 } } },
        y: { grid: { color: grid }, ticks: { color: txtClr, font: { size: 11 } } },
      },
    };

    // Escala con contexto real: el eje Y no empieza desde el valor mínimo del dataset
    // sino desde un valor que muestra el cambio en proporción correcta.
    // suggestedMin = min(serie) - 10% del rango, para que variaciones pequeñas
    // no se vean exageradas ni la gráfica aparezca "al revés".
    const scaleWithContext = (serie) => {
      const min = Math.min(...serie);
      const max = Math.max(...serie);
      const rango = max - min || 1;
      return {
        suggestedMin: Math.max(0, min - rango * 1.5),
        suggestedMax: max + rango * 1.5,
      };
    };

    const mk = (id, labels, datasets) => {
      if (this.charts[id]) this.charts[id].destroy();
      this.charts[id] = new Chart($(id), {
        type: 'line',
        data: { labels, datasets },
        options: { ...defaults },
      });
    };

    // Gráfica 1: Peso — escala con contexto para que subidas/bajadas
    // pequeñas no dominen visualmente el 100% del eje Y
    const scalePeso = scaleWithContext(g.peso.serie);
    if (this.charts['chart-peso']) this.charts['chart-peso'].destroy();
    this.charts['chart-peso'] = new Chart($('chart-peso'), {
      type: 'line',
      data: {
        labels: g.labels,
        datasets: [{
          label: 'Peso kg', data: g.peso.serie,
          borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,0.1)',
          tension: 0.35, fill: true, pointRadius: 5, pointHoverRadius: 7,
        }]
      },
      options: {
        ...defaults,
        scales: {
          x: { grid: { color: grid }, ticks: { color: txtClr, font: { size: 11 } } },
          y: {
            grid: { color: grid },
            ticks: { color: txtClr, font: { size: 11 } },
            suggestedMin: scalePeso.suggestedMin,
            suggestedMax: scalePeso.suggestedMax,
            title: { display: true, text: 'kg', color: txtClr, font: { size: 11 } },
          },
        },
      },
    });

    // Gráfica 2: Composición corporal
    const allComp = [...g.composicion.grasa, ...g.composicion.musculo];
    const scaleComp = scaleWithContext(allComp);
    if (this.charts['chart-comp']) this.charts['chart-comp'].destroy();
    this.charts['chart-comp'] = new Chart($('chart-comp'), {
      type: 'line',
      data: {
        labels: g.labels,
        datasets: [
          {
            label: 'Grasa', data: g.composicion.grasa,
            borderColor: '#E24B4A', backgroundColor: 'rgba(226,75,74,0.08)',
            tension: 0.35, pointRadius: 5, pointHoverRadius: 7,
          },
          {
            label: 'Músculo kg', data: g.composicion.musculo,
            borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,0.08)',
            tension: 0.35, pointRadius: 5, pointHoverRadius: 7,
          },
        ]
      },
      options: {
        ...defaults,
        scales: {
          x: { grid: { color: grid }, ticks: { color: txtClr, font: { size: 11 } } },
          y: {
            grid: { color: grid },
            ticks: { color: txtClr, font: { size: 11 } },
            suggestedMin: scaleComp.suggestedMin,
            suggestedMax: scaleComp.suggestedMax,
          },
        },
      },
    });

    // Gráfica 3: Scores — empieza desde 0 siempre (scores acumulados)
    if (this.charts['chart-scores']) this.charts['chart-scores'].destroy();
    this.charts['chart-scores'] = new Chart($('chart-scores'), {
      type: 'line',
      data: {
        labels: g.labels,
        datasets: [
          {
            label: 'Score grasa',   data: g.scores.grasa,
            borderColor: '#E24B4A', tension: 0.35, pointRadius: 5, pointHoverRadius: 7,
          },
          {
            label: 'Score músculo', data: g.scores.musculo,
            borderColor: '#1D9E75', tension: 0.35, pointRadius: 5, pointHoverRadius: 7,
          },
          {
            label: 'Score recomp',  data: g.scores.recomp,
            borderColor: '#7F77DD', tension: 0.35, pointRadius: 5, pointHoverRadius: 7,
            borderWidth: 2.5,
          },
        ]
      },
      options: {
        ...defaults,
        scales: {
          x: { grid: { color: grid }, ticks: { color: txtClr, font: { size: 11 } } },
          y: {
            grid: { color: grid },
            ticks: { color: txtClr, font: { size: 11 } },
            suggestedMin: 0,
          },
        },
      },
    });
  },
};

// ══════════════════════════════════════════════════
// MÓDULO: RANKING (HU-05)
// ══════════════════════════════════════════════════
const Ranking = {
  datos: null,
  catActiva: 'perdidaGrasa',
  gordotones: [],

  async inicializar() {
    if (this.gordotones.length) return;
    try {
      const res = await apiFetch('/gordotones');
      this.gordotones = res.data;
      const sel = $('rank-gordoton');
      sel.innerHTML = '<option value="">— Selecciona un gordotón —</option>';
      this.gordotones.forEach(g => {
        sel.innerHTML += `<option value="${g._id}">${g.nombre}</option>`;
      });
    } catch (e) {
      UI.toast('Error cargando gordotones: ' + e.message);
    }
  },

  async cargar() {
    const gId = $('rank-gordoton').value;
    if (!gId) {
      $('rank-content').style.display = 'none';
      $('rank-empty').style.display = 'block';
      return;
    }
    try {
      const res = await apiFetch(`/ranking/${gId}`);
      this.datos = res.rankings;
      $('rank-empty').style.display = 'none';
      $('rank-content').style.display = 'block';
      this.renderTabla(this.catActiva);
    } catch (e) {
      UI.toast('Error cargando ranking: ' + e.message);
    }
  },

  switchTab(btn) {
    document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    this.catActiva = btn.dataset.cat;
    if (this.datos) this.renderTabla(this.catActiva);
  },

  renderTabla(cat) {
    const cat_data = this.datos[cat];
    if (!cat_data || !cat_data.data.length) {
      $('rank-thead').innerHTML = '';
      $('rank-tbody').innerHTML = `<tr><td colspan="4" class="loading-cell">Sin participantes con actualizaciones en esta categoría.</td></tr>`;
      return;
    }

    const scoreLabel = {
      perdidaGrasa:          'Score grasa',
      gananciaMusculo:       'Score músculo',
      recomposicionCorporal: 'Score recomp',
    }[cat];

    const scoreKey = cat_data.scoreKey;

    $('rank-thead').innerHTML = `
      <tr>
        <th style="width:60px">#</th>
        <th>Participante</th>
        <th>${scoreLabel}</th>
        <th>Última actualización</th>
      </tr>`;

    $('rank-tbody').innerHTML = cat_data.data.map(r => `
      <tr class="${r.esPrimero ? 'gold-row' : ''}">
        <td>${r.esPrimero ? '🥇' : `<span class="pos-num">${r.posicion}</span>`}</td>
        <td>${r.nombre}</td>
        <td><span class="score-mono">${r[scoreKey]}</span></td>
        <td style="color:var(--text-3)">${r.ultimaFecha}</td>
      </tr>`).join('');
  },
};

// ══════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  Gordotones.cargar();
});
