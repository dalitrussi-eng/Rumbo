-- Corré esto DESPUÉS de la migración. Crea 6 usuarios de ejemplo y el viaje a Mendoza.
insert into auth.users(id,email,aud,role,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','juan@ejemplo.test','authenticated','authenticated','{"name":"Juan"}'),
('00000000-0000-0000-0000-000000000002','lila@ejemplo.test','authenticated','authenticated','{"name":"Lila"}'),
('00000000-0000-0000-0000-000000000003','manu@ejemplo.test','authenticated','authenticated','{"name":"Manu"}'),
('00000000-0000-0000-0000-000000000004','lucas@ejemplo.test','authenticated','authenticated','{"name":"Lucas"}'),
('00000000-0000-0000-0000-000000000005','meli@ejemplo.test','authenticated','authenticated','{"name":"Meli"}'),
('00000000-0000-0000-0000-000000000006','shaari@ejemplo.test','authenticated','authenticated','{"name":"Shaari"}')
on conflict do nothing;

insert into trips(id,name,destination,start_date,end_date,budget_cap,owner_id) values
('10000000-0000-0000-0000-000000000001','Escapada a Mendoza','Mendoza','2026-11-14','2026-11-16',6600000,'00000000-0000-0000-0000-000000000001');
insert into trip_members(trip_id,user_id) select '10000000-0000-0000-0000-000000000001', id from profiles where id::text like '00000000-0000-0000-0000-00000000000%' and id<>'00000000-0000-0000-0000-000000000001';

insert into bookings(trip_id,kind,title,detail,date,time,confirmation_code,price,paid,paid_by,created_by) values
('10000000-0000-0000-0000-000000000001','vuelo','Vuelo de ida','Aeroparque → Mendoza, 6 pasajes','2026-11-14','07:40','AR4821',1500000,true,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','alojamiento','Casa en Chacras de Coria','2 noches, 3 habitaciones','2026-11-14','14:00','BK-77213',1800000,true,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000001','auto','Alquiler de camioneta','Retiro en aeropuerto','2026-11-14','10:00','RC-3390',900000,false,null,'00000000-0000-0000-0000-000000000003'),
('10000000-0000-0000-0000-000000000001','actividad','Cata en bodega','Visita guiada + degustación','2026-11-15','11:00','CT-1182',1200000,false,null,'00000000-0000-0000-0000-000000000004'),
('10000000-0000-0000-0000-000000000001','vuelo','Vuelo de vuelta','Mendoza → Aeroparque','2026-11-16','20:15','AR4826',1100000,true,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');

insert into places(id,trip_id,name,category,note,distance_km,maps_url,saved_by,in_plan) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Zuccardi Valle de Uco','bodega','Almuerzo con vista a la cordillera',95,'https://maps.google.com/?q=Zuccardi+Valle+de+Uco','00000000-0000-0000-0000-000000000005',true),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Catena Zapata','bodega','La del templo maya, hay que reservar',35,'https://maps.google.com/?q=Catena+Zapata','00000000-0000-0000-0000-000000000002',false),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Trapiche','bodega','Clásica, cerca de la casa',12,'https://maps.google.com/?q=Bodega+Trapiche','00000000-0000-0000-0000-000000000003',false),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','1884 Francis Mallmann','comer','Cena del sábado',18,'https://maps.google.com/?q=1884+Francis+Mallmann','00000000-0000-0000-0000-000000000006',true),
('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Termas de Cacheuta','paseo','Para el domingo de relax',45,'https://maps.google.com/?q=Termas+Cacheuta','00000000-0000-0000-0000-000000000004',false),
('20000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Cerro de la Gloria','paseo','Atardecer y fotos',8,'https://maps.google.com/?q=Cerro+de+la+Gloria','00000000-0000-0000-0000-000000000001',false);
insert into place_votes(place_id,user_id) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003'),('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005');

insert into todos(trip_id,title,due_label,phase,assignee_ids,done,created_by) values
('10000000-0000-0000-0000-000000000001','Reservar mesa en 1884','Esta semana','antes','{00000000-0000-0000-0000-000000000006}',false,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Confirmar cata con la bodega','Antes del 10/11','antes','{00000000-0000-0000-0000-000000000004}',true,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Pagar el alquiler de camioneta','Antes del 12/11','antes','{00000000-0000-0000-0000-000000000003}',false,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Hacer el check-in online','24 hs antes','antes','{00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002}',false,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Comprar agua y snacks para la ruta','Al llegar','alla','{00000000-0000-0000-0000-000000000005}',false,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Armar la lista de música del auto','Al llegar','alla','{}',false,'00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000001','Dividir cuentas antes de volver','Último día','alla','{00000000-0000-0000-0000-000000000001}',false,'00000000-0000-0000-0000-000000000001');

-- Para que VOS veas este viaje, después de loguearte (reemplazá el email):
-- insert into trip_members(trip_id,user_id) select '10000000-0000-0000-0000-000000000001', id from auth.users where email='TU@EMAIL' on conflict do nothing;
