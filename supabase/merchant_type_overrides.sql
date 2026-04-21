-- Overrides de merchant_type: cuando el usuario corrige el tipo asignado por Claude
-- se guarda acá para que futuros consumos del mismo merchant se auto-clasifiquen bien

CREATE TABLE IF NOT EXISTS public.merchant_type_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  merchant text NOT NULL,
  merchant_type text NOT NULL,
  is_essential boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, merchant)
);

CREATE INDEX IF NOT EXISTS merchant_overrides_user_merchant_idx
  ON public.merchant_type_overrides(user_id, merchant);
