import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Banner = {
  id: string;
  image_url: string;
  link_url: string | null;
  alt: string | null;
};

export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    supabase
      .from("banners")
      .select("id,image_url,link_url,alt")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setBanners(data ?? []));
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, 10000);
    return () => clearInterval(id);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const current = banners[index];

  const Img = (
    <img
      src={current.image_url}
      alt={current.alt ?? ""}
      className="h-full w-full object-cover transition-opacity duration-500"
      key={current.id}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
      <div className="relative aspect-[16/5] w-full overflow-hidden rounded-2xl bg-secondary">
        {current.link_url ? (
          <a href={current.link_url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            {Img}
          </a>
        ) : (
          Img
        )}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
