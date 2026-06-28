-- ============================================================================
-- Princess — demo seed (idempotent-friendly)
-- See docs/SEED_DATA.md. Run AFTER migrations 0001..0007 AND after the 7 demo
-- auth users are created (Dashboard / admin API / local SQL — SEED_DATA.md §3).
-- This script NEVER inserts into profiles directly (handle_new_user owns that);
-- it UPDATEs profiles by email lookup, and inserts content with fixed UUIDs.
-- Money: numeric in DB; fees stored in INTEGER MINOR UNITS in platform_upfront_fees.
-- NOTE: all fixed UUIDs use hex digits (0-9, a-f) only.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Platform settings (commission defaults — BR-4) — singleton upsert
-- ---------------------------------------------------------------------------
insert into platform_settings (singleton, commission_products, commission_services, commission_rentals)
values (true, 15, 10, 10)
on conflict (singleton) do update
  set commission_products = excluded.commission_products,
      commission_services = excluded.commission_services,
      commission_rentals  = excluded.commission_rentals,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Upfront fees per (offering_type, currency) — minor units (C7/C10)
--    product:  10.00 SAR / 20.00 EGP   rental: 50.00 SAR / 50.00 EGP
--    service: 100.00 SAR /100.00 EGP
-- ---------------------------------------------------------------------------
insert into platform_upfront_fees (offering_type, currency, amount_minor) values
  ('product','SAR', 1000), ('product','EGP', 2000),
  ('rental','SAR',  5000), ('rental','EGP',  5000),
  ('service','SAR',10000), ('service','EGP',10000)
on conflict (offering_type, currency) do update
  set amount_minor = excluded.amount_minor, updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. Profiles — UPDATE only (rows created by the signup trigger)
--    Approve the "approved" vendors; set names/types. Pending vendors stay pending.
-- ---------------------------------------------------------------------------
update profiles set full_name = 'Princess Admin', status = 'active'
  where id = (select id from auth.users where email = 'admin@princess.test');

update profiles set full_name = 'Layla Boutique', phone = '+966500000001', status = 'active'
  where id = (select id from auth.users where email = 'seller1@princess.test');

update profiles set full_name = 'Pending Seller', phone = '+966500000002'  -- stays pending
  where id = (select id from auth.users where email = 'seller2@princess.test');

update profiles set full_name = 'Mona Makeup', phone = '+966500000003',
       provider_type = 'freelancer', status = 'active'
  where id = (select id from auth.users where email = 'provider1@princess.test');

update profiles set full_name = 'Glow Beauty Center', phone = '+966500000004',
       provider_type = 'center'  -- stays pending
  where id = (select id from auth.users where email = 'provider2@princess.test');

update profiles set full_name = 'Sara Customer', phone = '+966500000005'
  where id = (select id from auth.users where email = 'customer1@princess.test');

update profiles set full_name = 'Nour Customer', phone = '+966500000006'
  where id = (select id from auth.users where email = 'customer2@princess.test');

