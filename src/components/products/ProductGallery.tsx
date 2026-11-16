import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    setIdx(0);
    setZoom(false);
  }, [images.join("|")]);
  const image = images[idx];
  const step = (n: number) => {
    setIdx((i) => (i + n + images.length) % images.length);
    setZoom(false);
  };
  return (
    <div>
      <Button
        variant="ghost"
        aria-label="Ampliar imagem"
        disabled={!image}
        onClick={() => setOpen(true)}
        className="relative block h-auto aspect-square w-full overflow-hidden rounded-lg bg-secondary p-0"
      >
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Package className="h-16 w-16" />
          </div>
        )}
        <ZoomIn className="absolute right-3 top-3" />
      </Button>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((url, i) => (
            <Button
              key={url + i}
              variant="outline"
              aria-label={`Ver imagem ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-16 w-16 shrink-0 p-0 ${i === idx ? "border-primary" : ""}`}
            >
              <img src={url} alt="" className="h-full w-full object-contain" />
            </Button>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogTitle className="pr-6 text-sm">{title}</DialogTitle>
          <div className="relative flex h-[70vh] items-center justify-center overflow-auto">
            {image && (
              <img
                src={image}
                alt={title}
                onClick={() => setZoom((z) => !z)}
                className={
                  zoom
                    ? "max-w-none cursor-zoom-out"
                    : "max-h-full max-w-full cursor-zoom-in object-contain"
                }
              />
            )}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Imagem anterior"
                  onClick={() => step(-1)}
                  className="absolute left-2 top-1/2"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Próxima imagem"
                  onClick={() => step(1)}
                  className="absolute right-2 top-1/2"
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
