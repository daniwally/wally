-- Categorías personalizadas del usuario (extienden los 37 built-in)
-- El extractor las suma al enum del tool dinámicamente
-- y Claude puede clasificar un consumo en una categoría custom si matchea

CREATE TABLE IF NOT EXISTS public.custom_merchant_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  icon text,
  description text,
  is_essential boolean,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS custom_merchant_types_user_idx
  ON public.custom_merchant_types(user_id);
