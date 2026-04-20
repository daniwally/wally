-- Wally Gastos — seed data (Abril 2026)
-- Ejecutar DESPUÉS de schema.sql

-- Usuario fijo para MVP (antes de auth)
insert into public.users (id, email, telegram_chat_id)
values ('00000000-0000-0000-0000-000000000001', 'wally@wtf-agency.com', null)
on conflict (email) do nothing;

-- Categorías
insert into public.categories (id, user_id, label, icon, color, soft_color, sort_order) values
  ('servicios','00000000-0000-0000-0000-000000000001','Servicios','⚡','var(--blue)','var(--blue-soft)',1),
  ('tarjeta','00000000-0000-0000-0000-000000000001','Tarjeta','💳','var(--red)','var(--red-soft)',2),
  ('expensas','00000000-0000-0000-0000-000000000001','Expensas','🏢','var(--orange)','var(--orange-soft)',3),
  ('impuestos','00000000-0000-0000-0000-000000000001','Impuestos','📋','var(--purple)','var(--purple-soft)',4),
  ('compras','00000000-0000-0000-0000-000000000001','Compras','📦','var(--pink)','var(--pink-soft)',5),
  ('suscrip','00000000-0000-0000-0000-000000000001','Suscrip.','🎬','var(--green)','var(--green-soft)',6),
  ('debito','00000000-0000-0000-0000-000000000001','Débito','🏦','#8c8c8c','#dcdcdc',7)
on conflict (id, user_id) do nothing;

-- Pendientes de aprobar
insert into public.expenses (user_id, provider, concept, amount_cents, currency, category_id, due_at, status, confidence_provider, confidence_amount, confidence_due, source_from) values
  ('00000000-0000-0000-0000-000000000001','Edenor','Factura luz - Mar/26',2458000,'ARS','servicios','2026-04-22','pending_approval',98,98,98,'facturacion@edenor.com.ar'),
  ('00000000-0000-0000-0000-000000000001','Netflix','Plan Premium',1199000,'ARS','suscrip','2026-04-24','pending_approval',99,99,99,'info@netflix.com'),
  ('00000000-0000-0000-0000-000000000001','Visa Galicia','Resumen tarjeta',41235000,'ARS','tarjeta','2026-04-28','pending_approval',97,97,97,'resumen@bancogalicia.com.ar'),
  ('00000000-0000-0000-0000-000000000001','AySA','Agua bimestral',872000,'ARS','servicios','2026-04-30','pending_approval',95,95,95,'facturas@aysa.com.ar'),
  ('00000000-0000-0000-0000-000000000001','AWS','Cloud services',4280,'USD','suscrip','2026-05-02','pending_approval',92,92,92,'no-reply@amazon.com'),
  ('00000000-0000-0000-0000-000000000001','Expensas Libertador 2340','Abril 2026',18500000,'ARS','expensas','2026-05-05','pending_approval',88,88,88,'administracion@tuexpensa.com');

-- Pagados del mes
insert into public.expenses (user_id, provider, concept, amount_cents, currency, category_id, paid_at, status, paid_via) values
  ('00000000-0000-0000-0000-000000000001','Metrogas','Gas natural',643000,'ARS','servicios','2026-04-03T09:00:00Z','paid','Débito auto'),
  ('00000000-0000-0000-0000-000000000001','Personal','Celular + internet',1899000,'ARS','servicios','2026-04-05T14:00:00Z','paid','Telegram OK'),
  ('00000000-0000-0000-0000-000000000001','Spotify','Plan Familiar',389000,'ARS','suscrip','2026-04-06T10:00:00Z','paid','Telegram OK'),
  ('00000000-0000-0000-0000-000000000001','ABL CABA','Cuota 04/12',925000,'ARS','impuestos','2026-04-10T11:00:00Z','paid','Telegram OK'),
  ('00000000-0000-0000-0000-000000000001','MercadoLibre','Cafetera Moulinex',18999000,'ARS','compras','2026-04-11T16:00:00Z','paid','Aprobado'),
  ('00000000-0000-0000-0000-000000000001','Claude Pro','Suscripción mensual',2050000,'ARS','suscrip','2026-04-12T08:00:00Z','paid','Telegram OK'),
  ('00000000-0000-0000-0000-000000000001','ARBA','Patente auto 02/12',3210000,'ARS','impuestos','2026-04-14T15:00:00Z','paid','Telegram OK'),
  ('00000000-0000-0000-0000-000000000001','Rappi','Rappi Prime',459000,'ARS','suscrip','2026-04-16T09:00:00Z','paid','Débito auto');

-- Insights
insert into public.insights (user_id, type, title, detail, color) values
  ('00000000-0000-0000-0000-000000000001','alerta','Netflix subió 18%','De $10.150 a $11.990. Hace 2 meses.','red'),
  ('00000000-0000-0000-0000-000000000001','insight','Gastás 32% menos que en marzo','Gracias al pausado de Disney+ y Crunchyroll.','green'),
  ('00000000-0000-0000-0000-000000000001','recordatorio','Visa vence en 4 días','$412.350 — el saldo más alto del año.','yellow'),
  ('00000000-0000-0000-0000-000000000001','descubierto','Suscripción nueva detectada','Figma Pro — ¿la conocés?','blue');

-- Reglas de ejemplo
insert into public.rules (user_id, sender_pattern, provider, category_id, auto_approve, hits) values
  ('00000000-0000-0000-0000-000000000001','facturacion@edenor.com.ar','Edenor','servicios',false,14),
  ('00000000-0000-0000-0000-000000000001','info@netflix.com','Netflix','suscrip',true,12),
  ('00000000-0000-0000-0000-000000000001','*@mercadolibre.com','MercadoLibre','compras',false,38),
  ('00000000-0000-0000-0000-000000000001','resumen@bancogalicia.com.ar','Visa Galicia','tarjeta',false,18),
  ('00000000-0000-0000-0000-000000000001','*@aysa.com.ar','AySA','servicios',true,6),
  ('00000000-0000-0000-0000-000000000001','administracion@tuexpensa.com','Edificio','expensas',false,4),
  ('00000000-0000-0000-0000-000000000001','*@spotify.com','Spotify','suscrip',true,12);
