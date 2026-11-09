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

// -----------------------------------------------------------------------------
// Auto-inicialización de la Base de Datos al iniciar el proyecto
// -----------------------------------------------------------------------------
async function initDatabase() {
  console.log('[MySQL] Verificando conexión al servidor de base de datos...');
  try {
    // 1. Conexión inicial sin seleccionar base de datos (para crearla si no existe)
    const initConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
    await initConn.end();

    // 2. Crear pool conectado a la base de datos oficial
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      multipleStatements: true
    });

    // 3. Verificar si las tablas principales ya existen
    const [tables] = await pool.query('SHOW TABLES;');
    if (tables.length === 0) {
      console.log('[MySQL] Base de datos vacía. Ejecutando schema inicial y datos de prueba...');
      const sqlPath = path.join(__dirname, 'database', 'transportes_chileno.sql');
      if (fs.existsSync(sqlPath)) {
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sqlContent);
        console.log('[MySQL] Schema y datos iniciales importados exitosamente.');
      }
    }

    isDbConnected = true;
    console.log(`[MySQL] Conexión establecida con la base de datos '${DB_CONFIG.database}'.`);
  } catch (error) {
    isDbConnected = false;
    console.warn('[MySQL] No se pudo conectar automáticamente a MySQL:', error.message);
    console.warn('[MySQL] El sistema continuará funcionando con el respaldo de persistencia local (localStorage/in-memory).');
  }
}

