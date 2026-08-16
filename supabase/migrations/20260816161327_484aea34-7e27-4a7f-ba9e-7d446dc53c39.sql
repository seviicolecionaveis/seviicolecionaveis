-- 1. Coluna de estoque levado a eventos (bloqueado para venda no site)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS event_reserved integer NOT NULL DEFAULT 0;

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_event_reserved_nonneg;
ALTER TABLE public.cards
  ADD CONSTRAINT cards_event_reserved_nonneg CHECK (event_reserved >= 0);

-- 2. Trigger de histórico passa a gravar o motivo quando informado
CREATE OR REPLACE FUNCTION public.log_card_stock_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prev INTEGER;
  curr INTEGER;
  rsn TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    prev := 0;
    curr := COALESCE(NEW.stock, 0);
    IF curr = 0 THEN RETURN NEW; END IF;
  ELSE
    prev := COALESCE(OLD.stock, 0);
    curr := COALESCE(NEW.stock, 0);
    IF prev = curr THEN RETURN NEW; END IF;
  END IF;

  BEGIN
    rsn := NULLIF(current_setting('app.stock_change_reason', true), '');
  EXCEPTION WHEN OTHERS THEN
    rsn := NULL;
  END;

  INSERT INTO public.card_stock_changes (
    card_id, card_name, collection, card_number, finish, language, condition,
    previous_stock, new_stock, delta, reason, changed_by
  ) VALUES (
    NEW.id, NEW.name, NEW.collection, NEW.card_number, NEW.finish, NEW.language, NEW.condition,
    prev, curr, curr - prev, rsn, auth.uid()
  );
  RETURN NEW;
END;
$function$;

-- 3. Estoque disponível desconta o que está no evento
CREATE OR REPLACE FUNCTION public.available_stock(_card_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    0,
    COALESCE((SELECT stock - event_reserved FROM public.cards WHERE id = _card_id), 0)
    - COALESCE((
        SELECT SUM(quantity)::int
        FROM public.stock_reservations
        WHERE card_id = _card_id AND expires_at > now()
      ), 0)
  );
$function$;

-- 4. Aplicar baixas em lote (vendas feitas no evento)
CREATE OR REPLACE FUNCTION public.apply_event_stock_sales(_items jsonb, _reason text DEFAULT 'Venda em evento')
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  cid uuid;
  qty integer;
  applied integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.stock_change_reason', COALESCE(NULLIF(_reason, ''), 'Venda em evento'), true);

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    cid := (it->>'card_id')::uuid;
    qty := GREATEST(COALESCE((it->>'quantity')::int, 0), 0);
    IF qty = 0 THEN CONTINUE; END IF;

    UPDATE public.cards
      SET stock = GREATEST(stock - qty, 0),
          event_reserved = GREATEST(LEAST(event_reserved, stock) - qty, 0)
      WHERE id = cid;

    IF FOUND THEN applied := applied + 1; END IF;
  END LOOP;

  PERFORM set_config('app.stock_change_reason', '', true);
  RETURN applied;
END;
$function$;

-- 5. Definir quanto de cada carta está fisicamente no evento
CREATE OR REPLACE FUNCTION public.set_event_reserved(_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  cid uuid;
  qty integer;
  applied integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    cid := (it->>'card_id')::uuid;
    qty := GREATEST(COALESCE((it->>'quantity')::int, 0), 0);

    UPDATE public.cards
      SET event_reserved = LEAST(qty, stock)
      WHERE id = cid;

    IF FOUND THEN applied := applied + 1; END IF;
  END LOOP;

  RETURN applied;
END;
$function$;

-- 6. Encerrar evento: devolve tudo que sobrou para o site
CREATE OR REPLACE FUNCTION public.clear_event_reserved()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.cards SET event_reserved = 0 WHERE event_reserved <> 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_event_stock_sales(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_reserved(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_event_reserved() TO authenticated;