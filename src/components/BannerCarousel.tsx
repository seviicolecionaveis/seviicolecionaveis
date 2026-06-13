import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Banner = {
  id: string;
  image_url: string;
  link_url: string | null;
  alt: string | null;
};

export function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [index, setIndex] = useState(0);
  const [interactionAt, setInteractionAt] = useState(0);

  useEffect(() => {
    supabase
      .from("banners")
      .select("id,image_url,link_url,alt")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setBanners(data ?? []));
  }, []);

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const delay = interactionAt ? 7000 : 5000;
    const id = setTimeout(() => {
      setIndex((i) => (i + 1) % banners.length);
      setInteractionAt(0);
    }, delay);
    return () => clearTimeout(id);
  }, [banners, index, interactionAt]);

  // Reservar o espaço imediatamente para evitar layout shift (CLS) durante o carregamento
  if (banners && banners.length === 0) return null;

  const current = banners?.[index] ?? null;

  const go = (next: number) => {
    if (!banners) return;
    setIndex((next + banners.length) % banners.length);
    setInteractionAt(Date.now());
  };

  const Img = current ? (
    <img
      src={current.image_url}
      alt={current.alt ?? ""}
      className="h-full w-full object-cover transition-opacity duration-500"
      fetchPriority="high"
      decoding="async"
      key={current.id}
    />
  ) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6">
      <div className="relative aspect-[16/5] w-full overflow-hidden rounded-2xl bg-secondary group">
        {current?.link_url ? (
          <a href={current.link_url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            {Img}
          </a>
        ) : (
          Img
        )}

        {banners && banners.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              aria-label="Banner anterior"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/25 text-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-black/45 transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(index + 1)}
              aria-label="Próximo banner"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 grid place-items-center h-9 w-9 rounded-full bg-black/25 text-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-black/45 transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                  }`}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
