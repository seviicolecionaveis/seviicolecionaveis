DROP POLICY "Anyone can view active banners" ON public.banners;
CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (active = true);