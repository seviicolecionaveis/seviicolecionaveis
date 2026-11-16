CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.accessories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text,price_cents integer DEFAULT 0,stock integer DEFAULT 0,images text[] DEFAULT '{}',active boolean DEFAULT true,variants jsonb DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stock_decremented boolean DEFAULT false);
CREATE TABLE public.order_items(id uuid DEFAULT gen_random_uuid(),order_id uuid REFERENCES orders(id) ON DELETE CASCADE,card_id text,quantity integer,cancelled_quantity integer DEFAULT 0);
CREATE TABLE public.product_stock_changes(id bigint GENERATED ALWAYS AS IDENTITY,product_table text,product_id uuid,title text,previous_stock integer,new_stock integer,delta integer,changed_at timestamptz DEFAULT now(),changed_by uuid);
