-- Tabla para guardar los items individuales de cada resumen de tarjeta

CREATE TABLE IF NOT EXISTS public.statement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  merchant text NOT NULL,
  merchant_raw text,
  amount_cents bigint NOT NULL,
  currency text DEFAULT 'ARS',
  purchase_date date,
  cuota_numero int,
  cuota_total int,
  category_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS statement_items_expense_idx ON public.statement_items(expense_id);
CREATE INDEX IF NOT EXISTS statement_items_merchant_idx ON public.statement_items(merchant);
CREATE INDEX IF NOT EXISTS statement_items_user_date_idx ON public.statement_items(user_id, purchase_date);
