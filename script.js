/* ==========================================================================
   Transportes Chileno E.I.R.L. — Sistema de Monitoreo & Gestión de Flota
   script.js  |  Versión 2.0  |  Producción
   ==========================================================================
   ÍNDICE DE SECCIONES (busca el marcador para ir directo al bloque):
     §01  — Base de Datos en Memoria (vehículos, conductores, asignaciones…)
     §02  — Utilidades: Toast, Anunciador de Accesibilidad
     §03  — Autenticación y Control de Sesión (Login / Logout)
     §04  — Motor de Navegación (switchView)
     §05  — Gestión de Credenciales del Administrador (panel seguridad)
     §06  — KPI Dashboard (tarjetas y gráfica de barras)
     §07  — Catálogo de Flota — CRUD Vehículos
     §08  — Asignaciones Conductor ↔ Vehículo
     §09  — Historial de Rutas / Recorridos
     §10  — Registro de Fallas Mecánicas
     §11  — Centro de Alertas y Botón de Pánico
     §12  — Generador de Reportes (Excel XLSX + PDF imprimible)
     §13  — Mapa GPS Google Maps (inicialización lazy, marcadores, inspector)
     §14  — Barra de Accesibilidad (temas, tamaño de fuente)
     §15  — Inicialización General al Cargar
     §16  — Módulo de Liquidación y Auditoría de Rutas (CÓDIGO PARA REFACTORIZAR)
   ========================================================================== */