// -----------------------------------------------------------------------------
// Endpoints de Estado y Salud del Sistema
// -----------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  if (!isDbConnected || !pool) {
    return res.json({
      ok: false,
      connected: false,
      mode: 'offline_fallback',
      message: 'MySQL no está disponible en este momento. Usando persistencia local del navegador.'
    });
  }

  try {
    const [rows] = await pool.query('SELECT DATABASE() AS database_name, NOW() AS server_time, 1 AS connected');
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
// Endpoint Bootstrap: Carga todo el estado sincronizado en una sola llamada rápida
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

    // 2. Conductores
    const [driversRows] = await pool.query(`
      SELECT c.*, l.numero AS licencia_num 
      FROM conductores c 
      LEFT JOIN licencias l ON c.licencia_id = l.id 
      ORDER BY c.id ASC
    `);
    const drivers = driversRows.map(d => ({
      id: d.codigo || `D-${String(d.id).padStart(2, '0')}`,
      nombre: `${d.nombres} ${d.apellidos}`.trim(),
      licencia: d.licencia_num || 'Q-12345678',
      telefono: d.telefono || '987654321',
      password: d.password_acceso || '1234',
      estado: d.estado
    }));

    // 3. Asignaciones
    const [assignRows] = await pool.query(`
      SELECT a.*, v.codigo AS vehiculo_codigo, v.placa, 
             c.codigo AS conductor_codigo, CONCAT(c.nombres, ' ', c.apellidos) AS conductor_nombre
      FROM asignaciones a
      JOIN vehiculos v ON a.vehiculo_id = v.id
      JOIN conductores c ON a.conductor_id = c.id
      ORDER BY a.id ASC
    `);
    const assignments = assignRows.map(a => ({
      id: a.codigo || `A-${String(a.id).padStart(2, '0')}`,
      vehiculoId: a.vehiculo_codigo,
      placa: a.placa,
      conductorId: a.conductor_codigo,
      conductor: a.conductor_nombre,
      fechaInicio: a.fecha_inicio ? new Date(a.fecha_inicio).toISOString().replace('T', ' ').substring(0, 16) : '',
      fechaFin: a.fecha_fin ? new Date(a.fecha_fin).toISOString().replace('T', ' ').substring(0, 16) : '',
      estado: a.estado,
      observaciones: a.observaciones || ''
    }));

    // 4. Historial de Viajes & Liquidaciones
    const [tripRows] = await pool.query('SELECT * FROM viajes_historial ORDER BY fecha DESC, id DESC');
    const journeyHistory = tripRows.map(t => ({
      id: t.codigo_viaje,
      fecha: t.fecha ? new Date(t.fecha).toISOString().split('T')[0] : '',
      conductor: t.conductor_nombre,
      placa: t.placa,
      origen: t.origen,
      destino: t.destino,
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

    // 5. Fallas Mecánicas
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
      tipo: f.tipo || 'Mecánica General',
      descripcion: f.descripcion,
      fecha: f.fecha_reporte ? new Date(f.fecha_reporte).toISOString().split('T')[0] : '',
      estado: (f.estado === 'Resuelto' || f.estado === 'Resuelta') ? 'Resuelto' : 'Pendiente'
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
      vehiculo: a.placa,
      vehiculoId: a.vehiculo_codigo,
      conductor: a.conductor_nombre || 'No asignado',
      mensaje: a.mensaje,
      hora: a.creada_en ? new Date(a.creada_en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '',
      fecha: a.creada_en ? new Date(a.creada_en).toISOString().split('T')[0] : '',
      estado: a.estado === 'Activa' ? 'Activa' : 'Resuelta',
      lat: a.latitud ? Number(a.latitud) : null,
      lng: a.longitud ? Number(a.longitud) : null
    }));

    // 7. Credenciales del Administrador
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
    res.status(500).json({ ok: false, error: 'Error cargando datos de la base de datos', detail: error.message });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Vehículos con Persistencia MySQL
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
    await pool.execute(
      `UPDATE vehiculos SET placa=?, marca=?, modelo=?, anio=?, capacidad_toneladas=?, ejes=COALESCE(?, ejes), estado=?
       WHERE codigo=? OR placa=?`,
      [placa, marca, modelo, anio, capacidad, ejes, estado, req.params.codigo, req.params.codigo]
    );
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
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Asignaciones con Persistencia MySQL
// -----------------------------------------------------------------------------
app.post('/api/asignaciones', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, vehiculoCodigo, conductorCodigo, fechaInicio, fechaFin, estado, observaciones } = req.body;
  try {
    const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [vehiculoCodigo, vehiculoCodigo]);
    const [[cond]] = await pool.execute('SELECT id FROM conductores WHERE codigo=? OR documento=?', [conductorCodigo, conductorCodigo]);

    if (!veh || !cond) return res.status(400).json({ ok: false, error: 'Vehículo o conductor no encontrado' });

    const [result] = await pool.execute(
      `INSERT INTO asignaciones (codigo, vehiculo_id, conductor_id, fecha_inicio, fecha_fin, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [codigo, veh.id, cond.id, fechaInicio || new Date(), fechaFin || null, estado || 'Programada', observaciones || '']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// CRUD de Fallas Mecánicas con Persistencia MySQL
// -----------------------------------------------------------------------------
app.post('/api/fallas', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { codigo, vehiculoCodigo, tipo, descripcion, estado } = req.body;
  try {
    const [[veh]] = await pool.execute('SELECT id FROM vehiculos WHERE codigo=? OR placa=?', [vehiculoCodigo, vehiculoCodigo]);
    if (!veh) return res.status(400).json({ ok: false, error: 'Vehículo no encontrado' });

    const [result] = await pool.execute(
      `INSERT INTO fallas_mecanicas (codigo, vehiculo_id, tipo, descripcion, estado)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo, veh.id, tipo, descripcion, estado || 'Pendiente']
    );
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/fallas/:codigo', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { estado } = req.body;
  try {
    await pool.execute('UPDATE fallas_mecanicas SET estado=? WHERE codigo=?', [estado, req.params.codigo]);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Registro de Viajes y Liquidaciones (§16) en MySQL
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
// Actualización de Credenciales y Seguridad
// -----------------------------------------------------------------------------
app.post('/api/auth/update-credentials', async (req, res) => {
  if (!isDbConnected || !pool) return res.status(503).json({ ok: false, error: 'MySQL no conectado' });
  const { type, user, pass, driverId, newPass } = req.body;

  try {
    if (type === 'admin') {
      await pool.execute("UPDATE configuracion_sistema SET valor=? WHERE clave='admin_user'", [user]);
      await pool.execute("UPDATE configuracion_sistema SET valor=? WHERE clave='admin_pass'", [pass]);
      await pool.execute("UPDATE usuarios SET usuario=?, password_plain=? WHERE id=1", [user, pass]);
      return res.json({ ok: true, message: 'Credenciales del Administrador actualizadas en MySQL' });
    }

    if (type === 'driver') {
      await pool.execute('UPDATE conductores SET password_acceso=? WHERE codigo=? OR nombres LIKE ?', [newPass, driverId, `%${driverId}%`]);
      return res.json({ ok: true, message: 'Contraseña de conductor actualizada en MySQL' });
    }

    res.status(400).json({ ok: false, error: 'Tipo de actualización inválido' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Servir Archivos Estáticos de la Interfaz Web
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -----------------------------------------------------------------------------
// Inicializar Servidor
// -----------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 3000);

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` SISTEMA TRANSPORTES CHILENO E.I.R.L. ACTIVO`);
    console.log(` Servidor Web y API: http://localhost:${PORT}`);
    console.log(` Healthcheck MySQL:  http://localhost:${PORT}/api/health`);
    console.log(`================================================================`);
  });
});
