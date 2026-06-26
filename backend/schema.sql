-- 1. Habilitar extensión PostGIS para operaciones geoespaciales
CREATE EXTENSION IF NOT EXISTS postgis;

-- Eliminar tablas antiguas si existen para evitar errores al reejecutar el script
DROP TABLE IF EXISTS eventos_delictuales_mock CASCADE;
DROP TABLE IF EXISTS cuadrantes_mock CASCADE;

-- 2. Crear tabla de eventos delictuales (Ingesta Geoespacial)
CREATE TABLE eventos_delictuales_mock (
    id SERIAL PRIMARY KEY,
    tipo_delito VARCHAR(100),
    coordenada GEOMETRY(Point, 4326),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Crear tabla de cuadrantes de patrullaje (Geocercas)
CREATE TABLE cuadrantes_mock (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50),
    poligono GEOMETRY(Polygon, 4326)
);

-- 4. Insertar el polígono táctico (Cuadrante de prueba en el Centro de Viña del Mar)
INSERT INTO cuadrantes_mock (codigo, poligono) 
VALUES (
    'CUADRANTE-VINA-CENTRO',
    ST_GeomFromText('POLYGON((-71.555 -33.015, -71.545 -33.015, -71.545 -33.025, -71.555 -33.025, -71.555 -33.015))', 4326)
);

-- 5. Generar puntos estáticos y separados por más de 400m
TRUNCATE TABLE eventos_delictuales_mock RESTART IDENTITY;

INSERT INTO eventos_delictuales_mock (tipo_delito, coordenada) VALUES
('Robo con violencia', ST_SetSRID(ST_MakePoint(-71.550, -33.020), 4326)),
('Robo en lugar habitado', ST_SetSRID(ST_MakePoint(-71.556, -33.012), 4326)),
('Hurto', ST_SetSRID(ST_MakePoint(-71.542, -33.026), 4326)),
('Robo de vehículo', ST_SetSRID(ST_MakePoint(-71.560, -33.029), 4326)),
('Robo con violencia', ST_SetSRID(ST_MakePoint(-71.545, -33.015), 4326)),
('Robo en lugar habitado', ST_SetSRID(ST_MakePoint(-71.565, -33.035), 4326)),
('Hurto', ST_SetSRID(ST_MakePoint(-71.538, -33.020), 4326)),
('Robo de vehículo', ST_SetSRID(ST_MakePoint(-71.552, -33.008), 4326));
