ALTER TABLE public.leaves ADD COLUMN jenis text NOT NULL DEFAULT 'cuti';
ALTER TABLE public.leaves ADD CONSTRAINT leaves_jenis_check CHECK (jenis IN ('cuti','sakit'));
COMMENT ON COLUMN public.leaves.jenis IS 'Jenis pencatatan hari: cuti (default) atau sakit';