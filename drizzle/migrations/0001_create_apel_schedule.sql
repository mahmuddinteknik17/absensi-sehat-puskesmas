CREATE TABLE public.apel_schedule (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_path text NOT NULL,
  file_name text NOT NULL,
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apel_schedule TO authenticated;
GRANT ALL ON public.apel_schedule TO service_role;
ALTER TABLE public.apel_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view apel schedule"
  ON public.apel_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage apel schedule"
  ON public.apel_schedule FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Authenticated users can view apel schedule image"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'jadwal-apel');
CREATE POLICY "Admins can upload apel schedule image"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'jadwal-apel' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update apel schedule image"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'jadwal-apel' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'jadwal-apel' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete apel schedule image"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'jadwal-apel' AND public.has_role(auth.uid(), 'admin'::public.app_role));