-- 1. Table: sucursales
CREATE TABLE IF NOT EXISTS sucursales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default sucursal
INSERT INTO sucursales (name, address) VALUES ('Casa Central', 'Av. Principal 123');

-- 2. Table: productos
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table: proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact TEXT,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table: ventas
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    method TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE
);

-- 5. Table: detalle_ventas
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venta_id UUID REFERENCES ventas(id) ON DELETE CASCADE,
    product_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL
);

-- 6. Table: compras
CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supplier_id UUID REFERENCES proveedores(id),
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE
);

-- 7. Table: detalle_compras
CREATE TABLE IF NOT EXISTS detalle_compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    compra_id UUID REFERENCES compras(id) ON DELETE CASCADE,
    product_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 1,
    cost DECIMAL(12,2) NOT NULL
);

-- 8. Table: caja_movimientos
CREATE TABLE IF NOT EXISTS caja_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- Ingreso, Egreso
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT,
    user_id UUID REFERENCES auth.users(id),
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Table: configuracion
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE
);

-- 10. Table: metodos_pago
CREATE TABLE IF NOT EXISTS metodos_pago (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    discount DECIMAL(5,2) DEFAULT 0,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE
);

-- 11. Table: promociones
CREATE TABLE IF NOT EXISTS promociones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL,
    take INTEGER NOT NULL,
    pay INTEGER NOT NULL,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE CASCADE
);

-- 12. Enable RLS on all tables
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones ENABLE ROW LEVEL SECURITY;

-- 13. Create basic policies (Allow all for authenticated users)
CREATE POLICY "Allow all for authenticated" ON sucursales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON productos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON proveedores FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON ventas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON detalle_ventas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON compras FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON detalle_compras FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON caja_movimientos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON configuracion FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON metodos_pago FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON promociones FOR ALL USING (auth.role() = 'authenticated');
