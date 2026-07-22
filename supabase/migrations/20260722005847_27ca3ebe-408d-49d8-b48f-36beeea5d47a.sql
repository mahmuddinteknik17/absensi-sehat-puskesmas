
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'pegawai');
CREATE TYPE public.attendance_status AS ENUM ('hadir', 'terlambat', 'tidak_hadir', 'libur', 'izin', 'sakit');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nip TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  jabatan TEXT,
  unit_kerja TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Policies profiles
CREATE POLICY "profiles read self or admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles update self or admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policies user_roles
CREATE POLICY "user_roles read self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- settings (single row)
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1,
  nama_instansi TEXT NOT NULL DEFAULT 'UPT Puskesmas Pasar Sabtu',
  alamat TEXT DEFAULT 'Pasar Sabtu',
  office_lat DOUBLE PRECISION NOT NULL DEFAULT -2.2136,
  office_lng DOUBLE PRECISION NOT NULL DEFAULT 115.2483,
  radius_meter INTEGER NOT NULL DEFAULT 100,
  jam_buka TIME NOT NULL DEFAULT '07:00',
  jam_tutup TIME NOT NULL DEFAULT '07:30',
  batas_terlambat TIME NOT NULL DEFAULT '07:10',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read all auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings update admin" ON public.settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.settings (id) VALUES (1);

-- holidays
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holidays read all auth" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays write admin" ON public.holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  jam TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.attendance_status NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  akurasi DOUBLE PRECISION,
  jarak_meter DOUBLE PRECISION,
  perangkat TEXT,
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tanggal)
);
CREATE INDEX attendance_tanggal_idx ON public.attendance(tanggal);
CREATE INDEX attendance_user_tanggal_idx ON public.attendance(user_id, tanggal DESC);
GRANT SELECT, INSERT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance read self or admin" ON public.attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "attendance insert self" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
