
CREATE OR REPLACE FUNCTION public.track_card_base_price_drop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.base_price_cents IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.base_price_cents IS NOT NULL
     AND NEW.base_price_cents < OLD.base_price_cents THEN
    INSERT INTO public.card_price_watch
      (card_id, last_min_price_cents, previous_min_price_cents, price_dropped_at, updated_at)
    VALUES
      (NEW.id, NEW.base_price_cents, OLD.base_price_cents, now(), now())
    ON CONFLICT (card_id) DO UPDATE
      SET previous_min_price_cents = EXCLUDED.previous_min_price_cents,
          last_min_price_cents = EXCLUDED.last_min_price_cents,
          price_dropped_at = EXCLUDED.price_dropped_at,
          updated_at = now();
  ELSE
    INSERT INTO public.card_price_watch (card_id, last_min_price_cents, updated_at)
    VALUES (NEW.id, NEW.base_price_cents, now())
    ON CONFLICT (card_id) DO UPDATE
      SET last_min_price_cents = EXCLUDED.last_min_price_cents,
          updated_at = now()
      WHERE public.card_price_watch.price_dropped_at IS NULL
         OR public.card_price_watch.last_min_price_cents > EXCLUDED.last_min_price_cents;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_card_base_price_drop ON public.cards;
CREATE TRIGGER trg_track_card_base_price_drop
AFTER INSERT OR UPDATE OF base_price_cents ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.track_card_base_price_drop();
