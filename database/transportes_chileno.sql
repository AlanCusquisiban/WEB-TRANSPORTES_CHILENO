-- ================================================================================
-- Base de Datos: transportes_chileno
-- Empresa: Transportes Chileno E.I.R.L. (San Martín de Porres, Lima, Perú)
-- Motor: MySQL 8.0+ / MariaDB 10.4+ (Compatible con XAMPP y MySQL Server Oficial)
-- Codificación: UTF-8 (utf8mb4)
-- Descripción: Esquema relacional completo para gestión de flota vehicular,
--              rastreo GPS, auditoría de liquidación de viajes, fallas mecánicas,
--              alertas de pánico, control de accesos RBAC y dashboards de KPIs.
-- ================================================================================

CREATE DATABASE IF NOT EXISTS transportes_chileno
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE transportes_chileno;

-- --------------------------------------------------------------------------------
-- 1. TABLA: roles
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE,
  descripcion VARCHAR(150),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 2. TABLA: usuarios (Administrador, Supervisores y Conductores con Login)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rol_id BIGINT UNSIGNED NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  usuario VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  password_plain VARCHAR(100) NULL COMMENT 'Clave de compatibilidad para ambiente de desarrollo/evaluación',
  correo VARCHAR(150) NULL UNIQUE,
  telefono VARCHAR(25) NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 3. TABLA: licencias (Licencias de Conducir Brevetes MTC)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licencias (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(40) NOT NULL UNIQUE,
  categoria VARCHAR(20) NOT NULL DEFAULT 'A-IIIc',
  fecha_emision DATE NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('Vigente','Vencida','Suspendida') NOT NULL DEFAULT 'Vigente',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 4. TABLA: conductores
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conductores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NULL UNIQUE,
  usuario_id BIGINT UNSIGNED NULL UNIQUE,
  licencia_id BIGINT UNSIGNED NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  documento VARCHAR(20) NOT NULL UNIQUE,
  telefono VARCHAR(25) NULL,
  password_acceso VARCHAR(100) NOT NULL DEFAULT '1234',
  estado ENUM('Disponible','En Ruta','En Descanso','Inactivo') NOT NULL DEFAULT 'Disponible',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conductor_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_conductor_licencia FOREIGN KEY (licencia_id) REFERENCES licencias(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 5. TABLA: vehiculos
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehiculos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  placa VARCHAR(15) NOT NULL UNIQUE,
  marca VARCHAR(60) NOT NULL,
  modelo VARCHAR(60) NOT NULL,
  anio SMALLINT UNSIGNED NOT NULL,
  capacidad_toneladas DECIMAL(8,2) NOT NULL DEFAULT 20.0,
  ejes TINYINT UNSIGNED NOT NULL DEFAULT 4,
  soat VARCHAR(30) NULL DEFAULT 'Vigente 2027',
  rt VARCHAR(30) NULL DEFAULT 'Aprobado 2026',
  estado ENUM('Disponible','En Ruta','En Taller','Averia','En Descanso','Inactivo') NOT NULL DEFAULT 'Disponible',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vehiculo_estado (estado),
  INDEX idx_vehiculo_placa (placa)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 6. TABLA: documentos_vehiculo
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_vehiculo (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  tipo ENUM('SOAT','Revision Tecnica','Tarjeta de Propiedad','Permiso MTC','Otro') NOT NULL,
  numero VARCHAR(60) NULL,
  fecha_emision DATE NULL,
  fecha_vencimiento DATE NULL,
  archivo_url VARCHAR(500) NULL,
  estado ENUM('Vigente','Por Vencer','Vencido') NOT NULL DEFAULT 'Vigente',
  CONSTRAINT fk_documento_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_documento_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 7. TABLA: rutas
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rutas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  origen VARCHAR(180) NOT NULL,
  destino VARCHAR(180) NOT NULL,
  distancia_km DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duracion_estimada_min INT UNSIGNED NULL,
  estado ENUM('Programada','En Curso','Finalizada','Cancelada') NOT NULL DEFAULT 'Programada',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 8. TABLA: asignaciones (Conductor <-> Vehículo <-> Ruta)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asignaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NULL UNIQUE,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  conductor_id BIGINT UNSIGNED NOT NULL,
  ruta_id BIGINT UNSIGNED NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NULL,
  estado ENUM('Programada','En Ruta','Finalizada','Cancelada') NOT NULL DEFAULT 'Programada',
  observaciones TEXT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_asig_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_asig_conductor FOREIGN KEY (conductor_id) REFERENCES conductores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_asig_ruta FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_asignacion_estado (estado),
  INDEX idx_asignacion_fecha (fecha_inicio)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 9. TABLA: ubicaciones (Telemetría GPS en tiempo real)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ubicaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  asignacion_id BIGINT UNSIGNED NULL,
  latitud DECIMAL(10,7) NOT NULL,
  longitud DECIMAL(10,7) NOT NULL,
  velocidad_kmh DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  registrado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ubicacion_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ubicacion_asignacion FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_ubicacion_vehiculo_fecha (vehiculo_id, registrado_en)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 10. TABLA: fallas_mecanicas
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fallas_mecanicas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NULL UNIQUE,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  conductor_id BIGINT UNSIGNED NULL,
  tipo VARCHAR(100) NOT NULL DEFAULT 'Mecánica General',
  descripcion TEXT NOT NULL,
  fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_solucion DATETIME NULL,
  severidad ENUM('Baja','Media','Alta','Critica') NOT NULL DEFAULT 'Media',
  estado ENUM('Pendiente','En Atencion','Resuelto','Resuelta','Reportada') NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT fk_falla_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_falla_conductor FOREIGN KEY (conductor_id) REFERENCES conductores(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_falla_estado (estado)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 11. TABLA: alertas (Centro de Pánico y Alertas Críticas)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NULL UNIQUE,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  conductor_id BIGINT UNSIGNED NULL,
  tipo ENUM('Panico','Averia','Geocerca','Velocidad','Mantenimiento','Otro') NOT NULL DEFAULT 'Otro',
  mensaje VARCHAR(500) NOT NULL,
  latitud DECIMAL(10,7) NULL,
  longitud DECIMAL(10,7) NULL,
  estado ENUM('Activa','Pendiente','Atendida','Resuelta','Cerrada') NOT NULL DEFAULT 'Activa',
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendida_en DATETIME NULL,
  CONSTRAINT fk_alerta_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_alerta_conductor FOREIGN KEY (conductor_id) REFERENCES conductores(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_alerta_estado_fecha (estado, creada_en)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 12. TABLA: viajes_historial (Historial de Rutas & Liquidaciones de Viaje - §16)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viajes_historial (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_viaje VARCHAR(30) NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  vehiculo_id BIGINT UNSIGNED NOT NULL,
  placa VARCHAR(20) NOT NULL,
  conductor_id BIGINT UNSIGNED NULL,
  conductor_nombre VARCHAR(150) NOT NULL,
  origen VARCHAR(200) NOT NULL,
  destino VARCHAR(200) NOT NULL,
  distancia_km DECIMAL(10,2) NOT NULL DEFAULT 40.0,
  duracion VARCHAR(50) NOT NULL DEFAULT '1h 30m',
  paradas VARCHAR(50) NOT NULL DEFAULT '0 paradas',
  combustible_gal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_combustible DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_peajes DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  viatico_conductor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  bono_conductor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  penalidad_conductor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  neto_conductor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  costo_operativo_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  flete_comercial DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  igv DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  detraccion_sunat DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  utilidad_neta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  margen_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  estado ENUM('Completado','En Curso','Cancelado','Liquidado') NOT NULL DEFAULT 'Completado',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_viaje_vehiculo FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON UPDATE CASCADE,
  CONSTRAINT fk_viaje_conductor FOREIGN KEY (conductor_id) REFERENCES conductores(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_viaje_fecha (fecha),
  INDEX idx_viaje_placa (placa)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 13. TABLA: configuracion_sistema (Seguridad y Parámetros Globales)
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  clave VARCHAR(60) PRIMARY KEY,
  valor TEXT NOT NULL,
  descripcion VARCHAR(255) NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 14. TABLA: notificaciones
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NULL,
  alerta_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(150) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notificacion_alerta FOREIGN KEY (alerta_id) REFERENCES alertas(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- --------------------------------------------------------------------------------
-- 15. TABLA: auditoria
-- --------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NULL,
  entidad VARCHAR(80) NOT NULL,
  entidad_id BIGINT UNSIGNED NULL,
  accion ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','PASSWORD_CHANGE','OTRA') NOT NULL,
  detalle JSON NULL,
  ip_origen VARCHAR(45) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_auditoria_entidad (entidad, entidad_id),
  INDEX idx_auditoria_fecha (creado_en)
) ENGINE=InnoDB;


-- ================================================================================
-- DATOS INICIALES SEMILLA (SEED DATA)
-- Garantiza persistencia inmediata de usuarios, conductores, 10 camiones, viajes y fallas
-- ================================================================================

-- 1. Roles
INSERT IGNORE INTO roles (id, nombre, descripcion) VALUES
(1, 'Administrador', 'Acceso total de administración y gestión del sistema'),
(2, 'Supervisor', 'Supervisión de operaciones, monitoreo y reportes de flota'),
(3, 'Conductor', 'Acceso al módulo móvil de conducción y botón de pánico');

-- 2. Usuario Administrador (user: admin / pass: admin)
INSERT IGNORE INTO usuarios (id, rol_id, nombres, apellidos, usuario, password_hash, password_plain, correo, telefono, estado) VALUES
(1, 1, 'Administrador', 'General', 'admin', '$2b$10$T1q8hR6Bf3Q5F3w5gVbV6OHn3f1oKjN2aE9yQ1eM7xP4mQ9yQ1eM7', 'admin', 'admin@transporteschileno.pe', '999888777', 'Activo');

-- 3. Parámetros de Configuración del Sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
('admin_user', 'admin', 'Usuario de acceso para el Administrador'),
('admin_pass', 'admin', 'Contraseña actual del Administrador'),
('default_driver_pass', '1234', 'Contraseña predeterminada para conductores'),
('precio_diesel_galon', '18.65', 'Precio de referencia del galón Diesel B5 S-50 en S/.'),
('tarifa_peaje_eje', '6.50', 'Tarifa por eje vehicular en garitas oficiales de Lima (S/.)')
ON DUPLICATE KEY UPDATE valor = VALUES(valor);

-- 4. Licencias Brevetes MTC
INSERT IGNORE INTO licencias (id, numero, categoria, fecha_emision, fecha_vencimiento, estado) VALUES
(1, 'Q-44589201', 'A-IIIc', '2022-01-15', '2027-01-15', 'Vigente'),
(2, 'Q-12894563', 'A-IIIc', '2021-06-10', '2026-06-10', 'Vigente'),
(3, 'Q-98741236', 'A-IIIc', '2020-03-22', '2025-03-22', 'Vigente'),
(4, 'Q-74589632', 'A-IIIb', '2023-05-18', '2028-05-18', 'Vigente'),
(5, 'Q-36985214', 'A-IIIc', '2021-11-04', '2026-11-04', 'Vigente'),
(6, 'Q-85214796', 'A-IIIb', '2022-08-12', '2027-08-12', 'Vigente'),
(7, 'Q-14725836', 'A-IIIc', '2020-09-30', '2025-09-30', 'Vigente');

-- 5. Conductores (user: nombre o placa / pass: 1234)
INSERT IGNORE INTO conductores (id, codigo, usuario_id, licencia_id, nombres, apellidos, documento, telefono, password_acceso, estado) VALUES
(1, 'D-01', NULL, 1, 'Carlos', 'Mendoza Quispe', '44589201', '987654321', '1234', 'En Ruta'),
(2, 'D-02', NULL, 2, 'Marco Aurelio', 'Ríos Salazar', '12894563', '976543210', '1234', 'En Ruta'),
(3, 'D-03', NULL, 3, 'Jorge Luis', 'Huamán Castro', '98741236', '965432109', '1234', 'Disponible'),
(4, 'D-04', NULL, 4, 'Walter', 'Poma Cruz', '74589632', '954321098', '1234', 'Disponible'),
(5, 'D-05', NULL, 5, 'Segundo', 'Ramos Vega', '36985214', '943210987', '1234', 'En Ruta'),
(6, 'D-06', NULL, 6, 'Andrés', 'Tello Flores', '85214796', '932109876', '1234', 'Disponible'),
(7, 'D-07', NULL, 7, 'Raúl', 'Espinoza Peña', '14725836', '921098765', '1234', 'En Ruta');

-- 6. Vehículos de Carga Pesada (10 camiones del proyecto)
INSERT IGNORE INTO vehiculos (id, codigo, placa, marca, modelo, anio, capacidad_toneladas, ejes, soat, rt, estado) VALUES
(1,  'V-01', 'ABC-123', 'Volvo',         'FH16 540',      2022, 30.00, 6, 'Vigente 2027', 'Aprobado 2026', 'En Ruta'),
(2,  'V-02', 'DEF-456', 'Scania',        'R500 Highline', 2021, 28.00, 6, 'Vigente 2026', 'Aprobado 2026', 'En Ruta'),
(3,  'V-03', 'GHI-789', 'Mercedes-Benz', 'Actros 2645',   2020, 25.00, 4, 'Vigente 2026', 'Pendiente',     'En Taller'),
(4,  'V-04', 'JKL-012', 'International', 'ProStar ES',    2019, 24.00, 4, 'Vigente 2025', 'Aprobado 2026', 'Disponible'),
(5,  'V-05', 'MNO-345', 'Volvo',         'FMX 460',       2023, 32.00, 6, 'Vigente 2027', 'Aprobado 2026', 'En Ruta'),
(6,  'V-06', 'PQR-678', 'Hino',          '500 Series GT', 2021, 18.00, 3, 'Vigente 2026', 'Aprobado 2026', 'Disponible'),
(7,  'V-07', 'STU-901', 'Scania',        'G410 XT',       2020, 26.00, 4, 'Vigente 2026', 'Aprobado 2026', 'En Ruta'),
(8,  'V-08', 'VWX-234', 'DAF',           'XF 480 Pure',   2022, 28.00, 6, 'Vigente 2027', 'Aprobado 2026', 'Disponible'),
(9,  'V-09', 'YZA-567', 'MAN',           'TGX 26.480',    2023, 30.00, 6, 'Vigente 2027', 'Aprobado 2026', 'Disponible'),
(10, 'V-10', 'BCD-890', 'Iveco',         'Stralis Hi-Way',2021, 22.00, 4, 'Vigente 2026', 'Pendiente',     'En Taller');

-- 7. Rutas Principales
INSERT IGNORE INTO rutas (id, codigo, origen, destino, distancia_km, duracion_estimada_min, estado) VALUES
(1, 'RUT-01', 'Base San Martín de Porres', 'Puerto del Callao (APM Terminals)', 38.50, 105, 'En Curso'),
(2, 'RUT-02', 'Base San Martín de Porres', 'Parque Industrial de Lurín',         52.00, 120, 'En Curso'),
(3, 'RUT-03', 'Base San Martín de Porres', 'Centro Logístico Chorrillos',        41.20, 100, 'En Curso'),
(4, 'RUT-04', 'Base San Martín de Porres', 'Mega Puerto de Chancay',             78.50, 150, 'En Curso'),
(5, 'RUT-05', 'Base San Martín de Porres', 'Almacenes Huachipa Este',            32.00, 75,  'Finalizada');

-- 8. Asignaciones Activas
INSERT IGNORE INTO asignaciones (id, codigo, vehiculo_id, conductor_id, ruta_id, fecha_inicio, estado, observaciones) VALUES
(1, 'ASG-01', 1, 1, 1, '2026-11-08 06:00:00', 'En Ruta',    'Transporte de contenedores refrigerados al puerto'),
(2, 'ASG-02', 2, 2, 2, '2026-11-08 06:30:00', 'En Ruta',    'Carga de bobinas de acero para planta industrial'),
(3, 'ASG-03', 5, 5, 4, '2026-11-08 07:00:00', 'En Ruta',    'Despacho de maquinaria pesada a Chancay'),
(4, 'ASG-04', 7, 7, 3, '2026-11-08 07:30:00', 'En Ruta',    'Carga consolidada para supermercados'),
(5, 'ASG-05', 4, 3, 5, '2026-11-07 08:00:00', 'Finalizada', 'Retorno a base sin novedades mecánicas');

-- 9. Historial de Viajes & Liquidaciones (Integración con el módulo refactorizado §16)
INSERT IGNORE INTO viajes_historial (
  id, codigo_viaje, fecha, vehiculo_id, placa, conductor_id, conductor_nombre,
  origen, destino, distancia_km, duracion, paradas, combustible_gal, costo_combustible,
  costo_peajes, viatico_conductor, bono_conductor, penalidad_conductor, neto_conductor,
  costo_operativo_total, flete_comercial, igv, detraccion_sunat, utilidad_neta,
  margen_porcentaje, estado
) VALUES
(1, 'R-101', '2026-11-04', 1, 'ABC-123', 1, 'Carlos Mendoza Quispe',
 'Base San Martín de Porres', 'Puerto del Callao (APM Terminals)', 38.50, '1h 45m', '2 paradas',
 4.96, 92.50, 52.00, 45.00, 50.00, 0.00, 95.00, 243.09, 352.48, 63.45, 16.64, 109.39, 31.03, 'Completado'),

(2, 'R-102', '2026-11-04', 2, 'DEF-456', 2, 'Marco Aurelio Ríos',
 'Base San Martín de Porres', 'Parque Industrial de Lurín', 52.00, '2h 10m', '1 parada',
 6.42, 119.73, 52.00, 85.00, 50.00, 0.00, 135.00, 311.34, 451.44, 81.26, 21.31, 140.10, 31.03, 'Completado'),

(3, 'R-103', '2026-11-03', 5, 'MNO-345', 5, 'Segundo Ramos Vega',
 'Base San Martín de Porres', 'Mega Puerto de Chancay', 78.50, '2h 45m', '3 paradas',
 11.20, 208.88, 52.00, 85.00, 50.00, 25.00, 110.00, 411.96, 597.34, 107.52, 28.19, 185.38, 31.03, 'Completado'),

(4, 'R-104', '2026-11-03', 4, 'JKL-012', 3, 'Jorge Luis Huamán',
 'Base San Martín de Porres', 'Almacenes Huachipa Este', 32.00, '1h 15m', '0 paradas',
 3.65, 68.07, 26.00, 45.00, 50.00, 0.00, 95.00, 191.91, 278.27, 50.09, 13.13, 86.36, 31.04, 'Completado'),

(5, 'R-105', '2026-11-02', 7, 'STU-901', 7, 'Raúl Espinoza Peña',
 'Base San Martín de Porres', 'Centro Logístico Chorrillos', 41.20, '1h 50m', '1 parada',
 5.10, 95.12, 52.00, 45.00, 50.00, 0.00, 95.00, 245.75, 356.34, 64.14, 16.82, 110.59, 31.04, 'Completado'),

(6, 'R-106', '2026-11-01', 6, 'PQR-678', 6, 'Andrés Tello Flores',
 'Base San Martín de Porres', 'Terminal Terrestre Plaza Norte', 18.00, '45m', '0 paradas',
 1.82, 33.94, 19.50, 45.00, 50.00, 0.00, 95.00, 150.67, 218.47, 39.32, 10.31, 67.80, 31.03, 'Completado');

-- 10. Fallas Mecánicas
INSERT IGNORE INTO fallas_mecanicas (id, codigo, vehiculo_id, conductor_id, tipo, descripcion, fecha_reporte, severidad, estado) VALUES
(1, 'FAL-01', 3,  3, 'Frenos Desgastados',     'Desgaste severo en pastillas de freno delanteras detectado en inspección.', '2026-11-02 10:15:00', 'Alta',    'Pendiente'),
(2, 'FAL-02', 10, 4, 'Falla de Inyección',     'Pérdida de potencia en pendientes y humo negro intermitente en aceleración.', '2026-11-05 14:30:00', 'Critica', 'Pendiente'),
(3, 'FAL-03', 4,  3, 'Sistema de Iluminación', 'Faro neblinero derecho inoperativo reemplazado en taller.', '2026-10-28 09:00:00', 'Baja',    'Resuelto');

-- 11. Alertas de Emergencia
INSERT IGNORE INTO alertas (id, codigo, vehiculo_id, conductor_id, tipo, mensaje, latitud, longitud, estado, creada_en) VALUES
(1, 'ALT-01', 2, 2, 'Panico',    'Alerta de pánico activada por conductor en Panamericana Norte Km 24.', -11.9214, -77.0658, 'Activa', '2026-11-08 08:45:00'),
(2, 'ALT-02', 3, 3, 'Averia',    'Unidad reportó sobrecalentamiento de motor en Av. Canta Callao.', -11.9680, -77.0980, 'Atendida', '2026-11-05 11:20:00');
