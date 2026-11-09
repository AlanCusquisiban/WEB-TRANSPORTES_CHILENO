<?php
/**
 * API REST PHP para persistencia MySQL - Transportes Chileno E.I.R.L.
 * Permite ejecutar la aplicación directamente con XAMPP (Apache o php -S localhost:3000)
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$host = 'localhost';
$port = 3306;
$user = 'root';
$pass = '';
$db   = 'transportes_chileno';

try {
    $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;");
    $pdo->exec("USE `$db`;");
} catch (Exception $e) {
    echo json_encode([
        'ok' => false,
        'connected' => false,
        'mode' => 'offline_fallback',
        'error' => $e->getMessage()
    ]);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

if (strpos($uri, '/api/health') !== false) {
    $stmt = $pdo->query("SELECT COUNT(*) AS total FROM vehiculos");
    $vehCount = $stmt->fetch()['total'] ?? 0;
    echo json_encode(['ok' => true, 'connected' => true, 'database' => $db, 'vehiculos' => $vehCount]);
    exit;
}

if (strpos($uri, '/api/bootstrap') !== false) {
    $vehicles = $pdo->query("SELECT codigo AS id, placa, marca, modelo, anio, capacidad_toneladas AS capacidad, ejes, soat, rt, estado FROM vehiculos ORDER BY id ASC")->fetchAll();
    $drivers = $pdo->query("SELECT c.codigo AS id, CONCAT(c.nombres, ' ', c.apellidos) AS nombre, COALESCE(l.numero, 'Q-12345678') AS licencia, c.telefono, c.password_acceso AS password, c.estado FROM conductores c LEFT JOIN licencias l ON c.licencia_id = l.id ORDER BY c.id ASC")->fetchAll();
    $assignments = $pdo->query("SELECT a.codigo AS id, v.codigo AS vehiculoId, v.placa, c.codigo AS conductorId, CONCAT(c.nombres, ' ', c.apellidos) AS conductor, a.fecha_inicio AS fechaInicio, a.fecha_fin AS fechaFin, a.estado, a.observaciones FROM asignaciones a JOIN vehiculos v ON a.vehiculo_id = v.id JOIN conductores c ON a.conductor_id = c.id ORDER BY a.id ASC")->fetchAll();
    $journeyHistory = $pdo->query("SELECT codigo_viaje AS id, fecha, conductor_nombre AS conductor, placa, origen, destino, duracion, paradas, distancia_km AS km, combustible_gal AS combustibleGals, costo_combustible AS costoCombustible, costo_peajes AS costoPeajes, viatico_conductor AS viaticoConductor, costo_operativo_total AS costoOperativoTotal, flete_comercial AS fleteComercial, utilidad_neta AS utilidadNeta, margen_porcentaje AS margenPorcentaje, estado FROM viajes_historial ORDER BY fecha DESC, id DESC")->fetchAll();
    $faults = $pdo->query("SELECT f.codigo AS id, v.codigo AS vehiculoId, v.placa, f.tipo, f.descripcion, f.fecha_reporte AS fecha, CASE WHEN f.estado IN ('Resuelto', 'Resuelta') THEN 'Resuelto' ELSE 'Pendiente' END AS estado FROM fallas_mecanicas f JOIN vehiculos v ON f.vehiculo_id = v.id ORDER BY f.id DESC")->fetchAll();
    $alerts = $pdo->query("SELECT a.codigo AS id, a.tipo, v.placa AS vehiculo, v.codigo AS vehiculoId, COALESCE(CONCAT(c.nombres, ' ', c.apellidos), 'No asignado') AS conductor, a.mensaje, DATE_FORMAT(a.creada_en, '%h:%i %p') AS hora, DATE(a.creada_en) AS fecha, CASE WHEN a.estado = 'Activa' THEN 'Activa' ELSE 'Resuelta' END AS estado, a.latitud AS lat, a.longitud AS lng FROM alertas a JOIN vehiculos v ON a.vehiculo_id = v.id LEFT JOIN conductores c ON a.conductor_id = c.id ORDER BY a.id DESC")->fetchAll();

    $confStmt = $pdo->query("SELECT clave, valor FROM configuracion_sistema WHERE clave IN ('admin_user', 'admin_pass')");
    $adminConfig = ['user' => 'admin', 'pass' => 'admin'];
    while ($row = $confStmt->fetch()) {
        if ($row['clave'] === 'admin_user') $adminConfig['user'] = $row['valor'];
        if ($row['clave'] === 'admin_pass') $adminConfig['pass'] = $row['valor'];
    }

    echo json_encode([
        'ok' => true,
        'vehicles' => $vehicles,
        'drivers' => $drivers,
        'assignments' => $assignments,
        'journeyHistory' => $journeyHistory,
        'mechanicalFaults' => $faults,
        'alerts' => $alerts,
        'adminCredentials' => $adminConfig
    ]);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'API PHP activa']);
