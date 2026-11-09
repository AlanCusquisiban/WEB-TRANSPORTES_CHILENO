# Transportes Chileno E.I.R.L. - Sistema de Monitoreo de Flota Vehicular

Sistema web operativo para la gestion, rastreo GPS en tiempo real y control de la flota vehicular de Transportes Chileno E.I.R.L. con roles de acceso diferenciados (Administrador / Conductor) y generacion de reportes.

---

## Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Inicio Rapido](#inicio-rapido)
3. [Acceso al Sistema Login](#acceso-al-sistema-login)
4. [Panel de Administrador](#panel-de-administrador)
5. [Panel de Conductor](#panel-de-conductor)
6. [Accesibilidad](#accesibilidad-wcag-21-aa)
7. [Estructura de Archivos](#estructura-de-archivos)
8. [Tecnologias Utilizadas](#tecnologias-utilizadas)

---

## Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- Conexion a internet (para fuentes Google y mapa Leaflet/OpenStreetMap)
- Servidor HTTP local (opcional, recomendado)

---

## Inicio Rapido

### Opcion A - Abrir directamente
Haz doble clic en `index.html` y abrelo en tu navegador.

### Opcion B - Servidor Python (recomendado)

```bash
python -m http.server 8085
# Luego visita: http://localhost:8085
```

### Opcion C - VS Code Live Server
Instala la extension **Live Server**, haz clic derecho en `index.html` y selecciona **Open with Live Server**.

---

## Acceso al Sistema Login

![Pantalla de Login](assets/screenshots/login.jpg)

| Rol | Usuario | Contrasena |
|-----|---------|------------|
| **Administrador** | `admin` | `admin` |
| **Conductor** | nombre del conductor | `1234` |
| **Conductor (alternativo)** | placa del vehiculo | `1234` |

> Las credenciales de conductores se gestionan desde el modulo **Credenciales** en el panel de administrador.

---

## Panel de Administrador

### 1. Dashboard

Vista general del estado operativo de la flota en tiempo real.

![Dashboard](assets/screenshots/dashboard.jpg)

**Funcionalidades:**
- KPIs: Total vehiculos, En Ruta, En Descanso, Averia, Alertas activas
- Grafica de viajes diarios
- Vista previa del mapa GPS con posiciones actuales

---

### 2. Rastreo GPS Live

Mapa interactivo de alta disponibilidad (Leaflet + OpenStreetMap) con respaldo de Radar Vectorial Táctico Autónomo sobre HTML5 Canvas (100% funcional offline o sin tokens de API).

![Rastreo GPS](assets/screenshots/gps.jpg)

**Funcionalidades:**
- Marcadores diferenciados por estado (En Ruta / Disponible / Averia)
- Capa OpenStreetMap estándar libre de restricciones de tokens o cuotas
- Modo de respaldo autónomo por radar táctico si falla la conexión externa o la librería CDN
- Botón para alternar vistas de mapa satelital / radar vectorial táctico
- Filtro interactivo de vehículos en mapa por estado
- Panel lateral con lista en vivo de unidades, telemetría y coordenadas
- Actualizacion automatica de posiciones y velocidades por simulador GPS
- Clic en vehiculo del mapa o de la lista centra y abre el inspector de la unidad

---

### 3. Flota Vehicular

CRUD completo del catalogo de vehiculos.

![Flota Vehicular](assets/screenshots/fleet.jpg)

**Funcionalidades:**
- Registrar vehiculo: Placa, Marca, Modelo, Anio, Capacidad (toneladas)
- Tabla de vehiculos con columnas: Placa, Marca, Modelo, Anio, Capacidad, Estado, Acciones
- Editar vehiculo con modal precargado
- Eliminar vehiculo con confirmacion
- Validacion de formato de placa y duplicados

---

### 4. Asignaciones

Gestion de la relacion conductor - vehiculo - ruta.

**Funcionalidades:**
- Crear asignacion: Conductor + Vehiculo + Fecha/Hora inicio
- Tabla de asignaciones activas e historicas
- Editar y eliminar asignaciones
- Vinculacion directa con conductores y vehiculos registrados

---

### 5. Historial de Rutas & Liquidación

Trazabilidad completa de todos los recorridos realizados y módulo de auditoría de costos.

**Funcionalidades:**
- Filtro por rango de fechas (Desde / Hasta)
- Busqueda por placa o conductor
- Tabla: Fecha, Conductor, Vehiculo, Origen, Destino, Duracion, Paradas y accion "Ver Ruta en Mapa"
- **Modulo de Liquidacion & Auditoria de Viajes**: Calculo de consumo de combustible diesel, peajes por ejes vehiculares, viaticos y bonificaciones/penalidades al conductor.
- **Guia Academica de Refactorizacion**: Documento completo `GUIA_REFACTORIZACION.txt` con casos de prueba, malos olores detectados (Code Smells) y codigo modelo refactorizado.

---

### 6. Fallas Mecanicas

Registro y seguimiento de incidencias mecanicas.

**Funcionalidades:**
- Registrar falla: Vehiculo, Tipo de falla, Descripcion, Fecha
- Actualizar estado: Pendiente / Resuelto
- Historial completo de fallas por vehiculo

---

### 7. Alertas

Centro de notificaciones y alertas criticas del sistema.

**Funcionalidades:**
- Alertas de Panico registradas cuando un conductor activa la emergencia
- Alertas automaticas de vehiculos en Averia
- Badge contador de alertas activas visible en la navegacion
- Marcar alertas como resueltas

---

### 8. Reportes

Generacion de reportes exportables en multiples formatos.

![Reportes](assets/screenshots/reports.jpg)

| Reporte | Formatos disponibles |
|---------|---------------------|
| Flota Vehicular | Excel (.xlsx) + PDF/Imprimir |
| Asignaciones | Excel (.xlsx) + PDF/Imprimir |
| Historial de Rutas | Excel (.xlsx) + PDF/Imprimir |
| Fallas Mecanicas | Excel (.xlsx) + PDF/Imprimir |

> Los archivos Excel se generan usando **SheetJS** con nombre `Reporte_{Tipo}_{DDMMAAAA}.xlsx`.

---

### 9. Credenciales

Gestion de acceso y contrasenias del sistema.

![Credenciales](assets/screenshots/credentials.jpg)

**Funcionalidades:**
- Cambiar usuario y contrasenia del Administrador
- Ver, editar y restablecer credenciales de cada conductor
- Contrasenia por defecto de conductores: `1234`
- Confirmacion requerida para guardar cambios

---

## Panel de Conductor

Vista simplificada y optimizada para uso movil en ruta.

![Panel Conductor](assets/screenshots/driver_panel.jpg)

**Funcionalidades:**
- Muestra nombre del conductor y placa del vehiculo asignado
- Botones de estado de gran tamano tactil:
  - En Ruta (verde)
  - En Descanso (amarillo)
  - Averia (rojo)
- **Boton de Panico**: envia alerta inmediata con GPS al administrador
- Coordenadas GPS del dispositivo en tiempo real

---

## Accesibilidad WCAG 2.1 AA

| Control | Descripcion |
|---------|-------------|
| Modo Oscuro | Tema oscuro (predeterminado) |
| Modo Claro | Mejor lectura en ambientes iluminados |
| Alto Contraste | Para usuarios con baja vision |
| A / A+ / A++ | Tres tamanos de fuente disponibles |
| Teclado | Todos los controles accesibles via Tab/Enter/Espacio |
| ARIA Live Regions | Anuncios de cambios para lectores de pantalla |
| Skip Link | Enlace para saltar directamente al contenido principal |

---

## Estructura de Archivos

```
transportes-chileno-web/
|-- index.html         (HTML principal de la aplicacion)
|-- styles.css         (Sistema de diseno y estilos - WCAG 2.1 AA)
|-- script.js          (Logica de la aplicacion en vanilla JavaScript)
|-- README.md          (Esta documentacion)
|-- assets/
    |-- hero.jpg       (Imagen banner)
    |-- screenshots/
        |-- login.jpg
        |-- dashboard.jpg
        |-- gps.jpg
        |-- fleet.jpg
        |-- driver_panel.jpg
        |-- reports.jpg
        |-- credentials.jpg
```

---

## Tecnologias Utilizadas

| Tecnologia | Version | Uso |
|-----------|---------|-----|
| HTML5 | - | Estructura semantica y accesibilidad |
| CSS3 | - | Diseno responsivo, variables CSS, glassmorphism |
| JavaScript ES6+ | - | Logica de negocio, CRUD, gestion de estado |
| Leaflet.js | 1.9.4 | Mapa GPS interactivo (OpenStreetMap) |
| SheetJS (xlsx.js) | CDN | Generacion de reportes Excel |
| Google Fonts | - | Outfit, Plus Jakarta Sans, JetBrains Mono |

---

## Estructura de Roles

```
Sistema de Autenticacion
|
|-- Administrador (admin / admin)
|   |-- Dashboard con KPIs en tiempo real
|   |-- Rastreo GPS Live
|   |-- Gestion de Flota Vehicular (CRUD)
|   |-- Asignaciones Conductor-Vehiculo
|   |-- Historial de Rutas
|   |-- Fallas Mecanicas
|   |-- Centro de Alertas y Panico
|   |-- Generacion de Reportes (Excel + PDF)
|   |-- Gestion de Credenciales del sistema
|
|-- Conductor (nombre o placa / 1234)
    |-- Ver asignacion activa actual
    |-- Actualizar estado del vehiculo
    |-- Activar Alerta de Panico con GPS
```

---

*Sistema desarrollado para Transportes Chileno E.I.R.L. - San Martin de Porres, Lima, Peru*
