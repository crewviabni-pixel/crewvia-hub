INSERT INTO storage.buckets (id, name, public) VALUES ('work_files', 'work_files', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Admins can manage work_files" ON storage.objects FOR ALL TO authenticated USING (
  bucket_id = 'work_files' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Designers can read work_files" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'work_files' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);

CREATE POLICY "Designers can upload work_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'work_files' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);
