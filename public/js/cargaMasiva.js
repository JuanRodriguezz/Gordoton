// public/js/cargaMasiva.js — v1.2.1
// HU-06 — Módulo de carga masiva de actualizaciones desde Excel.

const CargaMasiva = {

  gordotonId:   null,
  procesando:   false,
  _inicializado: false,

  // ─────────────────────────────────────────────
  // Inicialización — solo carga gordotones la primera vez
  // ─────────────────────────────────────────────
  async inicializar() {
    if (!this._inicializado) {
      await this.cargarGordotones();
      this._inicializado = true;
    }
    await this.cargarHistorial();
  },

  // ─────────────────────────────────────────────
  // Selector de gordotones
  // ─────────────────────────────────────────────
  async cargarGordotones() {
    try {
      const res  = await fetch(`${API}/gordotones`);
      const data = await res.json();
      const sel  = document.getElementById('cm-gordoton');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Selecciona un gordotón —</option>';
      (data.data || []).forEach(g => {
        sel.innerHTML += `<option value="${g._id}">${g.nombre}</option>`;
      });
    } catch (e) {
      this.toastError('Error cargando gordotones: ' + e.message);
    }
  },

  onGordotonChange() {
    this.gordotonId = document.getElementById('cm-gordoton').value || null;
    this.cargarHistorial();
  },

  // ─────────────────────────────────────────────
  // Historial de cargas
  // ─────────────────────────────────────────────
  async cargarHistorial() {
    const tbody = document.getElementById('cm-historial-body');
    if (!tbody) return;

    if (!this.gordotonId) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">Selecciona un gordotón para ver el historial</td></tr>`;
      return;
    }
    try {
      const res  = await fetch(`${API}/carga-masiva/${this.gordotonId}`);
      const data = await res.json();

      if (!data.data?.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">Sin cargas registradas aún</td></tr>`;
        return;
      }

      tbody.innerHTML = data.data.map(c => {
        const ok = c.estado === 'Completado';
        const badgeFilas  = ok
          ? `<span class="badge badge-ok">${c.filasExitosas} / ${c.totalFilas}</span>`
          : `<span class="badge badge-err">0 / ${c.totalFilas}</span>`;
        const badgeEstado = ok
          ? `<span class="badge badge-ok">Completado</span>`
          : `<span class="badge badge-err">${c.estado}</span>`;

        return `<tr>
          <td><strong>${c.nombreArchivo}</strong></td>
          <td style="color:var(--text-secondary)">${this.fmtFecha(c.fechaCarga)}</td>
          <td>${badgeFilas}</td>
          <td>${badgeEstado}</td>
          <td><button class="btn-link-inline" onclick="CargaMasiva.verDetalle('${c._id}')">Ver log</button></td>
        </tr>`;
      }).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">Error: ${e.message}</td></tr>`;
    }
  },

  // ─────────────────────────────────────────────
  // Ver detalle de una carga anterior
  // ─────────────────────────────────────────────
  async verDetalle(cargaId) {
    try {
      const res  = await fetch(`${API}/carga-masiva/detalle/${cargaId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const c = data.data;

      this.abrirModal();
      document.getElementById('cm-modal-archivo').textContent = c.nombreArchivo;
      this.setEstadoModal(c.estado === 'Completado' ? 'exito' : 'error');
      this.setProgreso(100, c.filasExitosas, c.totalFilas);

      const lineas = [];
      if (c.estado === 'Completado') {
        lineas.push({ tipo: 'info', texto: `── Carga completada el ${this.fmtFecha(c.fechaCarga)} ──` });
        lineas.push({ tipo: 'done', texto: `✅ ${c.filasExitosas} actualizaciones registradas correctamente.` });
      } else {
        lineas.push({ tipo: 'info', texto: `── Carga fallida el ${this.fmtFecha(c.fechaCarga)} ──` });
        (c.errores || []).forEach(e => {
          lineas.push({ tipo: 'err', texto: `Fila ${e.fila} – ${e.participante}: ${e.mensaje}` });
        });
        lineas.push({ tipo: 'err', texto: `── Se encontraron ${c.filasError} error(es). No se procesó ningún registro. ──` });
      }
      this.renderLog(lineas);
      document.getElementById('cm-btn-cerrar').disabled = false;
    } catch (e) {
      this.toastError('Error cargando detalle: ' + e.message);
    }
  },

  // ─────────────────────────────────────────────
  // Selección de archivo desde el input
  // ─────────────────────────────────────────────
  onFileSelected(input) {
    const file = input.files[0];
    if (file) this.procesarArchivo(file);
    input.value = '';
  },

  // ─────────────────────────────────────────────
  // Procesar archivo Excel (CA-01 a CA-17)
  // ─────────────────────────────────────────────
  async procesarArchivo(file) {
    if (this.procesando) return;

    // CA-01: solo .xlsx / .xls
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      this.toastError('Solo se aceptan archivos .xlsx o .xls');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toastError('El archivo supera el límite de 5 MB');
      return;
    }
    if (!this.gordotonId) {
      this.toastError('Selecciona un Gordotón antes de subir el archivo');
      return;
    }

    // Verificar que SheetJS está disponible
    if (typeof XLSX === 'undefined') {
      this.toastError('Error: librería XLSX no disponible. Recarga la página.');
      return;
    }

    // CA-03: abrir modal ANTES de procesar
    this.abrirModal();
    document.getElementById('cm-modal-archivo').textContent = file.name;
    this.setEstadoModal('procesando');
    this.setProgreso(0, 0, 0);
    this.renderLog([{ tipo: 'info', texto: 'Leyendo archivo...' }]);

    // CA-17: deshabilitar botón
    this.procesando = true;
    document.getElementById('cm-btn-subir').disabled = true;
    document.getElementById('cm-btn-cerrar').disabled = true;

    try {
      // Leer con SheetJS
      const buffer = await file.arrayBuffer();
      const wb     = XLSX.read(buffer, { type: 'array' });
      const ws     = wb.Sheets[wb.SheetNames[0]];
      const filas  = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!filas.length) {
        this.agregarLog('err', 'El archivo no contiene filas de datos.');
        this.setEstadoModal('error');
        return;
      }

      const headers = Object.keys(filas[0]);
      this.agregarLog('info', `Columnas detectadas: ${headers.join(', ')}`);
      this.agregarLog('info', `Total de filas: ${filas.length}`);
      this.agregarLog('info', '── Enviando al servidor para validación ──');
      this.setProgreso(10, 0, filas.length);

      // Enviar JSON al backend
      const res  = await fetch(`${API}/carga-masiva/${this.gordotonId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombreArchivo: file.name, filas }),
      });
      const data = await res.json();

      this.setProgreso(100, data.filasExitosas || 0, data.totalFilas || filas.length);

      if (data.success) {
        // CA-15: éxito
        this.setEstadoModal('exito');
        this.agregarLog('info', '── Validación completa: todas las filas OK ──');
        this.agregarLog('info', '── Inserción transaccional exitosa ──');
        (data.logValidacion || []).forEach(l => {
          const fechaStr = l.fecha ? ` · ${l.fecha}` : '';
          this.agregarLog('ok', `Fila ${l.numFila} – ${l.nombre}: insertado${fechaStr}`);
        });
        this.agregarLog('done', data.message);
        await this.cargarHistorial();
      } else {
        // CA-08: errores de validación
        this.setEstadoModal('error');
        this.agregarLog('info', '── Fase de validación ──');
        (data.logValidacion || []).forEach(l => {
          this.agregarLog('ok', `Fila ${l.numFila} – ${l.nombre}: OK`);
        });
        (data.errores || []).forEach(e => {
          this.agregarLog('err', `Fila ${e.fila} – ${e.participante}: ${e.mensaje}`);
        });
        this.agregarLog('err', data.message || 'Error de validación.');
        await this.cargarHistorial();
      }

    } catch (e) {
      this.setEstadoModal('error');
      this.agregarLog('err', `Error inesperado: ${e.message}`);
    } finally {
      this.procesando = false;
      const btnSubir  = document.getElementById('cm-btn-subir');
      const btnCerrar = document.getElementById('cm-btn-cerrar');
      if (btnSubir)  btnSubir.disabled  = false;
      if (btnCerrar) btnCerrar.disabled = false;
    }
  },

  // ─────────────────────────────────────────────
  // Descargar plantilla (CA-18)
  // ─────────────────────────────────────────────
  async descargarPlantilla() {
    if (!this.gordotonId) {
      this.toastError('Selecciona un Gordotón para descargar la plantilla');
      return;
    }
    if (typeof XLSX === 'undefined') {
      this.toastError('Error: librería XLSX no disponible. Recarga la página.');
      return;
    }
    try {
      const res  = await fetch(`${API}/carga-masiva/plantilla/${this.gordotonId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const wb  = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(data.participantes);
      XLSX.utils.book_append_sheet(wb, ws1, 'Carga masiva');

      const instrucciones = [
        { Campo: 'Participante',   Tipo: 'Requerido', Descripcion: 'Nombre exacto del participante registrado en el gordoton', Ejemplo: 'Carlos Mendez' },
        { Campo: 'Peso Actual',    Tipo: 'Requerido', Descripcion: 'Numero positivo en kg. Maximo 300.',                       Ejemplo: '88.5' },
        { Campo: 'Grasa Actual',   Tipo: 'Requerido', Descripcion: 'Numero positivo. Maximo 100.',                             Ejemplo: '24.1' },
        { Campo: 'Musculo Actual', Tipo: 'Requerido', Descripcion: 'Numero positivo en kg.',                                   Ejemplo: '42.3' },
        { Campo: 'Fecha',          Tipo: 'Opcional',  Descripcion: 'Fecha de la actualizacion. Si se omite se usa la fecha de hoy.', Ejemplo: '15/01/2026' },
        { Campo: 'Descripcion',    Tipo: 'Opcional',  Descripcion: 'Texto libre de observaciones. Si se omite se usa: Carga masiva - [archivo]', Ejemplo: 'Medicion mensual enero' },
      ];
      const ws2 = XLSX.utils.json_to_sheet(instrucciones);
      XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones');

      XLSX.writeFile(wb, `plantilla_gordoton_${Date.now()}.xlsx`);
      UI.toast('✅ Plantilla descargada correctamente');
    } catch (e) {
      this.toastError('Error generando plantilla: ' + e.message);
    }
  },

  // ─────────────────────────────────────────────
  // Helpers del modal
  // ─────────────────────────────────────────────
  abrirModal() {
    const modal = document.getElementById('cm-modal');
    if (modal) modal.style.display = 'flex';
    this.limpiarLog();
  },

  cerrarModal() {
    if (this.procesando) return;
    const modal = document.getElementById('cm-modal');
    if (modal) modal.style.display = 'none';
  },

  setEstadoModal(estado) {
    const dot = document.getElementById('cm-estado-dot');
    const txt = document.getElementById('cm-estado-texto');
    const bar = document.getElementById('cm-progress-bar');
    if (!dot || !txt || !bar) return;

    const mapa = {
      procesando: { dot: 'dot-run', txt: 'Procesando...',       color: 'var(--text-accent)',  bar: 'var(--text-accent)'  },
      exito:      { dot: 'dot-ok',  txt: 'Completado',          color: 'var(--text-success)', bar: 'var(--text-success)' },
      error:      { dot: 'dot-err', txt: 'Error de validación', color: 'var(--text-danger)',  bar: 'var(--text-danger)'  },
    };
    const cfg = mapa[estado] || mapa.procesando;
    dot.className      = `dot ${cfg.dot}`;
    txt.textContent    = cfg.txt;
    txt.style.color    = cfg.color;
    bar.style.background = cfg.bar;
  },

  setProgreso(pct, procesadas, total) {
    const bar    = document.getElementById('cm-progress-bar');
    const filas  = document.getElementById('cm-progress-filas');
    const pctEl  = document.getElementById('cm-progress-pct');
    if (bar)   bar.style.width      = `${pct}%`;
    if (filas) filas.textContent    = `${procesadas} / ${total} filas`;
    if (pctEl) pctEl.textContent    = `${pct}%`;
  },

  limpiarLog() {
    const box = document.getElementById('cm-log');
    if (box) box.innerHTML = '';
  },

  agregarLog(tipo, texto) {
    const box = document.getElementById('cm-log');
    if (!box) return;
    const div = document.createElement('div');
    div.className   = { ok: 'log-ok', err: 'log-err', info: 'log-info', done: 'log-done' }[tipo] || 'log-info';
    div.textContent = texto;
    box.appendChild(div);
    box.scrollTop   = box.scrollHeight;
  },

  renderLog(lineas) {
    this.limpiarLog();
    lineas.forEach(l => this.agregarLog(l.tipo, l.texto));
  },

  fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
    return `${String(d.getDate()).padStart(2,'0')} ${m} ${d.getFullYear()}`;
  },

  toastError(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent       = '❌ ' + msg;
    t.style.display     = 'block';
    t.style.background  = '#A32D2D';
    t.style.color       = '#fff';
    clearTimeout(this._toast);
    this._toast = setTimeout(() => { t.style.display = 'none'; }, 3500);
  },
};

window.CargaMasiva = CargaMasiva;