// Manejadores globales para la API de Google Maps (previene errores de callback)
window._googleMapsCallbackFired = false;
window.initMap = function() {
  if (typeof window._triggerInitMap === 'function') {
    window._triggerInitMap();
  } else {
    window._googleMapsCallbackFired = true;
  }
};
window.gm_authFailure = function() {
  console.warn('[Google Maps] Error de autenticación de API Key en Google Cloud.');
  const mapEl = document.getElementById('main-gps-map');
  if (mapEl) {
    mapEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#ef4444;padding:2rem;text-align:center;">
        <span style="font-size:2.5rem;margin-bottom:0.75rem">⚠️</span>
        <strong style="font-size:1.1rem;color:#f8fafc">Google Maps: Error de Autenticación de API Key</strong>
        <p style="color:#94a3b8;font-size:0.875rem;margin-top:0.5rem;max-width:440px;">
          La clave configurada en index.html requiere tener habilitada la Maps JavaScript API y facturación en Google Cloud Console.
        </p>
      </div>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => {

  /* =========================================================================
     §01 — BASE DE DATOS EN MEMORIA
     Ubicación: script.js → línea ~25
     Contiene: adminCredentials, vehiclesData, driversData, assignmentsData,
               journeyHistoryData, mechanicalFaultsData, alertsData, gpsUnits
     Para modificar datos de prueba, edita los arrays de esta sección.
     ========================================================================= */

  // Credenciales del Administrador (editables desde panel de seguridad §05)
  let adminCredentials = { user: 'admin', pass: 'admin' };

  // Sesión actual del usuario logueado
  let currentUser = null; // { role: 'admin'|'driver', name, user?, placa?, driverId? }

  // — CATÁLOGO DE VEHÍCULOS (Ampliado con datos de ejemplo para pruebas de flota y refactorización) —
  let vehiclesData = [
    { id: 'V-01', placa: 'ABC-123', marca: 'Volvo',          modelo: 'FH16 750',      anio: 2024, capacidad: 22.5, estado: 'En Ruta',    soat: '2027-05-10', rt: '2027-08-15', ejes: 4 },
    { id: 'V-02', placa: 'XYZ-789', marca: 'Scania',         modelo: 'R500 Highline',  anio: 2023, capacidad: 18.0, estado: 'En Ruta',    soat: '2026-11-20', rt: '2027-01-10', ejes: 3 },
    { id: 'V-03', placa: 'MNO-456', marca: 'Mercedes-Benz',  modelo: 'Actros 2548',   anio: 2025, capacidad: 25.0, estado: 'En Ruta',    soat: '2027-12-01', rt: '2027-12-01', ejes: 4 },
    { id: 'V-04', placa: 'DEF-321', marca: 'International',  modelo: 'LT625',         anio: 2022, capacidad: 15.0, estado: 'Disponible', soat: '2026-10-05', rt: '2026-12-30', ejes: 3 },
    { id: 'V-05', placa: 'GHI-654', marca: 'Volvo',          modelo: 'FMX 460',       anio: 2021, capacidad: 12.0, estado: 'En Taller',  soat: '2026-08-14', rt: '2026-09-10', ejes: 3 },
    { id: 'V-06', placa: 'JKL-987', marca: 'Freightliner',   modelo: 'Cascadia 126',  anio: 2024, capacidad: 20.0, estado: 'Disponible', soat: '2027-04-18', rt: '2027-06-22', ejes: 4 },
    { id: 'V-07', placa: 'PQR-147', marca: 'Kenworth',       modelo: 'T680',          anio: 2023, capacidad: 16.5, estado: 'En Ruta',    soat: '2027-01-30', rt: '2027-03-15', ejes: 4 },
    { id: 'V-08', placa: 'STU-258', marca: 'DAF',            modelo: 'XF 530 FT',     anio: 2024, capacidad: 24.0, estado: 'Disponible', soat: '2027-07-01', rt: '2027-09-01', ejes: 4 },
    { id: 'V-09', placa: 'VWX-369', marca: 'MAN',            modelo: 'TGX 18.510',    anio: 2022, capacidad: 19.5, estado: 'En Taller',  soat: '2026-06-30', rt: '2026-11-15', ejes: 3 },
    { id: 'V-10', placa: 'YZA-012', marca: 'Iveco',          modelo: 'S-Way 480',     anio: 2025, capacidad: 21.0, estado: 'Disponible', soat: '2027-10-20', rt: '2027-11-30', ejes: 4 },
    { id: 'V-11', placa: 'BCX-881', marca: 'Hino',           modelo: '700 Heavy Duty',anio: 2024, capacidad: 26.0, estado: 'En Ruta',    soat: '2027-03-12', rt: '2027-05-18', ejes: 6 },
    { id: 'V-12', placa: 'DKL-552', marca: 'Isuzu',          modelo: 'Forward 1400',  anio: 2023, capacidad: 14.0, estado: 'Disponible', soat: '2026-12-15', rt: '2027-02-28', ejes: 2 },
    { id: 'V-13', placa: 'MTR-904', marca: 'Hyundai',        modelo: 'HD270 Volquete',anio: 2022, capacidad: 18.5, estado: 'En Taller',  soat: '2026-09-01', rt: '2026-10-20', ejes: 3 },
    { id: 'V-14', placa: 'QWE-773', marca: 'Scania',         modelo: 'G450 Streamline',anio: 2025, capacidad: 28.0, estado: 'En Ruta',    soat: '2027-08-30', rt: '2027-10-15', ejes: 6 },
    { id: 'V-15', placa: 'ZXC-319', marca: 'Volvo',          modelo: 'FM 420 Globetrotter', anio: 2023, capacidad: 24.0, estado: 'Disponible', soat: '2027-02-10', rt: '2027-04-05', ejes: 4 },
    { id: 'V-16', placa: 'RTY-602', marca: 'Mercedes-Benz',  modelo: 'Axor 3131 Cama Baja', anio: 2024, capacidad: 30.0, estado: 'En Ruta',    soat: '2027-06-15', rt: '2027-07-22', ejes: 6 },
  ];

  // — CONDUCTORES (contraseña por defecto "1234") —
  let driversData = [
    { id: 101, nombre: 'Juan Perez',         dni: '45871236', licencia: 'Q45871236', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-01', placa: 'ABC-123', pass: '1234' },
    { id: 102, nombre: 'Carlos Ramirez',     dni: '71234589', licencia: 'Q71234589', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-02', placa: 'XYZ-789', pass: '1234' },
    { id: 103, nombre: 'Maria Gomez',        dni: '41987654', licencia: 'Q41987654', categoria: 'A-IIIb', estado: 'En Ruta',    vehiculoAsignado: 'V-03', placa: 'MNO-456', pass: '1234' },
    { id: 104, nombre: 'Pedro Castillo',     dni: '75315984', licencia: 'Q75315984', categoria: 'A-IIIc', estado: 'Disponible', vehiculoAsignado: 'V-04', placa: 'DEF-321', pass: '1234' },
    { id: 105, nombre: 'Luis Alvarado',      dni: '48621593', licencia: 'Q48621593', categoria: 'A-IIIb', estado: 'Disponible', vehiculoAsignado: 'V-06', placa: 'JKL-987', pass: '1234' },
    { id: 106, nombre: 'Gabriel Mendoza',    dni: '74125896', licencia: 'Q74125896', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-07', placa: 'PQR-147', pass: '1234' },
    { id: 107, nombre: 'Rosa Huamani',       dni: '62981547', licencia: 'Q62981547', categoria: 'A-IIIb', estado: 'Disponible', vehiculoAsignado: 'V-08', placa: 'STU-258', pass: '1234' },
    { id: 108, nombre: 'Felix Torres',       dni: '53214796', licencia: 'Q53214796', categoria: 'A-IIIc', estado: 'Disponible', vehiculoAsignado: 'V-10', placa: 'YZA-012', pass: '1234' },
    { id: 109, nombre: 'Walter Chauca',      dni: '46328912', licencia: 'Q46328912', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-11', placa: 'BCX-881', pass: '1234' },
    { id: 110, nombre: 'Ronald Espinoza',    dni: '72541098', licencia: 'Q72541098', categoria: 'A-IIIb', estado: 'Disponible', vehiculoAsignado: 'V-12', placa: 'DKL-552', pass: '1234' },
    { id: 111, nombre: 'Hector Quispe',      dni: '43901245', licencia: 'Q43901245', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-14', placa: 'QWE-773', pass: '1234' },
    { id: 112, nombre: 'Manuel Becerra',     dni: '49120487', licencia: 'Q49120487', categoria: 'A-IIIb', estado: 'Disponible', vehiculoAsignado: 'V-15', placa: 'ZXC-319', pass: '1234' },
    { id: 113, nombre: 'Jorge Villavicencio',dni: '70854123', licencia: 'Q70854123', categoria: 'A-IIIc', estado: 'En Ruta',    vehiculoAsignado: 'V-16', placa: 'RTY-602', pass: '1234' },
    { id: 114, nombre: 'Fernando Carpio',    dni: '47589632', licencia: 'Q47589632', categoria: 'A-IIIc', estado: 'Disponible', vehiculoAsignado: 'Sin asignar', placa: '—', pass: '1234' },
  ];

  // — ASIGNACIONES ACTIVAS —
  let assignmentsData = [
    { id: 501, vehiculoId: 'V-01', placa: 'ABC-123', conductor: 'Juan Perez',         inicio: '2026-11-05T08:00', estado: 'En Ruta' },
    { id: 502, vehiculoId: 'V-02', placa: 'XYZ-789', conductor: 'Carlos Ramirez',     inicio: '2026-11-05T07:30', estado: 'En Ruta' },
    { id: 503, vehiculoId: 'V-03', placa: 'MNO-456', conductor: 'Maria Gomez',        inicio: '2026-11-05T08:15', estado: 'En Ruta' },
    { id: 504, vehiculoId: 'V-07', placa: 'PQR-147', conductor: 'Gabriel Mendoza',    inicio: '2026-11-05T09:00', estado: 'En Ruta' },
    { id: 505, vehiculoId: 'V-04', placa: 'DEF-321', conductor: 'Pedro Castillo',     inicio: '2026-11-04T14:00', estado: 'Finalizada' },
    { id: 506, vehiculoId: 'V-11', placa: 'BCX-881', conductor: 'Walter Chauca',      inicio: '2026-11-05T06:45', estado: 'En Ruta' },
    { id: 507, vehiculoId: 'V-14', placa: 'QWE-773', conductor: 'Hector Quispe',      inicio: '2026-11-05T07:10', estado: 'En Ruta' },
    { id: 508, vehiculoId: 'V-16', placa: 'RTY-602', conductor: 'Jorge Villavicencio',inicio: '2026-11-05T08:30', estado: 'En Ruta' },
  ];

  // — HISTORIAL DE RUTAS (Ampliado con datos reales para análisis y auditoría) —
  let journeyHistoryData = [
    { id: 'R-101', fecha: '2026-11-04', vehiculoId: 'V-01', placa: 'ABC-123', conductor: 'Juan Perez',         origen: 'Base San Martín de Porres',    destino: 'Puerto del Callao (Muelle Sur)', inicio: '08:15 AM', fin: '11:45 AM', paradas: '1 (15 min — Grifo Canta Callao)', km: 35 },
    { id: 'R-102', fecha: '2026-11-04', vehiculoId: 'V-02', placa: 'XYZ-789', conductor: 'Carlos Ramirez',     origen: 'Almacén SMP Los Dominicos',     destino: 'Chorrillos Zona Industrial',    inicio: '07:00 AM', fin: '10:30 AM', paradas: '2 (30 min total)', km: 52 },
    { id: 'R-103', fecha: '2026-11-03', vehiculoId: 'V-03', placa: 'MNO-456', conductor: 'Maria Gomez',        origen: 'Base San Martín de Porres',     destino: 'Lurín Parque Industrial Km 32', inicio: '06:30 AM', fin: '11:00 AM', paradas: '1 (10 min)', km: 68 },
    { id: 'R-104', fecha: '2026-11-03', vehiculoId: 'V-07', placa: 'PQR-147', conductor: 'Gabriel Mendoza',    origen: 'Almacén Independencia Av. 06',  destino: 'Villa El Salvador Sector 3',    inicio: '09:00 AM', fin: '13:30 PM', paradas: '3 (45 min total)', km: 64 },
    { id: 'R-105', fecha: '2026-11-02', vehiculoId: 'V-01', placa: 'ABC-123', conductor: 'Juan Perez',         origen: 'Puerto del Callao',             destino: 'Base San Martín de Porres',     inicio: '01:00 PM', fin: '03:30 PM', paradas: 'Sin paradas', km: 35 },
    { id: 'R-106', fecha: '2026-11-01', vehiculoId: 'V-04', placa: 'DEF-321', conductor: 'Pedro Castillo',     origen: 'Base San Martín de Porres',     destino: 'Los Olivos Av. Industrial',     inicio: '10:00 AM', fin: '12:00 PM', paradas: 'Sin paradas', km: 18 },
    { id: 'R-107', fecha: '2026-10-30', vehiculoId: 'V-06', placa: 'JKL-987', conductor: 'Luis Alvarado',      origen: 'Ate Vitarte Zona Industrial',   destino: 'Base San Martín de Porres',     inicio: '08:00 AM', fin: '10:45 AM', paradas: '1 (20 min)', km: 42 },
    { id: 'R-108', fecha: '2026-10-29', vehiculoId: 'V-02', placa: 'XYZ-789', conductor: 'Carlos Ramirez',     origen: 'Base San Martín de Porres',     destino: 'Miraflores Comercial',          inicio: '11:00 AM', fin: '01:15 PM', paradas: 'Sin paradas', km: 28 },
    { id: 'R-109', fecha: '2026-10-28', vehiculoId: 'V-11', placa: 'BCX-881', conductor: 'Walter Chauca',      origen: 'Refinería La Pampilla (Ventanilla)', destino: 'Huachipa Almacenes Centrales', inicio: '05:30 AM', fin: '09:45 AM', paradas: '1 (25 min)', km: 58 },
    { id: 'R-110', fecha: '2026-10-27', vehiculoId: 'V-14', placa: 'QWE-773', conductor: 'Hector Quispe',      origen: 'Base San Martín de Porres',    destino: 'Megapuerto de Chancay Terminal', inicio: '06:00 AM', fin: '10:15 AM', paradas: '1 (20 min — Peaje Ancón)', km: 82 },
    { id: 'R-111', fecha: '2026-10-26', vehiculoId: 'V-16', placa: 'RTY-602', conductor: 'Jorge Villavicencio', origen: 'Puerto del Callao APM Terminals', destino: 'Pisco Terminal Portuario Paracas', inicio: '04:00 AM', fin: '11:30 AM', paradas: '2 (40 min — Chilca / Chincha)', km: 245 },
    { id: 'R-112', fecha: '2026-10-25', vehiculoId: 'V-03', placa: 'MNO-456', conductor: 'Maria Gomez',        origen: 'Base San Martín de Porres',    destino: 'Santa Anita Mercado Mayorista',  inicio: '07:30 AM', fin: '10:00 AM', paradas: 'Sin paradas', km: 38 },
  ];

  // — FALLAS MECÁNICAS —
  let mechanicalFaultsData = [
    { id: 'F-01', vehiculoId: 'V-05', placa: 'GHI-654', fecha: '2026-10-26', categoria: 'Llantas',           desc: 'Desgaste irregular en neumático delantero derecho. Requiere cambio urgente.', estado: 'En Taller' },
    { id: 'F-02', vehiculoId: 'V-02', placa: 'XYZ-789', fecha: '2026-10-15', categoria: 'Frenos',            desc: 'Cambio preventivo de pastillas de freno traseras. Desgaste al 85%.', estado: 'Resuelto' },
    { id: 'F-03', vehiculoId: 'V-09', placa: 'VWX-369', fecha: '2026-10-20', categoria: 'Motor',             desc: 'Fuga de aceite en junta de culata. Vehículo fuera de servicio hasta revisión.', estado: 'En Taller' },
    { id: 'F-04', vehiculoId: 'V-01', placa: 'ABC-123', fecha: '2026-10-10', categoria: 'Luces',             desc: 'Faro delantero izquierdo fundido. Reemplazado con faro LED original.', estado: 'Resuelto' },
    { id: 'F-05', vehiculoId: 'V-07', placa: 'PQR-147', fecha: '2026-10-05', categoria: 'Sistema Eléctrico',   desc: 'Falla en sistema de iluminación de cabina. Revisión del mazo de cables principal.', estado: 'Resuelto' },
    { id: 'F-06', vehiculoId: 'V-13', placa: 'MTR-904', fecha: '2026-11-02', categoria: 'Sistema Hidráulico',desc: 'Falla en bomba de levante hidráulico de tolva. Pérdida de presión en descarga.', estado: 'En Taller' },
    { id: 'F-07', vehiculoId: 'V-11', placa: 'BCX-881', fecha: '2026-10-18', categoria: 'Válvulas',          desc: 'Calibración preventiva de válvula de alivio del sistema de cisterna.', estado: 'Resuelto' },
    { id: 'F-08', vehiculoId: 'V-08', placa: 'STU-258', fecha: '2026-10-12', categoria: 'Frenos',            desc: 'Regulación de zapatas en segundo eje y purga de líneas de aire.', estado: 'Resuelto' },
  ];

  // — ALERTAS DE PÁNICO Y EMERGENCIAS —
  let alertsData = [];

  // — UNIDADES GPS (Coordenadas en Lima Metropolitana y Callao) —
  const GPS_CENTER_LAT = -12.015;
  const GPS_CENTER_LNG = -77.085;
  const gpsUnits = [
    { id: 'V-01', placa: 'ABC-123', driver: 'Juan Perez',         status: 'En Ruta',    lat: -12.0120, lng: -77.0800, speed: 48, heading: 45,  marker: null },
    { id: 'V-02', placa: 'XYZ-789', driver: 'Carlos Ramirez',     status: 'En Ruta',    lat: -12.0250, lng: -77.0950, speed: 52, heading: 180, marker: null },
    { id: 'V-03', placa: 'MNO-456', driver: 'Maria Gomez',        status: 'En Ruta',    lat: -12.0050, lng: -77.0700, speed: 42, heading: 90,  marker: null },
    { id: 'V-07', placa: 'PQR-147', driver: 'Gabriel Mendoza',    status: 'En Ruta',    lat: -12.0300, lng: -77.0820, speed: 60, heading: 270, marker: null },
    { id: 'V-11', placa: 'BCX-881', driver: 'Walter Chauca',      status: 'En Ruta',    lat: -11.9850, lng: -77.1120, speed: 55, heading: 315, marker: null },
    { id: 'V-14', placa: 'QWE-773', driver: 'Hector Quispe',      status: 'En Ruta',    lat: -11.9300, lng: -77.1350, speed: 68, heading: 0,   marker: null },
    { id: 'V-16', placa: 'RTY-602', driver: 'Jorge Villavicencio',status: 'En Ruta',    lat: -12.0480, lng: -77.1220, speed: 44, heading: 135, marker: null },
    { id: 'V-04', placa: 'DEF-321', driver: 'Pedro Castillo',     status: 'Disponible', lat: -12.0180, lng: -77.0760, speed: 0,  heading: 0,   marker: null },
    { id: 'V-06', placa: 'JKL-987', driver: 'Luis Alvarado',      status: 'Disponible', lat: -12.0090, lng: -77.0880, speed: 0,  heading: 0,   marker: null },
    { id: 'V-08', placa: 'STU-258', driver: 'Rosa Huamani',       status: 'Disponible', lat: -12.0160, lng: -77.0840, speed: 0,  heading: 0,   marker: null },
    { id: 'V-10', placa: 'YZA-012', driver: 'Felix Torres',       status: 'Disponible', lat: -12.0140, lng: -77.0860, speed: 0,  heading: 0,   marker: null },
    { id: 'V-12', placa: 'DKL-552', driver: 'Ronald Espinoza',    status: 'Disponible', lat: -12.0195, lng: -77.0680, speed: 0,  heading: 0,   marker: null },
    { id: 'V-15', placa: 'ZXC-319', driver: 'Manuel Becerra',     status: 'Disponible', lat: -12.0152, lng: -77.0848, speed: 0,  heading: 0,   marker: null },
    { id: 'V-05', placa: 'GHI-654', driver: '—',                  status: 'En Taller',  lat: -12.0220, lng: -77.0710, speed: 0,  heading: 0,   marker: null },
    { id: 'V-09', placa: 'VWX-369', driver: '—',                  status: 'En Taller',  lat: -12.0135, lng: -77.0930, speed: 0,  heading: 0,   marker: null },
    { id: 'V-13', placa: 'MTR-904', driver: '—',                  status: 'En Taller',  lat: -12.0285, lng: -77.0865, speed: 0,  heading: 0,   marker: null },
  ];

  /* =========================================================================
     §02 — UTILIDADES: TOAST Y ANUNCIADOR DE ACCESIBILIDAD
     Ubicación: script.js → §02
     ========================================================================= */
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  const announcer = document.getElementById('accessibility-announcer');
  function announce(msg) { if (announcer) announcer.textContent = msg; }

  /* =========================================================================
     §03 — AUTENTICACIÓN Y CONTROL DE SESIÓN
     Ubicación: script.js → §03
     Lógica: admin (adminCredentials), conductor (nombre || placa + pass)
     ========================================================================= */
  const formLogin      = document.getElementById('form-login');
  const loginUsername  = document.getElementById('login-username');
  const loginPassword  = document.getElementById('login-password');
  const btnTogglePass  = document.getElementById('btn-toggle-password');
  const loginErrorMsg  = document.getElementById('login-error-msg');
  const siteHeader     = document.getElementById('site-header');
  const userBadge      = document.getElementById('user-logged-badge');
  const userBadgeText  = document.getElementById('user-logged-text');
  const btnLogout      = document.getElementById('btn-logout');

  btnTogglePass?.addEventListener('click', () => {
    const t = loginPassword.type === 'password' ? 'text' : 'password';
    loginPassword.type = t;
    btnTogglePass.textContent = t === 'password' ? '👁️' : '🙈';
  });

  formLogin?.addEventListener('submit', e => {
    e.preventDefault();
    const user = loginUsername.value.trim();
    const pass = loginPassword.value.trim();
    loginErrorMsg?.classList.add('hidden');

    if (user === adminCredentials.user && pass === adminCredentials.pass) {
      loginAsAdmin(); return;
    }

    const userLower = user.toLowerCase();
    const driver = driversData.find(d =>
      (d.nombre.toLowerCase() === userLower || (d.placa && d.placa.toLowerCase() === userLower))
      && d.pass === pass
    );
    if (driver) { loginAsDriver(driver); return; }

    loginErrorMsg?.classList.remove('hidden');
    announce('Error de autenticación: usuario o contraseña incorrectos.');
  });

  function loginAsAdmin() {
    currentUser = { role: 'admin', name: 'Administrador', user: adminCredentials.user };
    siteHeader?.classList.remove('hidden');
    userBadge?.classList.remove('hidden');
    if (userBadgeText) userBadgeText.textContent = `👨‍💼 Administrador (${adminCredentials.user})`;
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.driver-only-tab').forEach(el => el.classList.add('hidden'));
    switchView('view-dashboard');
    showToast(`Bienvenido, Administrador (${adminCredentials.user}) 👋`, 'success');
  }

  function loginAsDriver(driver) {
    currentUser = { role: 'driver', name: driver.nombre, placa: driver.placa, driverId: driver.id };
    siteHeader?.classList.remove('hidden');
    userBadge?.classList.remove('hidden');
    if (userBadgeText) userBadgeText.textContent = `📱 Conductor: ${driver.nombre} (${driver.placa})`;
    const info = document.getElementById('driver-logged-info');
    if (info) info.innerHTML = `Conductor: <strong>${driver.nombre}</strong> | Vehículo: <strong>${driver.vehiculoAsignado || '—'} (${driver.placa})</strong>`;
    document.querySelectorAll('.admin-only-tab').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.driver-only-tab').forEach(el => el.classList.remove('hidden'));
    switchView('view-driver-app');
    showToast(`Bienvenido, ${driver.nombre} (${driver.placa}) 🚛`, 'success');
  }

  btnLogout?.addEventListener('click', () => {
    currentUser = null;
    siteHeader?.classList.add('hidden');
    userBadge?.classList.add('hidden');
    formLogin?.reset();
    loginErrorMsg?.classList.add('hidden');
    switchView('view-login');
    showToast('Sesión cerrada correctamente.', 'info');
  });

  /* =========================================================================
     §04 — MOTOR DE NAVEGACIÓN (switchView)
     Ubicación: script.js → §04
     Nota: La vista GPS inicializa el mapa de forma lazy (§13)
     ========================================================================= */
  const navTabs     = document.querySelectorAll('.nav-tab');
  const systemViews = document.querySelectorAll('.system-view');

  function switchView(targetId) {
    systemViews.forEach(v => v.classList.remove('active'));
    navTabs.forEach(t => t.classList.remove('active'));

    const view = document.getElementById(targetId);
    const tab  = document.querySelector(`.nav-tab[data-target="${targetId}"]`);
    if (view) view.classList.add('active');
    if (tab)  tab.classList.add('active');

    // Inicialización lazy del mapa GPS (§13)
    if (targetId === 'view-tracking') initMapIfNeeded();

    announce(`Vista "${targetId.replace('view-', '')}" activa`);
  }

  navTabs.forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.target)));
  document.querySelectorAll('.switch-tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchView(btn.dataset.target))
  );

  /* =========================================================================
     §05 — GESTIÓN DE CREDENCIALES DEL ADMINISTRADOR (Panel de Seguridad)
     Ubicación: script.js → §05
     Permite cambiar usuario/pass del admin y contraseñas de conductores.
     ========================================================================= */
  const formAdminCreds        = document.getElementById('form-admin-credentials');
  const adminUserInput        = document.getElementById('admin-user-input');
  const adminPassInput        = document.getElementById('admin-pass-input');
  const driverCredsTableBody  = document.getElementById('driver-credentials-table-body');

  function renderSecurityView() {
    if (adminUserInput) adminUserInput.value = adminCredentials.user;
    if (adminPassInput) adminPassInput.value = adminCredentials.pass;
    renderDriverCredsTable();
  }

  function renderDriverCredsTable() {
    if (!driverCredsTableBody) return;
    driverCredsTableBody.innerHTML = '';
    driversData.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${d.nombre}</strong><br/><small>Lic: ${d.licencia} | ${d.categoria}</small></td>
        <td><code class="code-tag">${d.placa || 'N/A'}</code></td>
        <td><code>${d.pass}</code></td>
        <td><button type="button" class="btn btn--sm btn--outline btn-edit-driver-pass" data-id="${d.id}">🔑 Cambiar Clave</button></td>
      `;
      driverCredsTableBody.appendChild(tr);
    });
    document.querySelectorAll('.btn-edit-driver-pass').forEach(btn =>
      btn.addEventListener('click', () => openDriverPassModal(parseInt(btn.dataset.id)))
    );
  }

  formAdminCreds?.addEventListener('submit', e => {
    e.preventDefault();
    const newUser = adminUserInput.value.trim();
    const newPass = adminPassInput.value.trim();
    if (!newUser || !newPass) { alert('Usuario y contraseña no pueden estar vacíos.'); return; }
    adminCredentials = { user: newUser, pass: newPass };
    if (currentUser?.role === 'admin') {
      currentUser.user = newUser;
      if (userBadgeText) userBadgeText.textContent = `👨‍💼 Administrador (${newUser})`;
    }
    showToast(`Credenciales de Administrador actualizadas → Usuario: "${newUser}"`, 'success');
  });

  // Modal de cambio de contraseña de conductor
  const modalDriverPass       = document.getElementById('modal-driver-pass-backdrop');
  const driverPassId          = document.getElementById('edit-driver-id');
  const driverPassNameDisplay = document.getElementById('edit-driver-name-display');
  const driverPassNewInput    = document.getElementById('edit-driver-new-pass');
  const formDriverPass        = document.getElementById('form-change-driver-pass');

  function openDriverPassModal(id) {
    const d = driversData.find(item => item.id === id);
    if (!d) return;
    driverPassId.value = d.id;
    driverPassNameDisplay.value = `${d.nombre} (Placa: ${d.placa || 'N/A'})`;
    driverPassNewInput.value = d.pass;
    modalDriverPass?.classList.remove('hidden');
    modalDriverPass?.setAttribute('aria-hidden', 'false');
    driverPassNewInput?.focus();
  }
  function closeDriverPassModal() {
    modalDriverPass?.classList.add('hidden');
    modalDriverPass?.setAttribute('aria-hidden', 'true');
    formDriverPass?.reset();
  }

  document.getElementById('btn-close-driver-pass-modal')?.addEventListener('click', closeDriverPassModal);
  document.getElementById('btn-cancel-driver-pass-modal')?.addEventListener('click', closeDriverPassModal);

  formDriverPass?.addEventListener('submit', e => {
    e.preventDefault();
    const id = parseInt(driverPassId.value);
    const newPass = driverPassNewInput.value.trim();
    const d = driversData.find(item => item.id === id);
    if (d && newPass) {
      d.pass = newPass;
      renderDriverCredsTable();
      closeDriverPassModal();
      showToast(`Contraseña actualizada para: ${d.nombre}`, 'success');
    }
  });

  /* =========================================================================
     §06 — KPI DASHBOARD
     Ubicación: script.js → §06
     Tarjetas de resumen + gráfica de barras de viajes por semana.
     ========================================================================= */
  function updateKPIs() {
    const enRuta    = vehiclesData.filter(v => v.estado === 'En Ruta').length;
    const dispon    = vehiclesData.filter(v => v.estado === 'Disponible').length;
    const taller    = vehiclesData.filter(v => v.estado === 'En Taller').length;
    const pendAlert = alertsData.filter(a => a.estado === 'Pendiente').length;

    setEl('kpi-val-active', enRuta);
    setEl('kpi-val-idle',   dispon);
    setEl('kpi-val-repair', taller);
    setEl('kpi-val-alerts', pendAlert);
    setEl('kpi-val-total',  vehiclesData.length);

    const badge = document.getElementById('alerts-count-badge');
    if (badge) badge.textContent = pendAlert;

    renderBarChart();
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // Gráfica de barras simple (últimos 7 días usando journeyHistoryData)
  function renderBarChart() {
    const chart = document.getElementById('dashboard-bar-chart');
    if (!chart) return;
    const days = getLast7DaysLabels();
    const max = Math.max(...days.map(d => d.count), 1);

    chart.innerHTML = days.map(d => `
      <div class="bar-col" title="${d.label}: ${d.count} viaje(s)">
        <div class="bar-fill" style="height: ${Math.round((d.count / max) * 100)}%" aria-label="${d.count} viajes">
          <span class="bar-val">${d.count}</span>
        </div>
        <div class="bar-label">${d.shortLabel}</div>
      </div>
    `).join('');
  }

  function getLast7DaysLabels() {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const count = journeyHistoryData.filter(j => j.fecha === iso).length;
      result.push({
        label: d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' }),
        shortLabel: d.toLocaleDateString('es-PE', { weekday: 'short' }),
        count
      });
    }
    return result;
  }

  // Click en KPIs → navega a vista correspondiente con filtro
  document.getElementById('kpi-card-active')?.addEventListener('click', () => {
    switchView('view-fleet');
    const sel = document.getElementById('filter-fleet-status');
    if (sel) { sel.value = 'En Ruta'; renderFleetTable(); }
  });
  document.getElementById('kpi-card-idle')?.addEventListener('click', () => {
    switchView('view-fleet');
    const sel = document.getElementById('filter-fleet-status');
    if (sel) { sel.value = 'Disponible'; renderFleetTable(); }
  });
  document.getElementById('kpi-card-repair')?.addEventListener('click', () => {
    switchView('view-fleet');
    const sel = document.getElementById('filter-fleet-status');
    if (sel) { sel.value = 'En Taller'; renderFleetTable(); }
  });
  document.getElementById('kpi-card-alerts')?.addEventListener('click', () => switchView('view-alerts'));

  /* =========================================================================
     §07 — CATÁLOGO DE FLOTA — CRUD VEHÍCULOS
     Ubicación: script.js → §07
     Funciones: renderFleetTable, openVehicleModalForCreate/Edit, deleteVehicle
     ========================================================================= */
  const fleetTableBody      = document.getElementById('fleet-table-body');
  const filterFleetCapacity = document.getElementById('filter-fleet-capacity');
  const filterFleetStatus   = document.getElementById('filter-fleet-status');
  const filterFleetSearch   = document.getElementById('filter-fleet-search');
  const fleetFilterSummary  = document.getElementById('fleet-filter-summary');

  function renderFleetTable() {
    if (!fleetTableBody) return;
    const cap    = filterFleetCapacity?.value || 'all';
    const status = filterFleetStatus?.value || 'all';
    const search = (filterFleetSearch?.value || '').toLowerCase().trim();

    const filtered = vehiclesData.filter(v => {
      let matchCap = true;
      if (cap === 'light')  matchCap = v.capacidad <= 5;
      if (cap === 'medium') matchCap = v.capacidad > 5 && v.capacidad <= 15;
      if (cap === 'heavy')  matchCap = v.capacidad > 15;
      const matchStatus = status === 'all' || v.estado === status;
      const matchSearch = !search ||
        v.placa.toLowerCase().includes(search)  ||
        v.marca.toLowerCase().includes(search)  ||
        v.modelo.toLowerCase().includes(search) ||
        v.id.toLowerCase().includes(search);
      return matchCap && matchStatus && matchSearch;
    });

    fleetTableBody.innerHTML = '';

    if (filtered.length === 0) {
      fleetTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Sin vehículos para los filtros seleccionados.</td></tr>`;
    } else {
      filtered.forEach(v => {
        const badge = v.estado === 'En Ruta' ? 'badge--success' : v.estado === 'Disponible' ? 'badge--info' : 'badge--danger';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${v.id}</strong><br/><code class="code-tag">${v.placa}</code></td>
          <td>${v.marca}<br/><small>${v.modelo}</small></td>
          <td>${v.anio}</td>
          <td><strong>${v.capacidad} Ton</strong></td>
          <td><small>SOAT: ${v.soat}<br/>RT: ${v.rt}</small></td>
          <td><span class="badge ${badge}">${v.estado}</span></td>
          <td>
            <button type="button" class="btn btn--sm btn--outline btn-edit-vehicle" data-id="${v.id}">✏️ Editar</button>
            <button type="button" class="btn btn--sm btn--danger btn-delete-vehicle" data-id="${v.id}">🗑️ Dar Baja</button>
          </td>
        `;
        fleetTableBody.appendChild(tr);
      });
    }

    if (fleetFilterSummary) fleetFilterSummary.textContent = `Mostrando ${filtered.length} de ${vehiclesData.length} vehículos`;

    document.querySelectorAll('.btn-edit-vehicle').forEach(btn =>
      btn.addEventListener('click', () => openVehicleModalForEdit(btn.dataset.id))
    );
    document.querySelectorAll('.btn-delete-vehicle').forEach(btn =>
      btn.addEventListener('click', () => deleteVehicle(btn.dataset.id))
    );
  }

  filterFleetCapacity?.addEventListener('change', renderFleetTable);
  filterFleetStatus?.addEventListener('change', renderFleetTable);
  filterFleetSearch?.addEventListener('input', renderFleetTable);

  // Modal Vehículo
  const modalVehicle        = document.getElementById('modal-vehicle-backdrop');
  const modalVehicleTitle   = document.getElementById('modal-vehicle-title');
  const btnSaveVehicle      = document.getElementById('btn-save-vehicle-submit');
  const formVehicle         = document.getElementById('form-vehicle-crud');
  const vEditId             = document.getElementById('v-edit-id');

  function openVehicleModalForCreate() {
    if (vEditId) vEditId.value = '';
    if (modalVehicleTitle) modalVehicleTitle.textContent = 'Registrar Nuevo Vehículo';
    if (btnSaveVehicle) btnSaveVehicle.textContent = 'Guardar Vehículo';
    formVehicle?.reset();
    openModal(modalVehicle);
  }

  function openVehicleModalForEdit(vehicleId) {
    const v = vehiclesData.find(item => item.id === vehicleId);
    if (!v) return;
    if (vEditId) vEditId.value = v.id;
    if (modalVehicleTitle) modalVehicleTitle.textContent = `Editar Vehículo ${v.id} — ${v.placa}`;
    if (btnSaveVehicle) btnSaveVehicle.textContent = 'Actualizar Cambios';
    setVal('v-placa',    v.placa);
    setVal('v-marca',    v.marca);
    setVal('v-modelo',   v.modelo);
    setVal('v-anio',     v.anio);
    setVal('v-capacidad', v.capacidad);
    setVal('v-estado',   v.estado);
    openModal(modalVehicle);
  }

  function closeVehicleModal() {
    closeModal(modalVehicle);
    formVehicle?.reset();
    if (vEditId) vEditId.value = '';
  }

  document.getElementById('btn-open-vehicle-modal')?.addEventListener('click', openVehicleModalForCreate);
  document.getElementById('btn-quick-new-vehicle')?.addEventListener('click', () => { switchView('view-fleet'); openVehicleModalForCreate(); });
  document.getElementById('btn-close-vehicle-modal')?.addEventListener('click', closeVehicleModal);
  document.getElementById('btn-cancel-vehicle-modal')?.addEventListener('click', closeVehicleModal);

  formVehicle?.addEventListener('submit', e => {
    e.preventDefault();
    const editId    = vEditId?.value;
    const placa     = document.getElementById('v-placa').value.toUpperCase().trim();
    const marca     = document.getElementById('v-marca').value.trim();
    const modelo    = document.getElementById('v-modelo').value.trim();
    const anio      = parseInt(document.getElementById('v-anio').value);
    const capacidad = parseFloat(document.getElementById('v-capacidad').value);
    const estado    = document.getElementById('v-estado').value;

    if (editId) {
      const idx = vehiclesData.findIndex(v => v.id === editId);
      if (idx === -1) return;
      if (vehiclesData.some((v, i) => v.placa === placa && i !== idx)) {
        alert(`La placa "${placa}" ya pertenece a otro vehículo.`); return;
      }
      Object.assign(vehiclesData[idx], { placa, marca, modelo, anio, capacidad, estado });
      showToast(`Vehículo ${editId} (${placa}) actualizado correctamente.`, 'success');
    } else {
      if (vehiclesData.some(v => v.placa === placa)) {
        alert(`La placa "${placa}" ya está registrada.`); return;
      }
      const newId = `V-${String(vehiclesData.length + 1).padStart(2, '0')}`;
      vehiclesData.push({ id: newId, placa, marca, modelo, anio, capacidad, estado, soat: '2027-12-31', rt: '2027-12-31' });
      showToast(`Vehículo ${placa} registrado con ID ${newId}.`, 'success');
    }

    renderFleetTable();
    populateVehicleSelects();
    updateKPIs();
    closeVehicleModal();
  });

  function deleteVehicle(id) {
    if (!confirm(`¿Confirmar baja lógica del vehículo ${id}?\nEsta acción lo eliminará del catálogo activo.`)) return;
    vehiclesData = vehiclesData.filter(v => v.id !== id);
    renderFleetTable();
    populateVehicleSelects();
    updateKPIs();
    showToast(`Baja lógica realizada: Vehículo ${id}`, 'danger');
  }

  /* =========================================================================
     §08 — ASIGNACIONES CONDUCTOR ↔ VEHÍCULO
     Ubicación: script.js → §08
     Funciones: populateVehicleSelects, renderAssignmentsTable
     ========================================================================= */
  const assignVehicleSelect = document.getElementById('assign-vehicle-select');
  const assignDriverSelect  = document.getElementById('assign-driver-select');
  const formAssignment      = document.getElementById('form-assignment');
  const assignTableBody     = document.getElementById('assignments-table-body');

  function populateVehicleSelects() {
    // Select de vehículos disponibles (Asignaciones)
    if (assignVehicleSelect) {
      assignVehicleSelect.innerHTML = '<option value="">— Seleccionar Unidad Disponible —</option>';
      vehiclesData.filter(v => v.estado === 'Disponible').forEach(v =>
        assignVehicleSelect.innerHTML += `<option value="${v.id}">${v.id} — ${v.placa} (${v.marca} | ${v.capacidad} Ton)</option>`
      );
    }

    // Select de conductores disponibles (Asignaciones)
    if (assignDriverSelect) {
      assignDriverSelect.innerHTML = '<option value="">— Seleccionar Conductor Disponible —</option>';
      driversData.filter(d => d.estado === 'Disponible').forEach(d =>
        assignDriverSelect.innerHTML += `<option value="${d.id}">${d.nombre} (Lic: ${d.categoria})</option>`
      );
    }

    // Select de vehículos para Fallas Mecánicas (§10)
    const faultSelect = document.getElementById('fault-vehicle-select');
    if (faultSelect) {
      faultSelect.innerHTML = '<option value="">— Seleccionar Vehículo —</option>';
      vehiclesData.forEach(v =>
        faultSelect.innerHTML += `<option value="${v.id}">${v.id} — ${v.placa} (${v.marca})</option>`
      );
    }

    // Select de vehículos para filtro de Historial (§09)
    const histSelect = document.getElementById('history-vehicle-select');
    if (histSelect) {
      histSelect.innerHTML = '<option value="all">Todos los vehículos</option>';
      vehiclesData.forEach(v =>
        histSelect.innerHTML += `<option value="${v.id}">${v.id} — ${v.placa}</option>`
      );
    }

    renderSecurityView();
  }

  function renderAssignmentsTable() {
    if (!assignTableBody) return;
    assignTableBody.innerHTML = '';
    assignmentsData.forEach(a => {
      const badge = a.estado === 'En Ruta' ? 'badge--success' : a.estado === 'Finalizada' ? 'badge--info' : 'badge--warning';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${a.vehiculoId}</strong> (${a.placa})</td>
        <td>${a.conductor}</td>
        <td>${new Date(a.inicio).toLocaleString('es-PE')}</td>
        <td><span class="badge ${badge}">${a.estado}</span></td>
      `;
      assignTableBody.appendChild(tr);
    });
  }

  formAssignment?.addEventListener('submit', e => {
    e.preventDefault();
    const vehId     = assignVehicleSelect.value;
    const driverId  = parseInt(assignDriverSelect.value);
    const inicio    = document.getElementById('assign-date').value;
    const vehicle   = vehiclesData.find(v => v.id === vehId);
    const driver    = driversData.find(d => d.id === driverId);

    if (!vehicle || !driver) { showToast('Selecciona un vehículo y un conductor válidos.', 'danger'); return; }

    vehicle.estado = 'En Ruta';
    driver.estado  = 'En Ruta';
    driver.vehiculoAsignado = vehicle.id;
    driver.placa   = vehicle.placa;

    assignmentsData.push({ id: Date.now(), vehiculoId: vehicle.id, placa: vehicle.placa, conductor: driver.nombre, inicio, estado: 'En Ruta' });
    populateVehicleSelects();
    renderAssignmentsTable();
    renderFleetTable();
    updateKPIs();
    showToast(`Asignación creada: ${driver.nombre} → ${vehicle.placa}`, 'success');
    formAssignment.reset();
  });

  document.getElementById('btn-quick-assignment')?.addEventListener('click', () => switchView('view-assignments'));

  const assignDateInput = document.getElementById('assign-date');
  if (assignDateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    assignDateInput.value = now.toISOString().slice(0, 16);
  }

  /* =========================================================================
     §09 — HISTORIAL DE RUTAS / RECORRIDOS
     Ubicación: script.js → §09
     Funciones: renderHistoryTable, filtro por vehículo y fecha
     ========================================================================= */
  const formHistoryFilter = document.getElementById('form-history-filter');
  const historyTableBody  = document.getElementById('history-table-body');
  const historyLoader     = document.getElementById('history-loader');

  function renderHistoryTable(data = journeyHistoryData) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';
    if (data.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Sin recorridos para los filtros seleccionados.</td></tr>`;
      return;
    }
    data.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${h.fecha}</td>
        <td><strong>${h.vehiculoId}</strong> (${h.placa})</td>
        <td>${h.conductor}</td>
        <td>${h.origen} &rarr; <strong>${h.destino}</strong></td>
        <td>${h.inicio} – ${h.fin}</td>
        <td><small>${h.paradas}</small></td>
        <td><button type="button" class="btn btn--sm btn--outline btn-view-route-map" data-veh="${h.vehiculoId}" data-route="${h.origen} a ${h.destino}" title="Ver unidad en mapa">🗺️ Ver Ruta</button></td>
      `;
      tr.querySelector('.btn-view-route-map')?.addEventListener('click', () => {
        switchView('view-tracking');
        const unit = gpsUnits.find(u => u.id === h.vehiculoId);
        if (unit) {
          inspectVehicle(unit);
          if (googleMapInstance) {
            googleMapInstance.setCenter({ lat: unit.lat, lng: unit.lng });
            googleMapInstance.setZoom(15);
          }
        }
        showToast(`📍 Visualizando unidad ${h.vehiculoId} (${h.placa}) en mapa GPS`, 'info');
      });
      historyTableBody.appendChild(tr);
    });
  }

  formHistoryFilter?.addEventListener('submit', e => {
    e.preventDefault();
    historyLoader?.classList.remove('hidden');
    setTimeout(() => {
      historyLoader?.classList.add('hidden');
      const vehId    = document.getElementById('history-vehicle-select')?.value;
      const dateFrom = document.getElementById('history-date-from')?.value;
      const dateTo   = document.getElementById('history-date-to')?.value;
      let filtered   = vehId === 'all' ? [...journeyHistoryData] : journeyHistoryData.filter(j => j.vehiculoId === vehId);
      if (dateFrom) filtered = filtered.filter(j => j.fecha >= dateFrom);
      if (dateTo)   filtered = filtered.filter(j => j.fecha <= dateTo);
      renderHistoryTable(filtered);
      showToast(`${filtered.length} recorrido(s) encontrado(s).`, 'success');
    }, 800);
  });

  document.getElementById('btn-reset-history')?.addEventListener('click', () => {
    formHistoryFilter?.reset();
    renderHistoryTable();
  });

  /* =========================================================================
     §10 — REGISTRO DE FALLAS MECÁNICAS
     Ubicación: script.js → §10
     Funciones: renderFaultsTable, openFaultModalForCreate/Edit, formFaultCrud
     ========================================================================= */
  const modalFault     = document.getElementById('modal-fault-backdrop');
  const modalFaultTitle = document.getElementById('modal-fault-title');
  const btnSaveFault   = document.getElementById('btn-save-fault-submit');
  const formFault      = document.getElementById('form-fault-crud');
  const faultsTableBody = document.getElementById('faults-table-body');
  const faultDesc      = document.getElementById('fault-desc');
  const faultCharCnt   = document.getElementById('fault-char-counter');
  const faultEditId    = document.getElementById('fault-edit-id');

  function renderFaultsTable() {
    if (!faultsTableBody) return;
    faultsTableBody.innerHTML = '';
    if (mechanicalFaultsData.length === 0) {
      faultsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Sin fallas mecánicas registradas.</td></tr>`;
      return;
    }
    mechanicalFaultsData.forEach(f => {
      const badge = f.estado === 'En Taller' ? 'badge--danger' : 'badge--success';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${f.id}</strong></td>
        <td>${f.vehiculoId} (${f.placa})</td>
        <td>${f.fecha}</td>
        <td><span class="badge badge--warning">${f.categoria}</span></td>
        <td>${f.desc}</td>
        <td><span class="badge ${badge}">${f.estado}</span></td>
        <td><button type="button" class="btn btn--sm btn--outline btn-edit-fault" data-id="${f.id}">✏️ Editar</button></td>
      `;
      faultsTableBody.appendChild(tr);
    });
    document.querySelectorAll('.btn-edit-fault').forEach(btn =>
      btn.addEventListener('click', () => openFaultModalForEdit(btn.dataset.id))
    );
  }

  faultDesc?.addEventListener('input', () => {
    if (faultCharCnt) faultCharCnt.textContent = 500 - faultDesc.value.length;
  });

  function openFaultModalForCreate() {
    if (faultEditId) faultEditId.value = '';
    if (modalFaultTitle) modalFaultTitle.textContent = 'Registrar Falla Mecánica';
    if (btnSaveFault)   btnSaveFault.textContent = 'Registrar Falla';
    formFault?.reset();
    openModal(modalFault);
  }

  function openFaultModalForEdit(faultId) {
    const f = mechanicalFaultsData.find(item => item.id === faultId);
    if (!f) return;
    if (faultEditId) faultEditId.value = f.id;
    if (modalFaultTitle) modalFaultTitle.textContent = `Editar Falla Mecánica ${f.id}`;
    if (btnSaveFault)   btnSaveFault.textContent = 'Actualizar Falla';
    setVal('fault-vehicle-select', f.vehiculoId);
    setVal('fault-date',     f.fecha);
    setVal('fault-category', f.categoria);
    if (faultDesc) faultDesc.value = f.desc;
    if (faultCharCnt) faultCharCnt.textContent = 500 - f.desc.length;
    openModal(modalFault);
  }

  function closeFaultModal() {
    closeModal(modalFault);
    formFault?.reset();
    if (faultEditId) faultEditId.value = '';
  }

  document.getElementById('btn-open-fault-modal')?.addEventListener('click', openFaultModalForCreate);
  document.getElementById('btn-close-fault-modal')?.addEventListener('click', closeFaultModal);
  document.getElementById('btn-cancel-fault-modal')?.addEventListener('click', closeFaultModal);

  formFault?.addEventListener('submit', e => {
    e.preventDefault();
    const editId    = faultEditId?.value;
    const vehId     = document.getElementById('fault-vehicle-select')?.value;
    const fecha     = document.getElementById('fault-date')?.value;
    const categoria = document.getElementById('fault-category')?.value;
    const desc      = faultDesc?.value.trim();

    if (new Date(fecha) > new Date()) { alert('La fecha de la falla no puede ser futura.'); return; }
    const veh = vehiclesData.find(v => v.id === vehId);
    if (!veh) { alert('Selecciona un vehículo válido.'); return; }

    if (editId) {
      const idx = mechanicalFaultsData.findIndex(f => f.id === editId);
      if (idx !== -1) {
        Object.assign(mechanicalFaultsData[idx], { vehiculoId: veh.id, placa: veh.placa, fecha, categoria, desc });
        showToast(`Falla mecánica ${editId} actualizada.`, 'success');
      }
    } else {
      veh.estado = 'En Taller';
      mechanicalFaultsData.push({
        id: `F-${String(mechanicalFaultsData.length + 1).padStart(2, '0')}`,
        vehiculoId: veh.id, placa: veh.placa, fecha, categoria, desc, estado: 'En Taller'
      });
      showToast(`Falla registrada para ${veh.placa}. Vehículo en taller.`, 'danger');
    }

    renderFaultsTable();
    renderFleetTable();
    updateKPIs();
    closeFaultModal();
  });

  const faultDateInput = document.getElementById('fault-date');
  if (faultDateInput) {
    const today = new Date().toISOString().split('T')[0];
    faultDateInput.max = today;
    faultDateInput.value = today;
  }

  /* =========================================================================
     §11 — CENTRO DE ALERTAS Y BOTÓN DE PÁNICO
     Ubicación: script.js → §11
     Funciones: triggerPanicAlert, resolveAlert, renderAlertsTable
     ========================================================================= */
  const alertsTableBody    = document.getElementById('alerts-table-body');
  const emergencyBanner    = document.getElementById('emergency-alert-banner');
  const emergencyDetails   = document.getElementById('emergency-details-text');
  const btnGoAlerts        = document.getElementById('btn-go-to-panic');
  const btnResolveBanner   = document.getElementById('btn-resolve-emergency-banner');

  function renderAlertsTable() {
    if (!alertsTableBody) return;
    alertsTableBody.innerHTML = '';
    if (alertsData.length === 0) {
      alertsTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Sin alertas de emergencia activas.</td></tr>`;
      return;
    }
    alertsData.forEach(a => {
      const statBadge = a.estado === 'Pendiente' ? 'badge--danger' : 'badge--success';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${a.id}</strong></td>
        <td>${a.timestamp}</td>
        <td>${a.vehiculoId} (${a.placa})</td>
        <td>${a.conductor}</td>
        <td><span class="badge badge--danger">${a.tipo}</span></td>
        <td><code>${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}</code></td>
        <td><span class="badge ${statBadge}">${a.estado}</span></td>
        <td>${a.estado === 'Pendiente'
          ? `<button type="button" class="btn btn--sm btn--success btn-resolve-alert" data-id="${a.id}">✅ Atender</button>`
          : '<span class="text-muted">Atendida</span>'}</td>
      `;
      alertsTableBody.appendChild(tr);
    });
    document.querySelectorAll('.btn-resolve-alert').forEach(btn =>
      btn.addEventListener('click', () => resolveAlert(parseInt(btn.dataset.id)))
    );
  }

  function triggerPanicAlert(unit) {
    const alert = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString('es-PE'),
      vehiculoId: unit.id, placa: unit.placa, conductor: unit.driver,
      tipo: '🚨 BOTÓN DE PÁNICO',
      lat: unit.lat, lng: unit.lng,
      estado: 'Pendiente'
    };
    alertsData.unshift(alert);
    renderAlertsTable();
    updateKPIs();
    if (emergencyBanner && emergencyDetails) {
      emergencyDetails.textContent = `Vehículo ${unit.id} (${unit.placa}) — Lat: ${unit.lat.toFixed(4)}, Lng: ${unit.lng.toFixed(4)}`;
      emergencyBanner.classList.remove('hidden');
    }
    showToast(`🚨 ¡ALERTA DE PÁNICO! ${unit.driver} (${unit.placa})`, 'danger');
    announce('¡Alerta de pánico activada en la flota!');
  }

  function resolveAlert(alertId) {
    const a = alertsData.find(item => item.id === alertId);
    if (!a) return;
    a.estado = 'Atendida';
    renderAlertsTable();
    updateKPIs();
    if (!alertsData.some(item => item.estado === 'Pendiente')) emergencyBanner?.classList.add('hidden');
    showToast(`Alerta ${alertId} marcada como atendida.`, 'success');
  }

  btnResolveBanner?.addEventListener('click', () => {
    const pending = alertsData.find(a => a.estado === 'Pendiente');
    if (pending) resolveAlert(pending.id);
  });
  btnGoAlerts?.addEventListener('click', () => switchView('view-alerts'));

  // Botón de pánico del panel conductor
  document.getElementById('btn-driver-panic')?.addEventListener('click', () => {
    if (currentUser?.role === 'driver') {
      const unit = gpsUnits.find(u => u.placa === currentUser.placa) || gpsUnits[0];
      triggerPanicAlert(unit);
      showToast('🚨 Alerta enviada al administrador. Mantén la calma.', 'danger');
    } else {
      triggerPanicAlert(gpsUnits[0]);
    }
  });

  // Botones de estado del conductor (panel móvil)
  let selectedDriverStatus = 'En Ruta';
  document.querySelectorAll('.btn-status-touch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-status-touch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDriverStatus = btn.dataset.status;
      const commentDiv = document.getElementById('driver-comment-container');
      if (commentDiv) commentDiv.classList.toggle('hidden', selectedDriverStatus !== 'Avería');
    });
  });
  document.getElementById('btn-save-driver-status')?.addEventListener('click', () => {
    if (currentUser?.role === 'driver') {
      const driver = driversData.find(d => d.id === currentUser.driverId);
      if (driver) driver.estado = selectedDriverStatus;
      updateKPIs();
    }
    showToast(`Estado actualizado: "${selectedDriverStatus}"`, 'success');
  });

  /* =========================================================================
     §12 — GENERADOR DE REPORTES (Excel XLSX + PDF imprimible)
     Ubicación: script.js → §12
     Dependencia externa: SheetJS CDN (window.XLSX)
     Tipos de reporte: flota, recorridos, fallas, alertas
     ========================================================================= */
  const formReport       = document.getElementById('form-report-generator');
  const downloadHistList = document.getElementById('download-history-list');

  formReport?.addEventListener('submit', e => {
    e.preventDefault();
    const type   = document.getElementById('report-type-select')?.value;
    const format = document.querySelector('input[name="report-format"]:checked')?.value;
    const btn    = document.getElementById('btn-generate-report');
    if (btn) btn.textContent = '🔄 Procesando…';

    setTimeout(() => {
      if (btn) btn.textContent = '📥 Generar & Descargar Reporte';
      const d = new Date();
      const dateStr = `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
      if (format === 'excel') generateExcelReport(type, dateStr);
      else                    generatePdfReport(type, dateStr);
    }, 900);
  });

  function buildReportData(type) {
    switch (type) {
      case 'flota':
        return vehiclesData.map(v => ({
          'ID':           v.id,
          'Placa':        v.placa,
          'Marca':        v.marca,
          'Modelo':       v.modelo,
          'Año':          v.anio,
          'Cap. (Ton)':   v.capacidad,
          'Estado':       v.estado,
          'SOAT Vence':   v.soat,
          'RT Vence':     v.rt,
        }));
      case 'recorridos':
        return journeyHistoryData.map(j => ({
          'ID Recorrido': j.id,
          'Fecha':        j.fecha,
          'Placa':        j.placa,
          'Conductor':    j.conductor,
          'Origen':       j.origen,
          'Destino':      j.destino,
          'Inicio':       j.inicio,
          'Fin':          j.fin,
          'Paradas':      j.paradas,
        }));
      case 'fallas':
        return mechanicalFaultsData.map(f => ({
          'ID Falla':     f.id,
          'Vehículo':     f.vehiculoId,
          'Placa':        f.placa,
          'Fecha':        f.fecha,
          'Categoría':    f.categoria,
          'Descripción':  f.desc,
          'Estado':       f.estado,
        }));
      default: // alertas
        return (alertsData.length > 0 ? alertsData : [
          { id: 'ALT-000', timestamp: '—', vehiculoId: '—', placa: '—', conductor: '—', tipo: '—', lat: 0, lng: 0, estado: '—' }
        ]).map(a => ({
          'ID Alerta':  a.id,
          'Hora':       a.timestamp,
          'Vehículo':   a.vehiculoId,
          'Placa':      a.placa,
          'Conductor':  a.conductor,
          'Tipo':       a.tipo,
          'Latitud':    a.lat,
          'Longitud':   a.lng,
          'Estado':     a.estado,
        }));
    }
  }

  function generateExcelReport(type, dateStr) {
    const data     = buildReportData(type);
    const fileName = `Reporte_${type.toUpperCase()}_${dateStr}.xlsx`;
    if (typeof XLSX === 'undefined') { alert('Motor Excel aún cargando. Reintenta en un momento.'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Operativo');
    XLSX.writeFile(wb, fileName);
    addDownloadItem(fileName, 'Excel (.xlsx)');
    showToast(`✅ Excel descargado: ${fileName}`, 'success');
  }

  function generatePdfReport(type, dateStr) {
    const data     = buildReportData(type);
    const fileName = `Reporte_${type.toUpperCase()}_${dateStr}.pdf`;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) { alert('El navegador bloqueó la ventana emergente. Permite pop-ups.'); return; }
    const headers  = Object.keys(data[0] || {});
    const thStr    = headers.map(h => `<th>${h}</th>`).join('');
    const rowStr   = data.map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`).join('');

    printWin.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>${fileName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:28px;color:#111}
        .header{border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
        .co-name{font-size:18px;font-weight:700;color:#0f172a}
        .co-meta{font-size:11px;color:#555;margin-top:4px}
        .rep-title{text-align:right;font-size:11px;color:#555}
        h2{color:#1e40af;margin-bottom:8px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f1f5f9;font-weight:600}
        tr:nth-child(even){background:#fafafa}
        .footer{margin-top:24px;font-size:10px;color:#777;text-align:center;border-top:1px solid #eee;padding-top:8px}
      </style>
    </head><body>
      <div class="header">
        <div>
          <div class="co-name">TRANSPORTES CHILENO E.I.R.L.</div>
          <div class="co-meta">RUC: 20262479421 | Av. los Dominicos Mza. N Lote. 03, San Martín de Porres, Lima</div>
        </div>
        <div class="rep-title">
          <strong>REPORTE OPERATIVO</strong><br/>
          Tipo: ${type.toUpperCase()}<br/>
          Generado: ${new Date().toLocaleString('es-PE')}<br/>
          Archivo: ${fileName}
        </div>
      </div>
      <h2>Reporte: ${type.charAt(0).toUpperCase() + type.slice(1)}</h2>
      <table><thead><tr>${thStr}</tr></thead><tbody>${rowStr}</tbody></table>
      <div class="footer">Sistema Web de Monitoreo — Transportes Chileno E.I.R.L. — Documento generado electrónicamente</div>
      <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    printWin.document.close();
    addDownloadItem(fileName, 'PDF/Impresión');
    showToast(`📄 PDF abierto para imprimir: ${fileName}`, 'success');
  }

  function addDownloadItem(fileName, label) {
    if (!downloadHistList) return;
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <span class="file-icon">${label.includes('Excel') ? '📊' : '📄'}</span>
      <div>
        <strong>${fileName}</strong>
        <p class="file-meta">Generado a las ${new Date().toLocaleTimeString('es-PE')} | Formato ${label}</p>
      </div>
      <span class="badge badge--success">Descargado</span>
    `;
    downloadHistList.prepend(li);
  }

  /* =========================================================================
     §13 — MAPA GPS GOOGLE MAPS (Inicialización Lazy & Marcadores en Tiempo Real)
     Ubicación: script.js → §13
     Funciones: initMap, initMapIfNeeded, startGpsSimulation, inspectVehicle
     ========================================================================= */
  let mapInitialized = false;
  let googleMapInstance = null;
  let googleMarkers = [];
  let gpsSimInterval = null;
  let currentMapFilter = 'all';
  let selectedGpsUnitId = null;

  // Enlace del disparador al callback global
  window._triggerInitMap = initMapIfNeeded;
  if (window._googleMapsCallbackFired) {
    initMapIfNeeded();
  }

  function initMapIfNeeded() {
    if (mapInitialized && googleMapInstance) {
      if (typeof google !== 'undefined' && google.maps && google.maps.event) {
        google.maps.event.trigger(googleMapInstance, 'resize');
      }
      return;
    }

    const mapEl = document.getElementById('main-gps-map');
    if (!mapEl) return;

    if (typeof google === 'undefined' || !google.maps) {
      console.warn('[Google Maps] La API de Google Maps aún no está cargada o no tiene una API Key válida.');
      mapEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#eab308;padding:2rem;text-align:center;">
          <span style="font-size:2.5rem;margin-bottom:0.75rem">📍</span>
          <strong style="font-size:1.1rem;color:#f8fafc">Google Maps API pendiente de configuración</strong>
          <p style="color:#94a3b8;font-size:0.875rem;margin-top:0.5rem;max-width:440px;">
            Recuerda reemplazar <code>TU_API_KEY_AQUI</code> en el archivo <code>index.html</code> con tu clave válida de Google Cloud Console.
          </p>
        </div>
      `;
      return;
    }

    mapInitialized = true;
    const center = { lat: GPS_CENTER_LAT, lng: GPS_CENTER_LNG };

    // Inicializar mapa de Google
    googleMapInstance = new google.maps.Map(mapEl, {
      center: center,
      zoom: 13,
      mapTypeId: 'roadmap',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
      ]
    });
    window.mainMap = googleMapInstance;

    // Crear marcadores para cada unidad
    googleMarkers = [];
    gpsUnits.forEach(unit => {
      const markerColor = unit.status === 'En Ruta' ? '#10b981' : unit.status === 'Disponible' ? '#3b82f6' : '#ef4444';
      
      const marker = new google.maps.Marker({
        position: { lat: unit.lat, lng: unit.lng },
        map: googleMapInstance,
        title: `${unit.id} — ${unit.placa}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="color:#111;font-family:sans-serif;font-size:12px;padding:4px">
          <strong>${unit.id} — ${unit.placa}</strong><br/>
          Conductor: ${unit.driver}<br/>
          Estado: <b>${unit.status}</b> | Vel: <b>${Math.round(unit.speed)} km/h</b>
        </div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMapInstance, marker);
        inspectVehicle(unit);
        highlightVehicleInList(unit.id);
      });

      unit.googleMarker = marker;
      unit.infoWindow = infoWindow;
      googleMarkers.push(marker);
    });

    // Configurar filtro de vehículos en mapa
    document.getElementById('map-filter-status')?.addEventListener('change', e => {
      filterMapUnits(e.target.value);
    });

    // Configurar botón recentrar
    document.getElementById('btn-recenter-map')?.addEventListener('click', () => {
      recenterMap();
    });

    // Renderizar lista lateral de unidades
    renderGpsVehicleList();

    // Iniciar simulación de telemetría GPS
    startGpsSimulation();

    // Inicializar mini-mapa del dashboard
    initMiniMap();
  }

  // Filtrado de vehículos en Google Maps
  function filterMapUnits(status) {
    currentMapFilter = status;
    gpsUnits.forEach(unit => {
      if (!unit.googleMarker) return;
      const shouldShow = status === 'all' || unit.status === status;
      unit.googleMarker.setVisible(shouldShow);
    });
    renderGpsVehicleList();
    showToast(`Filtro aplicado: ${status === 'all' ? 'Todos los vehículos' : status}`, 'info');
  }

  function recenterMap() {
    if (googleMapInstance) {
      googleMapInstance.setCenter({ lat: GPS_CENTER_LAT, lng: GPS_CENTER_LNG });
      googleMapInstance.setZoom(13);
    }
    announce('Mapa centrado en Base San Martín de Porres');
  }

  // Mini-mapa del dashboard
  function initMiniMap() {
    const miniEl = document.getElementById('dashboard-mini-map');
    if (!miniEl) return;

    if (typeof google !== 'undefined' && google.maps) {
      try {
        miniEl.innerHTML = '';
        const miniMap = new google.maps.Map(miniEl, {
          center: { lat: GPS_CENTER_LAT, lng: GPS_CENTER_LNG },
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: 'none',
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }
          ]
        });

        gpsUnits.filter(u => u.status === 'En Ruta').forEach(u => {
          new google.maps.Marker({
            position: { lat: u.lat, lng: u.lng },
            map: miniMap,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5
            }
          });
        });
        return;
      } catch (e) {
        console.warn('Error inicializando mini-mapa Google Maps:', e);
      }
    }
  }

  // Simulación continua de GPS
  function startGpsSimulation() {
    if (gpsSimInterval) clearInterval(gpsSimInterval);
    gpsSimInterval = setInterval(() => {
      gpsUnits.forEach(unit => {
        if (unit.status !== 'En Ruta') return;
        unit.lat += (Math.random() - 0.5) * 0.0008;
        unit.lng += (Math.random() - 0.5) * 0.0008;
        unit.speed = Math.max(25, Math.min(88, unit.speed + (Math.random() - 0.5) * 8));

        if (unit.googleMarker) {
          unit.googleMarker.setPosition({ lat: unit.lat, lng: unit.lng });
        }
      });
      updateGpsVehicleListPositions();
    }, 3000);
  }

  // Lista lateral de vehículos
  function renderGpsVehicleList() {
    const listEl = document.getElementById('gps-vehicle-list');
    const badgeEl = document.getElementById('gps-units-badge');
    if (!listEl) return;

    const filtered = gpsUnits.filter(u => currentMapFilter === 'all' || u.status === currentMapFilter);
    if (badgeEl) badgeEl.textContent = `${filtered.length} visible(s)`;

    listEl.innerHTML = '';
    filtered.forEach(unit => {
      const color = unit.status === 'En Ruta' ? '#10b981' : unit.status === 'Disponible' ? '#3b82f6' : '#ef4444';
      const item = document.createElement('div');
      item.className = `gps-list-item ${unit.id === selectedGpsUnitId ? 'is-selected' : ''}`;
      item.id = `gps-item-${unit.id}`;
      item.innerHTML = `
        <div class="gps-item-dot" style="background:${color}"></div>
        <div class="gps-item-info">
          <strong>${unit.id} — ${unit.placa}</strong>
          <span class="gps-item-driver">${unit.driver !== '—' ? unit.driver : 'Sin conductor'}</span>
          <span class="gps-item-coords" id="gps-coords-${unit.id}">${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)} • <b style="color:var(--gold)">${Math.round(unit.speed)} km/h</b></span>
        </div>
        <span class="badge" style="background:${color};color:#fff;font-size:0.65rem">${unit.status}</span>
      `;

      item.addEventListener('click', () => {
        selectedGpsUnitId = unit.id;
        highlightVehicleInList(unit.id);
        if (googleMapInstance) {
          googleMapInstance.setCenter({ lat: unit.lat, lng: unit.lng });
          googleMapInstance.setZoom(15);
          if (unit.infoWindow && unit.googleMarker) {
            unit.infoWindow.open(googleMapInstance, unit.googleMarker);
          }
        }
        inspectVehicle(unit);
      });
      listEl.appendChild(item);
    });
  }

  function highlightVehicleInList(unitId) {
    document.querySelectorAll('.gps-list-item').forEach(el => el.classList.remove('is-selected'));
    const targetItem = document.getElementById(`gps-item-${unitId}`);
    if (targetItem) {
      targetItem.classList.add('is-selected');
      targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateGpsVehicleListPositions() {
    gpsUnits.forEach(unit => {
      const coordsEl = document.getElementById(`gps-coords-${unit.id}`);
      if (coordsEl) {
        coordsEl.innerHTML = `${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)} • <b style="color:var(--gold)">${Math.round(unit.speed)} km/h</b>`;
      }
    });
    if (selectedGpsUnitId) {
      const activeUnit = gpsUnits.find(u => u.id === selectedGpsUnitId);
      if (activeUnit) {
        const inspSpeed = document.getElementById('inspector-speed-val');
        const inspCoords = document.getElementById('inspector-coords');
        if (inspSpeed) inspSpeed.textContent = `${Math.round(activeUnit.speed)} km/h`;
        if (inspCoords) inspCoords.textContent = `${activeUnit.lat.toFixed(5)}, ${activeUnit.lng.toFixed(5)}`;
      }
    }
  }

  // Inspector de vehículo (panel derecho del mapa)
  function inspectVehicle(unit) {
    selectedGpsUnitId = unit.id;
    const content = document.getElementById('inspector-content');
    if (!content) return;
    const color = unit.status === 'En Ruta' ? '#10b981' : unit.status === 'Disponible' ? '#3b82f6' : '#ef4444';
    content.innerHTML = `
      <div class="inspector-card-content">
        <div class="mb-3">
          <span class="badge" style="background:${color};color:#fff">${unit.status}</span>
          <h3 class="mt-2">Unidad ${unit.id} — ${unit.placa}</h3>
          <p class="text-muted text-sm">Conductor: <strong>${unit.driver !== '—' ? unit.driver : 'Sin asignar'}</strong></p>
        </div>
        <div class="data-group mb-3">
          <small class="text-muted">Velocidad GPS:</small>
          <div id="inspector-speed-val" style="font-size:1.6rem;font-weight:800;color:var(--gold);">${Math.round(unit.speed)} km/h</div>
        </div>
        <div class="data-group mb-3">
          <small class="text-muted">Coordenadas GPS:</small>
          <code class="code-tag" style="display:block;margin-top:4px" id="inspector-coords">${unit.lat.toFixed(5)}, ${unit.lng.toFixed(5)}</code>
        </div>
        ${unit.status === 'En Ruta' ? `
        <button type="button" class="btn btn--danger btn--block mt-4" id="btn-trigger-panic-inspector">
          🚨 Emitir Alerta de Pánico
        </button>` : ''}
      </div>
    `;
    document.getElementById('btn-trigger-panic-inspector')?.addEventListener('click', () => triggerPanicAlert(unit));
  }

  /* =========================================================================
     §14 — BARRA DE ACCESIBILIDAD
     Ubicación: script.js → §14
     ========================================================================= */
  const htmlEl = document.documentElement;

  function setTheme(name, activeBtn) {
    htmlEl.setAttribute('data-theme', name);
    ['btn-theme-dark', 'btn-theme-light', 'btn-theme-hc'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
    });
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-pressed', 'true'); }
    announce(`Tema: ${name}`);
  }

  document.getElementById('btn-theme-dark')?.addEventListener('click', e => setTheme('dark', e.currentTarget));
  document.getElementById('btn-theme-light')?.addEventListener('click', e => setTheme('light', e.currentTarget));
  document.getElementById('btn-theme-hc')?.addEventListener('click', e => setTheme('high-contrast', e.currentTarget));

  function setFontSize(name, activeBtn) {
    htmlEl.setAttribute('data-font-size', name);
    ['btn-font-normal', 'btn-font-medium', 'btn-font-large'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-pressed', 'false'); }
    });
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-pressed', 'true'); }
    announce(`Fuente: ${name}`);
  }

  document.getElementById('btn-font-normal')?.addEventListener('click', e => setFontSize('normal', e.currentTarget));
  document.getElementById('btn-font-medium')?.addEventListener('click', e => setFontSize('medium', e.currentTarget));
  document.getElementById('btn-font-large')?.addEventListener('click', e => setFontSize('large', e.currentTarget));

  /* =========================================================================
     §15 — INICIALIZACIÓN GENERAL AL CARGAR
     Ubicación: script.js → §15
     ========================================================================= */
  function openModal(el) { el?.classList.remove('hidden'); el?.setAttribute('aria-hidden', 'false'); }
  function closeModal(el) { el?.classList.add('hidden'); el?.setAttribute('aria-hidden', 'true'); }
  function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value; }

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });

  // Renderizado inicial de todas las vistas
  renderFleetTable();
  populateVehicleSelects();
  renderAssignmentsTable();
  renderHistoryTable();
  renderFaultsTable();
  renderAlertsTable();
  updateKPIs();
  initMiniMap();

  /* =========================================================================
     §16 — EJERCICIO ACADÉMICO DE REFACTORIZACIÓN (SOLO CÓDIGO & COMENTARIOS)
     Ubicación: script.js → §16
     =========================================================================
     A continuación se presenta el caso de refactorización solicitado:
     1. [VERSIÓN ANTERIOR - CON CODE SMELLS]: La función monolítica original
        comentada para estudio (método largo, números mágicos, acoplamiento).
     2. [VERSIÓN POSTERIOR - REFACTORIZADA]: Implementación limpia y desacoplada
        siguiendo principios Clean Code y Single Responsibility (SRP).
     ========================================================================= */

  /* -------------------------------------------------------------------------
     [ANTES / CÓDIGO ORIGINAL CON MALOS OLORES - COMENTADO]
     Malos olores presentes:
       - Long Method / God Function (~100 líneas realizando validación, cálculo y formato)
       - Magic Numbers (12.5, 1.28, 18.65, 6.50, 45, 85, 140, 0.015, 1.45, 0.18, 0.04)
       - Arrow Anti-Pattern (anidamiento profundo de condicionales if/else)
       - Variables crípticas (d_km, p_ton, c_gal, n_ejes)
     -------------------------------------------------------------------------
  function liquidarViaje_ANTES(viajeId, combustibleCustom, aplicarPenalidades) {
    if (!viajeId) {
      return null;
    } else {
      let r = journeyHistoryData.find(j => j.id === viajeId);
      if (!r) {
        return null;
      } else {
        let v = vehiclesData.find(veh => veh.id === r.vehiculoId);
        let d = driversData.find(drv => drv.nombre === r.conductor);
        
        let d_km = r.km ? r.km : 40.0;
        let p_ton = v ? v.capacidad : 20.0;
        let v_marca = v ? v.marca : 'General';

        // Consumo diésel con números mágicos
        let c_gal = (d_km / 12.5) * (1 + (p_ton / 25.0) * 0.28);
        if (v_marca === 'Volvo' || v_marca === 'Scania') {
          c_gal = c_gal * 1.05;
        } else {
          if (v_marca === 'International') {
            c_gal = c_gal * 1.12;
          } else {
            c_gal = c_gal * 1.06;
          }
        }

        let cant_paradas = r.paradas && r.paradas.includes('1') ? 1 : (r.paradas && r.paradas.includes('2') ? 2 : 0);
        if (cant_paradas > 0) c_gal += cant_paradas * 0.75;

        let precio_diesel = combustibleCustom ? parseFloat(combustibleCustom) : 18.65;
        let costo_comb = c_gal * precio_diesel;

        // Peajes con números mágicos
        let peaje_eje = 6.50;
        let n_ejes = v && v.ejes ? v.ejes : (p_ton > 20 ? 6 : 4);
        let cant_peajes = r.destino.includes('Callao') || r.destino.includes('Chorrillos') ? 2 : 1;
        let costo_peajes = cant_peajes * (n_ejes * peaje_eje);

        // Viáticos y bonos
        let viatico_base = d_km > 100 ? 140.0 : (d_km > 50 ? 85.0 : 45.0);
        let bono_cond = 50.0;
        let penalidad = (aplicarPenalidades && cant_paradas >= 3) ? 25.0 : 0.0;
        let neto_conductor = viatico_base + bono_cond - penalidad;

        let subtotal_costo = costo_comb + costo_peajes + viatico_base + Math.max(0, bono_cond - penalidad);
        let costo_operativo_total = subtotal_costo * 1.015; // 1.5% seguro
        let flete_cobrado = costo_operativo_total * 1.45;
        let utilidad_neta = flete_cobrado - costo_operativo_total;

        return {
          viajeId: r.id,
          combustibleGals: c_gal,
          costoCombustible: costo_comb,
          costoPeajes: costo_peajes,
          netoConductor: neto_conductor,
          costoOperativoTotal: costo_operativo_total,
          utilidadNeta: utilidad_neta
        };
      }
    }
  }
  ------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------
     [DESPUÉS / CÓDIGO REFACTORIZADO LIMPIO]
     Mejoras aplicadas:
       1. Reemplazo de números mágicos por constantes semánticas inmutables.
       2. Eliminación de anidamiento mediante cláusulas de guarda (Guard Clauses).
       3. Separación de responsabilidades en funciones puras y reutilizables:
          - calcularConsumoCombustible()
          - calcularCostoPeajes()
          - calcularCompensacionConductor()
          - liquidarViajeRefactorizado()
       4. Código puro a nivel de lógica de negocio, sin acoplamiento al DOM.
     ------------------------------------------------------------------------- */

  const CONFIG_LOGISTICA = Object.freeze({
    RENDIMIENTO_BASE_KM_GALON: 12.5,
    FACTOR_INCREMENTO_PESO: 0.28,
    PESO_REFERENCIA_TON: 25.0,
    CONSUMO_POR_PARADA_GALON: 0.75,
    PRECIO_DIESEL_BASE: 18.65,
    TARIFA_PEAJE_POR_EJE: 6.50,
    TASA_SEGURO_CARGA: 0.015,
    FACTOR_FLETE_COMERCIAL: 1.45,
    TASA_IGV: 0.18,
    TASA_DETRACCION_SPOT: 0.04
  });

  const FACTOR_CONSUMO_MARCA = Object.freeze({
    'Volvo': 1.05,
    'Scania': 1.05,
    'International': 1.12,
    'Hino': 1.08,
    'Mercedes-Benz': 1.06,
    'Default': 1.06
  });

  // Función especializada 1: Cálculo puro de combustible
  function calcularConsumoCombustible(distanciaKm, capacidadTon, marca = 'Default', paradas = 0, precioGalon = CONFIG_LOGISTICA.PRECIO_DIESEL_BASE) {
    const factorCarga = 1 + (capacidadTon / CONFIG_LOGISTICA.PESO_REFERENCIA_TON) * CONFIG_LOGISTICA.FACTOR_INCREMENTO_PESO;
    const consumoBase = (distanciaKm / CONFIG_LOGISTICA.RENDIMIENTO_BASE_KM_GALON) * factorCarga;
    const factorMarca = FACTOR_CONSUMO_MARCA[marca] || FACTOR_CONSUMO_MARCA['Default'];
    
    const galonesTotales = (consumoBase * factorMarca) + (paradas * CONFIG_LOGISTICA.CONSUMO_POR_PARADA_GALON);
    const costoTotal = galonesTotales * precioGalon;

    return {
      galones: Number(galonesTotales.toFixed(2)),
      costo: Number(costoTotal.toFixed(2))
    };
  }

  // Función especializada 2: Cálculo puro de peajes según ruta y ejes
  function calcularCostoPeajes(destino = '', numeroEjes = 4) {
    const rutasDoblePeaje = ['Callao', 'Chorrillos', 'Lurín', 'Villa El Salvador', 'Chancay', 'Huachipa'];
    let garitas = rutasDoblePeaje.some(ruta => destino.includes(ruta)) ? 2 : (destino.includes('Pisco') ? 4 : 1);
    const costoTotal = garitas * (numeroEjes * CONFIG_LOGISTICA.TARIFA_PEAJE_POR_EJE);

    return {
      garitas,
      costo: Number(costoTotal.toFixed(2))
    };
  }

  // Función especializada 3: Viáticos y bonos por desempeño del conductor
  function calcularCompensacionConductor(distanciaKm, paradas = 0, esInfraccionVelocidad = false) {
    let viatico = 45.0;
    if (distanciaKm > 100) viatico = 140.0;
    else if (distanciaKm > 50) viatico = 85.0;

    const bonoBase = 50.0;
    let penalidad = 0.0;
    if (paradas >= 3) penalidad += 25.0;
    if (esInfraccionVelocidad) penalidad += 100.0;

    const neto = Math.max(0, viatico + bonoBase - penalidad);
    return { viatico, bono: bonoBase, penalidad, neto: Number(neto.toFixed(2)) };
  }

  // Orquestador Refactorizado: Integra los cálculos con Cláusulas de Guarda
  function liquidarViajeRefactorizado(viajeId, precioDieselCustom = null, esInfraccion = false) {
    // Cláusula de guarda
    if (!viajeId) return null;
    const viaje = journeyHistoryData.find(j => j.id === viajeId);
    if (!viaje) return null;

    const vehiculo = vehiclesData.find(v => v.id === viaje.vehiculoId);
    const distanciaKm = viaje.km || 40.0;
    const capacidadTon = vehiculo?.capacidad || 20.0;
    const ejes = vehiculo?.ejes || 4;
    const paradas = (viaje.paradas?.match(/\d+/) || [0])[0];
    const precioDiesel = precioDieselCustom ? Number(precioDieselCustom) : CONFIG_LOGISTICA.PRECIO_DIESEL_BASE;

    // Delegación modular a funciones de responsabilidad única
    const combustible = calcularConsumoCombustible(distanciaKm, capacidadTon, vehiculo?.marca, Number(paradas), precioDiesel);
    const peajes = calcularCostoPeajes(viaje.destino, ejes);
    const conductor = calcularCompensacionConductor(distanciaKm, Number(paradas), esInfraccion);

    // Consolidación de costos e impuestos
    const subtotal = combustible.costo + peajes.costo + conductor.viatico + Math.max(0, conductor.bono - conductor.penalidad);
    const seguroCarga = subtotal * CONFIG_LOGISTICA.TASA_SEGURO_CARGA;
    const costoOperativoTotal = subtotal + seguroCarga;

    const fleteComercial = costoOperativoTotal * CONFIG_LOGISTICA.FACTOR_FLETE_COMERCIAL;
    const igv = fleteComercial * CONFIG_LOGISTICA.TASA_IGV;
    const detraccionSunat = (fleteComercial + igv) * CONFIG_LOGISTICA.TASA_DETRACCION_SPOT;
    const utilidadNeta = fleteComercial - costoOperativoTotal;

    return {
      viajeId: viaje.id,
      distanciaKm,
      combustible,
      peajes,
      conductor,
      costoOperativoTotal: Number(costoOperativoTotal.toFixed(2)),
      fleteComercial: Number(fleteComercial.toFixed(2)),
      igv: Number(igv.toFixed(2)),
      detraccionSunat: Number(detraccionSunat.toFixed(2)),
      utilidadNeta: Number(utilidadNeta.toFixed(2)),
      margenPorcentaje: Number(((utilidadNeta / fleteComercial) * 100).toFixed(1))
    };
  }

  // Ejemplo de invocación para pruebas en consola:
  // console.log("Prueba de Liquidación Refactorizada (R-101):", liquidarViajeRefactorizado('R-101'));

}); // fin DOMContentLoaded

