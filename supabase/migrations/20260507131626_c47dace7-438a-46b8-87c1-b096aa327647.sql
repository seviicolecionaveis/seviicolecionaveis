
INSERT INTO storage.buckets (id, name, public) VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Card images publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'card-images');

CREATE POLICY "Admins upload card images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update card images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete card images"
ON storage.objects FOR DELETE
USING (bucket_id = 'card-images' AND public.has_role(auth.uid(), 'admin'));
