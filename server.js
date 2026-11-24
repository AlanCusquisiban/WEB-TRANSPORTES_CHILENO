require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'transportes_chileno'
};

let pool = null;
let isDbConnected = false;

async function initDatabase() {
  console.log('[MySQL] Verificando conexión al servidor de base de datos...');
  try {
    const initConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
    await initConn.end();

    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      multipleStatements: true
    });

    const [tables] = await pool.query('SHOW TABLES;');
    if (tables.length === 0) {
      const sqlPath = path.join(__dirname, 'database', 'transportes_chileno.sql');
      if (fs.existsSync(sqlPath)) {
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sqlContent);
        console.log('[MySQL] Schema y datos iniciales importados exitosamente.');
      }
    }

    isDbConnected = true;
    console.log(`[MySQL] Conexión establecida con '${DB_CONFIG.database}'.`);
  } catch (error) {
    isDbConnected = false;
    console.warn('[MySQL] No se pudo conectar a MySQL:', error.message);
  }
}

app.get('/api/health', async (_req, res) => {
  if (!isDbConnected || !pool) {
    return res.json({ ok: false, connected: false, mode: 'offline_fallback' });
  }
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS database_name, NOW() AS server_time');
    const [[{ total_vehiculos }]] = await pool.query('SELECT COUNT(*) AS total_vehiculos FROM vehiculos');
    const [[{ total_viajes }]] = await pool.query('SELECT COUNT(*) AS total_viajes FROM viajes_historial');
    res.json({
      ok: true,
      connected: true,
      database: rows[0].database_name,
      serverTime: rows[0].server_time,
      vehiculos: total_vehiculos,
      viajes: total_viajes
    });
  } catch (err) {
    res.status(500).json({ ok: false, connected: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Bootstrap unificado (compatible al 100% con script.js)
// -----------------------------------------------------------------------------
app.get('/api/bootstrap', async (_req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ ok: false, error: 'Base de datos no conectada' });
  }

  try {
    // 1. Vehículos
    const [vehiclesRows] = await pool.query('SELECT * FROM vehiculos ORDER BY id ASC');
    const vehicles = vehiclesRows.map(v => ({
      id: v.codigo || `V-${String(v.id).padStart(2, '0')}`,
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      capacidad: Number(v.capacidad_toneladas),
      ejes: v.ejes || 4,
      soat: v.soat || 'Vigente',
      rt: v.rt || 'Aprobado',
      estado: v.estado
    }));

    // 2. Conductores (incluye categoría, DNI, pass, vehículo y placa asignada)
    const [driversRows] = await pool.query(`
      SELECT c.*,
             l.numero AS licencia_num,
             l.categoria AS licencia_cat,
             v.codigo AS vehiculo_codigo,
             v.placa AS vehiculo_placa
      FROM conductores c
      LEFT JOIN licencias l ON c.licencia_id = l.id
      LEFT JOIN (
        SELECT a1.conductor_id, a1.vehiculo_id
        FROM asignaciones a1
        INNER JOIN (
          SELECT conductor_id, MAX(id) AS max_id
          FROM asignaciones
          WHERE estado IN ('En Ruta', 'Programada')
          GROUP BY conductor_id
        ) a2 ON a1.id = a2.max_id
      ) asg ON asg.conductor_id = c.id
      LEFT JOIN vehiculos v ON asg.vehiculo_id = v.id
      ORDER BY c.id ASC
    `);
    const drivers = driversRows.map(d => ({
      id: d.codigo || `D-${String(d.id).padStart(2, '0')}`,
      nombres: d.nombres,
      apellidos: d.apellidos,
      nombre: `${d.nombres} ${d.apellidos}`.trim(),
      dni: d.documento || '',
      licencia: d.licencia_num || 'Q-00000000',
      categoria: d.licencia_cat || 'A-IIIc',
      telefono: d.telefono || '',
      pass: d.password_acceso || '1234',
      password: d.password_acceso || '1234',
      vehiculoAsignado: d.vehiculo_codigo || 'Sin asignar',
      placa: d.vehiculo_placa || '—',
      estado: d.estado
    }));

    // 3. Asignaciones (incluye `inicio` y `fechaInicio`)
    const [assignRows] = await pool.query(`
      SELECT a.*, v.codigo AS vehiculo_codigo, v.placa,
             c.codigo AS conductor_codigo, CONCAT(c.nombres, ' ', c.apellidos) AS conductor_nombre
      FROM asignaciones a
      JOIN vehiculos v ON a.vehiculo_id = v.id
      JOIN conductores c ON a.conductor_id = c.id
      ORDER BY a.id DESC
    `);
    const assignments = assignRows.map(a => {
      const isoStart = a.fecha_inicio ? new Date(a.fecha_inicio).toISOString().slice(0, 16) : '';
      return {
        id: a.codigo || `A-${String(a.id).padStart(2, '0')}`,
        vehiculoId: a.vehiculo_codigo,
        placa: a.placa,
        conductorId: a.conductor_codigo,
        conductor: a.conductor_nombre,
        inicio: isoStart,
        fechaInicio: isoStart,
        fechaFin: a.fecha_fin ? new Date(a.fecha_fin).toISOString().slice(0, 16) : '',
        estado: a.estado,
        observaciones: a.observaciones || ''
      };
    });

    // 4. Historial de Viajes
    const [tripRows] = await pool.query('SELECT * FROM viajes_historial ORDER BY fecha DESC, id DESC');
    const journeyHistory = tripRows.map(t => ({
      id: t.codigo_viaje,
      fecha: t.fecha ? new Date(t.fecha).toISOString().split('T')[0] : '',
      vehiculoId: vehiclesRows.find(v => v.id === t.vehiculo_id)?.codigo || t.placa,
      conductor: t.conductor_nombre,
      placa: t.placa,
      origen: t.origen,
      destino: t.destino,
      inicio: t.duracion || '—',
      fin: t.estado || 'Completado',
      duracion: t.duracion,
      paradas: t.paradas,
      km: Number(t.distancia_km),
      combustibleGals: Number(t.combustible_gal),
      costoCombustible: Number(t.costo_combustible),
      costoPeajes: Number(t.costo_peajes),
      viaticoConductor: Number(t.viatico_conductor),
      costoOperativoTotal: Number(t.costo_operativo_total),
      fleteComercial: Number(t.flete_comercial),
      utilidadNeta: Number(t.utilidad_neta),
      margenPorcentaje: Number(t.margen_porcentaje),
      estado: t.estado
    }));

    // 5. Fallas Mecánicas (incluye categoria/tipo y desc/descripcion)
    const [faultRows] = await pool.query(`
      SELECT f.*, v.codigo AS vehiculo_codigo, v.placa
      FROM fallas_mecanicas f
      JOIN vehiculos v ON f.vehiculo_id = v.id
      ORDER BY f.id DESC
    `);
    const mechanicalFaults = faultRows.map(f => ({
      id: f.codigo || `F-${String(f.id).padStart(2, '0')}`,
      vehiculoId: f.vehiculo_codigo,
      placa: f.placa,
      categoria: f.tipo || 'Motor',
      tipo: f.tipo || 'Motor',
      desc: f.descripcion || '',
      descripcion: f.descripcion || '',
      fecha: f.fecha_reporte ? new Date(f.fecha_reporte).toISOString().split('T')[0] : '',
      estado: (f.estado === 'Resuelto' || f.estado === 'Resuelta') ? 'Resuelto' : 'En Taller'
    }));

    // 6. Alertas
    const [alertRows] = await pool.query(`
      SELECT a.*, v.codigo AS vehiculo_codigo, v.placa,
             CONCAT(c.nombres, ' ', c.apellidos) AS conductor_nombre
      FROM alertas a
      JOIN vehiculos v ON a.vehiculo_id = v.id
      LEFT JOIN conductores c ON a.conductor_id = c.id
      ORDER BY a.id DESC
    `);
    const alerts = alertRows.map(a => ({
      id: a.codigo || `ALT-${String(a.id).padStart(2, '0')}`,
      tipo: a.tipo,
      placa: a.placa,
      vehiculoId: a.vehiculo_codigo,
      conductor: a.conductor_nombre || 'No asignado',
      mensaje: a.mensaje,
      timestamp: a.creada_en ? new Date(a.creada_en).toLocaleString('es-PE') : '',
      estado: (a.estado === 'Activa' || a.estado === 'Pendiente') ? 'Pendiente' : 'Atendida',
      lat: a.latitud ? Number(a.latitud) : 0,
      lng: a.longitud ? Number(a.longitud) : 0
    }));

    // 7. Credenciales Admin
    const [configRows] = await pool.query("SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('admin_user', 'admin_pass')");
    const adminConfig = { user: 'admin', pass: 'admin' };
    configRows.forEach(c => {
      if (c.clave === 'admin_user') adminConfig.user = c.valor;
      if (c.clave === 'admin_pass') adminConfig.pass = c.valor;
    });

    res.json({
      ok: true,
      vehicles,
      drivers,
      assignments,
      journeyHistory,
      mechanicalFaults,
      alerts,
      adminCredentials: adminConfig
    });
  } catch (error) {
    console.error('Error en /api/bootstrap:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Vehículos
// -----------------------------------------------------------------------------
app.post('/api/vehiculos', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, placa, marca, modelo, anio, capacidad, ejes, estado, soat, rt } = req.body;
  try {
    const [result] = await pool.execute(
      `INSERT INTO vehiculos (codigo, placa, marca, modelo, anio, capacidad_toneladas, ejes, estado, soat, rt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo || placa, placa, marca, modelo, anio, capacidad || 20, ejes || 4, estado || 'Disponible', soat || 'Vigente', rt || 'Aprobado']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/vehiculos/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { placa, marca, modelo, anio, capacidad, ejes, estado } = req.body;
  try {
    if (placa) {
      await pool.execute(
        `UPDATE vehiculos SET placa=?, marca=?, modelo=?, anio=?, capacidad_toneladas=?, ejes=COALESCE(?, ejes), estado=?
         WHERE codigo=? OR placa=?`,
        [placa, marca, modelo, anio, capacidad, ejes ?? null, estado, req.params.codigo, req.params.codigo]
      );
    } else if (estado) {
      await pool.execute(
        `UPDATE vehiculos SET estado=? WHERE codigo=? OR placa=?`,
        [estado, req.params.codigo, req.params.codigo]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/vehiculos/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  try {
    await pool.execute('DELETE FROM vehiculos WHERE codigo=? OR placa=?', [req.params.codigo, req.params.codigo]);
    res.json({ ok: true });
  } catch (err) {
    // Si tiene asignaciones históricas, hacer baja lógica
    await pool.execute("UPDATE vehiculos SET estado='Inactivo' WHERE codigo=? OR placa=?", [req.params.codigo, req.params.codigo]);
    res.json({ ok: true, softDeleted: true });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Conductores (NUEVO)
// -----------------------------------------------------------------------------
app.post('/api/conductores', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, nombres, apellidos, dni, licencia, categoria, telefono, pass, estado } = req.body;
  try {
    let licenciaId = null;
    if (licencia) {
      const [[existingLic]] = await pool.execute('SELECT id FROM licencias WHERE numero=?', [licencia]);
      if (existingLic) {
        licenciaId = existingLic.id;
      } else {
        const [licRes] = await pool.execute(
          `INSERT INTO licencias (numero, categoria, fecha_emision, fecha_vencimiento, estado)
           VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 YEAR), 'Vigente')`,
          [licencia, categoria || 'A-IIIc']
        );
        licenciaId = licRes.insertId;
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO conductores (codigo, licencia_id, nombres, apellidos, documento, telefono, password_acceso, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, licenciaId, nombres, apellidos || '', dni, telefono || null, pass || '1234', estado || 'Disponible']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/conductores/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { nombres, apellidos, dni, licencia, categoria, telefono, pass, estado } = req.body;
  try {
    const [[cond]] = await pool.execute('SELECT * FROM conductores WHERE codigo=? OR id=?', [req.params.codigo, req.params.codigo]);
    if (!cond) return res.status(404).json({ ok: false, error: 'Conductor no encontrado' });

    if (licencia) {
      if (cond.licencia_id) {
        await pool.execute(
          'UPDATE licencias SET numero=?, categoria=COALESCE(?, categoria) WHERE id=?',
          [licencia, categoria ?? null, cond.licencia_id]
        );
      } else {
        const [[existingLic]] = await pool.execute('SELECT id FROM licencias WHERE numero=?', [licencia]);
        let licId = existingLic?.id;
        if (!licId) {
          const [licRes] = await pool.execute(
            `INSERT INTO licencias (numero, categoria, fecha_emision, fecha_vencimiento, estado)
             VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 YEAR), 'Vigente')`,
            [licencia, categoria || 'A-IIIc']
          );
          licId = licRes.insertId;
        }
        await pool.execute('UPDATE conductores SET licencia_id=? WHERE id=?', [licId, cond.id]);
      }
    }

    // Mapear 'Avería' a estado válido del ENUM de conductores
    const validStates = ['Disponible', 'En Ruta', 'En Descanso', 'Inactivo'];
    const dbEstado = validStates.includes(estado) ? estado : (estado === 'Avería' ? 'En Descanso' : cond.estado);

    await pool.execute(
      `UPDATE conductores
       SET nombres=COALESCE(?, nombres),
           apellidos=COALESCE(?, apellidos),
           documento=COALESCE(?, documento),
           telefono=COALESCE(?, telefono),
           password_acceso=COALESCE(?, password_acceso),
           estado=?
       WHERE id=?`,
      [nombres ?? null, apellidos ?? null, dni ?? null, telefono ?? null, pass ?? null, dbEstado, cond.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/conductores/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  try {
    await pool.execute('DELETE FROM conductores WHERE codigo=? OR id=?', [req.params.codigo, req.params.codigo]);
    res.json({ ok: true });
  } catch (_err) {
    await pool.execute("UPDATE conductores SET estado='Inactivo' WHERE codigo=? OR id=?", [req.params.codigo, req.params.codigo]);
    res.json({ ok: true, softDeleted: true });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Asignaciones (actualiza también estados de vehículo y conductor)
// -----------------------------------------------------------------------------
app.post('/api/asignaciones', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, vehiculoCodigo, conductorCodigo, fechaInicio, fechaFin, estado, observaciones } = req.body;
  try {
    const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [vehiculoCodigo, vehiculoCodigo]);
    const [[cond]] = await pool.execute('SELECT id FROM conductores WHERE codigo=? OR documento=? OR id=?', [conductorCodigo, conductorCodigo, conductorCodigo]);

    if (!veh || !cond) return res.status(400).json({ ok: false, error: 'Vehículo o conductor no encontrado' });

    const [result] = await pool.execute(
      `INSERT INTO asignaciones (codigo, vehiculo_id, conductor_id, fecha_inicio, fecha_fin, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [codigo, veh.id, cond.id, fechaInicio || new Date(), fechaFin || null, estado || 'En Ruta', observaciones || '']
    );

    await pool.execute("UPDATE vehiculos SET estado='En Ruta' WHERE id=?", [veh.id]);
    await pool.execute("UPDATE conductores SET estado='En Ruta' WHERE id=?", [cond.id]);

    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Fallas Mecánicas (soporta crear y editar todos los campos)
// -----------------------------------------------------------------------------
function mapFaultStateToDb(estado) {
  if (estado === 'Resuelto' || estado === 'Resuelta') return 'Resuelto';
  if (estado === 'En Taller' || estado === 'En Atencion') return 'En Atencion';
  return 'Pendiente';
}

app.post('/api/fallas', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const codigo = req.body.codigo || req.body.id;
  const vehiculoCodigo = req.body.vehiculoCodigo || req.body.vehiculoId;
  const tipo = req.body.tipo || req.body.categoria || 'Mecánica General';
  const descripcion = req.body.descripcion || req.body.desc || '';
  const fecha = req.body.fecha || new Date().toISOString().split('T')[0];
  const estado = mapFaultStateToDb(req.body.estado);

  try {
    const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [vehiculoCodigo, vehiculoCodigo]);
    if (!veh) return res.status(400).json({ ok: false, error: 'Vehículo no encontrado' });

    const [result] = await pool.execute(
      `INSERT INTO fallas_mecanicas (codigo, vehiculo_id, tipo, descripcion, fecha_reporte, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo, veh.id, tipo, descripcion, fecha, estado]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/fallas/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const vehiculoCodigo = req.body.vehiculoCodigo || req.body.vehiculoId;
  const tipo = req.body.tipo || req.body.categoria;
  const descripcion = req.body.descripcion ?? req.body.desc;
  const fecha = req.body.fecha;
  const estado = req.body.estado ? mapFaultStateToDb(req.body.estado) : null;

  try {
    let vehId = null;
    if (vehiculoCodigo) {
      const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [vehiculoCodigo, vehiculoCodigo]);
      if (veh) vehId = veh.id;
    }

    await pool.execute(
      `UPDATE fallas_mecanicas
       SET vehiculo_id=COALESCE(?, vehiculo_id),
           tipo=COALESCE(?, tipo),
           descripcion=COALESCE(?, descripcion),
           fecha_reporte=COALESCE(?, fecha_reporte),
           estado=COALESCE(?, estado)
       WHERE codigo=?`,
      [vehId, tipo ?? null, descripcion ?? null, fecha ?? null, estado, req.params.codigo]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Alertas de Pánico
// -----------------------------------------------------------------------------
app.post('/api/alertas', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, vehiculoCodigo, placa, conductorCodigo, tipo, mensaje, latitud, longitud, estado } = req.body;
  try {
    const [[veh]] = await pool.execute(
      'SELECT id FROM vehiculos WHERE codigo=? OR placa=? OR placa=?',
      [vehiculoCodigo || '', vehiculoCodigo || '', placa || '']
    );
    if (!veh) return res.status(400).json({ ok: false, error: 'Vehículo no encontrado en MySQL' });

    let condId = null;
    if (conductorCodigo) {
      const [[cond]] = await pool.execute('SELECT id FROM conductores WHERE codigo=? OR id=?', [conductorCodigo, conductorCodigo]);
      if (cond) condId = cond.id;
    }

    const [result] = await pool.execute(
      `INSERT INTO alertas (codigo, vehiculo_id, conductor_id, tipo, mensaje, latitud, longitud, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, veh.id, condId, tipo || 'Panico', mensaje || 'Alerta de emergencia', latitud ?? null, longitud ?? null, estado || 'Activa']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/alertas/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  try {
    await pool.execute("UPDATE alertas SET estado=?, atendida_en=NOW() WHERE codigo=?", [req.body.estado || 'Resuelta', req.params.codigo]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Registro de Viajes y Liquidaciones
// -----------------------------------------------------------------------------
app.post('/api/viajes', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const v = req.body;
  try {
    const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [v.vehiculoId || v.placa, v.placa]);
    const vehId = veh ? veh.id : 1;

    const [result] = await pool.execute(
      `INSERT INTO viajes_historial (
        codigo_viaje, fecha, vehiculo_id, placa, conductor_nombre,
        origen, destino, distancia_km, duracion, paradas,
        combustible_gal, costo_combustible, costo_peajes, viatico_conductor,
        costo_operativo_total, flete_comercial, utilidad_neta, margen_porcentaje, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        costo_operativo_total = VALUES(costo_operativo_total),
        flete_comercial = VALUES(flete_comercial),
        utilidad_neta = VALUES(utilidad_neta)`,
      [
        v.id || `R-${Date.now()}`, v.fecha || new Date().toISOString().split('T')[0], vehId, v.placa, v.conductor,
        v.origen, v.destino, v.km || 40, v.duracion || '1h 30m', v.paradas || '0 paradas',
        v.combustibleGals || 0, v.costoCombustible || 0, v.costoPeajes || 0, v.viaticoConductor || 0,
        v.costoOperativoTotal || 0, v.fleteComercial || 0, v.utilidadNeta || 0, v.margenPorcentaje || 0, v.estado || 'Completado'
      ]
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Autenticación directa contra MySQL (Admin y Conductores)
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  }

  const user = String(req.body.user || '').trim();
  const pass = String(req.body.pass || '').trim();
  if (!user || !pass) {
    return res.status(400).json({ ok: false, error: 'Faltan credenciales' });
  }

  try {
    // 1. Verificar Administrador
    const [configRows] = await pool.query(
      "SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('admin_user', 'admin_pass')"
    );
    const admin = { user: 'admin', pass: 'admin' };
    configRows.forEach(c => {
      if (c.clave === 'admin_user') admin.user = c.valor;
      if (c.clave === 'admin_pass') admin.pass = c.valor;
    });

    if (user === admin.user && pass === admin.pass) {
      return res.json({ ok: true, role: 'admin', user: admin.user });
    }

    // 2. Verificar Conductor (DNI, código, nombre, licencia o placa asignada)
    const [rows] = await pool.query(`
      SELECT c.*,
             l.numero AS licencia_num,
             l.categoria AS licencia_cat,
             v.codigo AS vehiculo_codigo,
             v.placa AS vehiculo_placa
      FROM conductores c
      LEFT JOIN licencias l ON c.licencia_id = l.id
      LEFT JOIN (
        SELECT a1.conductor_id, a1.vehiculo_id
        FROM asignaciones a1
        INNER JOIN (
          SELECT conductor_id, MAX(id) AS max_id
          FROM asignaciones
          GROUP BY conductor_id
        ) a2 ON a1.id = a2.max_id
      ) asg ON asg.conductor_id = c.id
      LEFT JOIN vehiculos v ON asg.vehiculo_id = v.id
    `);

    const norm = s => String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const userNorm = norm(user);

    const match = rows.find(c => {
      const fullName = `${c.nombres || ''} ${c.apellidos || ''}`.trim();
      return (
        norm(c.documento) === userNorm ||
        norm(c.codigo) === userNorm ||
        norm(fullName) === userNorm ||
        norm(c.nombres) === userNorm ||
        norm(c.licencia_num) === userNorm ||
        (c.vehiculo_placa && norm(c.vehiculo_placa) === userNorm)
      );
    });

    if (!match) {
      console.log(`[Login] No existe conductor con identificador: "${user}"`);
      return res.status(401).json({ ok: false, error: 'Usuario no encontrado' });
    }

    const dbPass = String(match.password_acceso ?? '1234').trim();
    if (dbPass !== pass) {
      console.log(`[Login] Clave incorrecta para ${match.nombres} (${match.codigo})`);
      return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
    }

    return res.json({
      ok: true,
      role: 'driver',
      driver: {
        id: match.codigo || `D-${String(match.id).padStart(2, '0')}`,
        nombres: match.nombres,
        apellidos: match.apellidos,
        nombre: `${match.nombres} ${match.apellidos}`.trim(),
        dni: match.documento || '',
        licencia: match.licencia_num || 'Q-00000000',
        categoria: match.licencia_cat || 'A-IIIc',
        telefono: match.telefono || '',
        pass: dbPass,
        vehiculoAsignado: match.vehiculo_codigo || 'Sin asignar',
        placa: match.vehiculo_placa || '—',
        estado: match.estado
      }
    });
  } catch (err) {
    console.error('[Login] Error SQL:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Actualización de Credenciales
// -----------------------------------------------------------------------------
app.post('/api/auth/update-credentials', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { type, user, pass, driverId, newPass } = req.body;
  try {
    if (type === 'admin') {
      await pool.execute("UPDATE configuracion_sistema SET valor=? WHERE clave='admin_user'", [user]);
      await pool.execute("UPDATE configuracion_sistema SET valor=? WHERE clave='admin_pass'", [pass]);
      await pool.execute("UPDATE usuarios SET usuario=?, password_plain=? WHERE id=1", [user, pass]);
      return res.json({ ok: true });
    }
    if (type === 'driver') {
      await pool.execute(
        "UPDATE conductores SET password_acceso=? WHERE codigo=? OR CONCAT(nombres, ' ', apellidos)=? OR documento=?",
        [newPass, driverId, driverId, driverId]
      );
      return res.json({ ok: true });
    }
    res.status(400).json({ ok: false, error: 'Tipo de actualización inválido' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`SISTEMA TRANSPORTES CHILENO E.I.R.L. ACTIVO en http://localhost:${PORT}`);
  });
});