-- ---------------------------------------------------------------------------
-- 4. Categories (fixed UUIDs; key on slug).  product=c*, service=a*
-- ---------------------------------------------------------------------------
insert into categories (id, kind, name_ar, name_en, slug, sort_order) values
  ('00000000-0000-0000-0000-0000000000c1','product','فساتين','Dresses','dresses',1),
  ('00000000-0000-0000-0000-0000000000c2','product','أحذية','Shoes','shoes',2),
  ('00000000-0000-0000-0000-0000000000c3','product','حقائب','Bags','bags',3),
  ('00000000-0000-0000-0000-0000000000c4','product','إكسسوارات','Accessories','accessories',4),
  ('00000000-0000-0000-0000-0000000000c5','product','مستحضرات تجميل','Cosmetics','cosmetics',5),
  ('00000000-0000-0000-0000-0000000000a1','service','مكياج','Makeup','makeup',1),
  ('00000000-0000-0000-0000-0000000000a2','service','تصفيف الشعر','Hair','hair',2),
  ('00000000-0000-0000-0000-0000000000a3','service','أظافر','Nails','nails',3),
  ('00000000-0000-0000-0000-0000000000a4','service','مساج','Massage','massage',4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Products (seller1, approved). One rentable dress (b1). FK-safe via EXISTS.
-- ---------------------------------------------------------------------------
insert into products (id, seller_id, category_id, title, description, price, currency,
                      is_rentable, rental_daily_price, security_deposit, stock, status, images)
select '00000000-0000-0000-0000-0000000000b1',
       (select id from auth.users where email='seller1@princess.test'),
       '00000000-0000-0000-0000-0000000000c1',
       'Rose Gold Evening Gown','Elegant floor-length gown — buy or rent.',
       450.00,'SAR', true, 80.00, 200.00, 5, 'active',
       '[{"url":"https://demo.supabase.co/storage/v1/object/public/products/gown.jpg","alt":"Evening gown","sort":0}]'::jsonb
where exists (select 1 from auth.users where email='seller1@princess.test')
on conflict (id) do nothing;

insert into products (id, seller_id, category_id, title, description, price, currency, stock, status, images)
select '00000000-0000-0000-0000-0000000000b2',
       (select id from auth.users where email='seller1@princess.test'),
       '00000000-0000-0000-0000-0000000000c2',
       'Blush Satin Heels','Comfortable satin heels.',220.00,'SAR',12,'active',
       '[{"url":"https://demo.supabase.co/storage/v1/object/public/products/heels.jpg","alt":"Heels","sort":0}]'::jsonb
where exists (select 1 from auth.users where email='seller1@princess.test')
on conflict (id) do nothing;

insert into products (id, seller_id, category_id, title, description, price, currency, stock, status, images)
select '00000000-0000-0000-0000-0000000000b3',
       (select id from auth.users where email='seller1@princess.test'),
       '00000000-0000-0000-0000-0000000000c5',
       'Luxe Lipstick Set','Set of 4 long-wear lipsticks.',90.00,'SAR',40,'active',
       '[{"url":"https://demo.supabase.co/storage/v1/object/public/products/lipstick.jpg","alt":"Lipstick set","sort":0}]'::jsonb
where exists (select 1 from auth.users where email='seller1@princess.test')
on conflict (id) do nothing;

-- 5b. Variants (gown=b1a*, heels=b2a*)
insert into product_variants (id, product_id, size, color, stock, sku) values
  ('00000000-0000-0000-0000-00000000b1a1','00000000-0000-0000-0000-0000000000b1','S','Rose Gold',2,'GOWN-S'),
  ('00000000-0000-0000-0000-00000000b1a2','00000000-0000-0000-0000-0000000000b1','M','Rose Gold',2,'GOWN-M'),
  ('00000000-0000-0000-0000-00000000b1a3','00000000-0000-0000-0000-0000000000b1','L','Rose Gold',1,'GOWN-L'),
  ('00000000-0000-0000-0000-00000000b2a1','00000000-0000-0000-0000-0000000000b2','38','Blush',4,'HEEL-38'),
  ('00000000-0000-0000-0000-00000000b2a2','00000000-0000-0000-0000-0000000000b2','39','Blush',4,'HEEL-39'),
  ('00000000-0000-0000-0000-00000000b2a3','00000000-0000-0000-0000-0000000000b2','40','Blush',4,'HEEL-40')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Services (provider1) d1/d2 + availability e1/e2/e3 (fixed July 2026)
-- ---------------------------------------------------------------------------
insert into services (id, provider_id, category_id, title, description, price, currency, duration_minutes, status)
select '00000000-0000-0000-0000-0000000000d1',
       (select id from auth.users where email='provider1@princess.test'),
       '00000000-0000-0000-0000-0000000000a1',
       'Bridal Makeup','Full bridal makeup with trial.',600.00,'SAR',120,'active'
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

insert into services (id, provider_id, category_id, title, description, price, currency, duration_minutes, status)
select '00000000-0000-0000-0000-0000000000d2',
       (select id from auth.users where email='provider1@princess.test'),
       '00000000-0000-0000-0000-0000000000a2',
       'Hair Styling','Occasion hair styling.',250.00,'SAR',60,'active'
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

insert into availability (id, provider_id, slot_start, slot_end, is_open)
select '00000000-0000-0000-0000-0000000000e1',
       (select id from auth.users where email='provider1@princess.test'),
       '2026-07-01 10:00:00+03','2026-07-01 12:00:00+03', true
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

insert into availability (id, provider_id, slot_start, slot_end, is_open)
select '00000000-0000-0000-0000-0000000000e2',
       (select id from auth.users where email='provider1@princess.test'),
       '2026-07-01 14:00:00+03','2026-07-01 15:00:00+03', true
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

insert into availability (id, provider_id, slot_start, slot_end, is_open)
select '00000000-0000-0000-0000-0000000000e3',
       (select id from auth.users where email='provider1@princess.test'),
       '2026-07-02 11:00:00+03','2026-07-02 13:00:00+03', true
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Event planner (provider1, verified) f1 — typed jsonb packages/specialties
-- ---------------------------------------------------------------------------
insert into event_planners (id, user_id, business_name, description, location, experience,
                            specialties, packages, phone, is_verified, status)
select '00000000-0000-0000-0000-0000000000f1',
       (select id from auth.users where email='provider1@princess.test'),
       'Mona Events','Boutique wedding & engagement planning.','Riyadh',7,
       '["Weddings","Engagements"]'::jsonb,
       '[{"name":"Silver","price":5000,"currency":"SAR","description":"Basic setup"},
         {"name":"Gold","price":12000,"currency":"SAR","description":"Full-day coordination"}]'::jsonb,
       '+966500000003', true, 'active'
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Event request (customer1 -> planner f1) fa — REQ-EVT-04/05/06
-- ---------------------------------------------------------------------------
insert into event_requests (id, planner_id, customer_id, event_type, event_date,
                            guest_count, budget, currency, description, status)
