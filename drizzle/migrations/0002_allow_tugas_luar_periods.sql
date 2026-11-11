ALTER TABLE public.leaves DROP CONSTRAINT leaves_jenis_check;
ALTER TABLE public.leaves ADD CONSTRAINT leaves_jenis_check CHECK (jenis IN ('cuti', 'sakit', 'tugas_luar'));
COMMENT ON COLUMN public.leaves.jenis IS 'Jenis periode ketidakhadiran: cuti, sakit, atau tugas_luar';