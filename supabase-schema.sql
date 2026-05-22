-- =============================================
-- APPQUILER — Schema de base de datos Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================

-- Habilitar RLS (Row Level Security)
-- Cada usuario solo ve sus propios datos

-- 1. Inquilinos (locales y deptos argentinos)
CREATE TABLE inquilinos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  modulo TEXT NOT NULL CHECK (modulo IN ('locales', 'deptos')),
  nombre TEXT NOT NULL,
  cuit TEXT NOT NULL,
  direccion TEXT NOT NULL,
  rubro TEXT,
  piso TEXT,
  inicio DATE NOT NULL,
  anos INTEGER,
  vencimiento TEXT,
  periodo INTEGER NOT NULL DEFAULT 3,
  modalidad_ipc TEXT NOT NULL DEFAULT 'esperar' CHECK (modalidad_ipc IN ('esperar', 'previo')),
  blanco NUMERIC NOT NULL,
  blanco_actual NUMERIC NOT NULL,
  tiene_iva BOOLEAN DEFAULT FALSE,
  negro NUMERIC DEFAULT 0,
  negro_actual NUMERIC DEFAULT 0,
  diasmora INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inquilinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own inquilinos" ON inquilinos FOR ALL USING (auth.uid() = user_id);

-- 2. Inquilinos Uruguay
CREATE TABLE inquilinos_uy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  documento TEXT,
  direccion TEXT NOT NULL,
  tipo TEXT DEFAULT 'Apartamento',
  inicio DATE NOT NULL,
  anos INTEGER,
  vencimiento TEXT,
  usd NUMERIC NOT NULL,
  diasmora INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inquilinos_uy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own inquilinos_uy" ON inquilinos_uy FOR ALL USING (auth.uid() = user_id);

-- 3. Pagos en negro
CREATE TABLE pagos_negro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inquilino_id UUID REFERENCES inquilinos(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  monto NUMERIC NOT NULL,
  comprobante_url TEXT,
  comprobante_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pagos_negro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own pagos via inquilino" ON pagos_negro FOR ALL
  USING (inquilino_id IN (SELECT id FROM inquilinos WHERE user_id = auth.uid()));

-- 4. Historial de actualizaciones IPC por inquilino
CREATE TABLE actualizaciones_ipc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inquilino_id UUID REFERENCES inquilinos(id) ON DELETE CASCADE NOT NULL,
  periodo TEXT NOT NULL,
  ipc NUMERIC NOT NULL,
  blanco_nuevo NUMERIC NOT NULL,
  negro_nuevo NUMERIC DEFAULT 0,
  fecha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE actualizaciones_ipc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own actualizaciones via inquilino" ON actualizaciones_ipc FOR ALL
  USING (inquilino_id IN (SELECT id FROM inquilinos WHERE user_id = auth.uid()));

-- 5. Registros IPC cargados manualmente
CREATE TABLE registros_ipc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mes TEXT NOT NULL,  -- formato YYYY-MM
  valor NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, mes)
);

ALTER TABLE registros_ipc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own registros_ipc" ON registros_ipc FOR ALL USING (auth.uid() = user_id);

-- 6. Storage bucket para comprobantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false);

CREATE POLICY "Users upload own comprobantes" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own comprobantes" ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Función para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inquilinos_updated_at BEFORE UPDATE ON inquilinos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