select '00000000-0000-0000-0000-0000000000fa',
       '00000000-0000-0000-0000-0000000000f1',
       (select id from auth.users where email='customer1@princess.test'),
       'Wedding','2026-09-15',150,30000.00,'SAR',
       'Outdoor evening wedding, rose-gold theme.','pending'
where exists (select 1 from auth.users where email='customer1@princess.test')
  and exists (select 1 from event_planners where id='00000000-0000-0000-0000-0000000000f1')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. Portfolio items — PROFILE-level (ab, service_id null) + SERVICE-level (ac).
--    Exercises the combined-merge `source` tag (REQ-PORT-04).
-- ---------------------------------------------------------------------------
insert into portfolio_items (id, provider_id, service_id, url, caption, sort_order)
select '00000000-0000-0000-0000-0000000000ab',
       (select id from auth.users where email='provider1@princess.test'),
       null,
       'https://demo.supabase.co/storage/v1/object/public/portfolio/profile-1.jpg',
       'Engagement glam', 0
where exists (select 1 from auth.users where email='provider1@princess.test')
on conflict (id) do nothing;

insert into portfolio_items (id, provider_id, service_id, url, caption, sort_order)
select '00000000-0000-0000-0000-0000000000ac',
       (select id from auth.users where email='provider1@princess.test'),
       '00000000-0000-0000-0000-0000000000d1',
       'https://demo.supabase.co/storage/v1/object/public/portfolio/bridal-1.jpg',
       'Bridal look at Ritz', 1
where exists (select 1 from auth.users where email='provider1@princess.test')
  and exists (select 1 from services where id='00000000-0000-0000-0000-0000000000d1')
on conflict (id) do nothing;

commit;

-- Verify quickly:
--   select role, status, provider_type, full_name from profiles order by role;
--   select title, is_rentable from products;
--   select business_name, is_verified from event_planners;
--   select case when service_id is null then 'profile' else 'service' end as source,
--          count(*) from portfolio_items group by 1;
