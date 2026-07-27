CREATE TABLE public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO authenticated;
GRANT ALL ON public.leaves TO service_role;

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaves read all auth" ON public.leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "leaves insert self" ON public.leaves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "leaves update self" ON public.leaves FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "leaves delete self" ON public.leaves FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX leaves_user_id_idx ON public.leaves (user_id);
CREATE INDEX leaves_range_idx ON public.leaves (tanggal_mulai, tanggal_selesai);

CREATE OR REPLACE FUNCTION public.validate_leave_range()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tanggal_selesai < NEW.tanggal_mulai THEN
    RAISE EXCEPTION 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leaves_validate
BEFORE INSERT OR UPDATE ON public.leaves
FOR EACH ROW EXECUTE FUNCTION public.validate_leave_range();