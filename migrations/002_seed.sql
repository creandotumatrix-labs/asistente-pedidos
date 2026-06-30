-- 002_seed.sql — initial catalog (menu_items + listings), GENERATED from /data by scripts/gen-seed.ts.
-- Idempotent: ON CONFLICT DO NOTHING. After this seed, Postgres is the source of truth;
-- the running agent reads these tables live (no JSON at runtime).

INSERT INTO menu_items
  (business_slug, item_id, nombre_es, categoria, precio_mxn, descripcion_es, modificadores, alergenos, promo, disponible, sort_order)
VALUES
  ('taqueria-el-pastor', 'taco_pastor', 'Taco de pastor', 'Tacos', 30, 'Cerdo adobado al trompo con piña.', '[{"id":"con_todo","nombre_es":"con todo (cebolla, cilantro, piña)"},{"id":"sin_cebolla","nombre_es":"sin cebolla"},{"id":"sin_cilantro","nombre_es":"sin cilantro"},{"id":"extra_carne","nombre_es":"extra carne","precio_mxn":15},{"id":"con_queso","nombre_es":"con queso","precio_mxn":12}]'::jsonb, '[]'::jsonb, NULL, true, 0),
  ('taqueria-el-pastor', 'taco_suadero', 'Taco de suadero', 'Tacos', 30, 'Res suave dorada en comal.', '[{"id":"con_todo","nombre_es":"con todo (cebolla, cilantro)"},{"id":"sin_cebolla","nombre_es":"sin cebolla"},{"id":"sin_cilantro","nombre_es":"sin cilantro"},{"id":"extra_carne","nombre_es":"extra carne","precio_mxn":15},{"id":"con_queso","nombre_es":"con queso","precio_mxn":12}]'::jsonb, '[]'::jsonb, NULL, true, 1),
  ('taqueria-el-pastor', 'taco_bistec', 'Taco de bistec', 'Tacos', 34, 'Bistec de res a la plancha.', '[{"id":"con_todo","nombre_es":"con todo (cebolla, cilantro)"},{"id":"sin_cebolla","nombre_es":"sin cebolla"},{"id":"extra_carne","nombre_es":"extra carne","precio_mxn":15},{"id":"con_queso","nombre_es":"con queso","precio_mxn":12}]'::jsonb, '[]'::jsonb, NULL, true, 2),
  ('taqueria-el-pastor', 'taco_campechano', 'Taco campechano', 'Tacos', 34, 'Bistec con longaniza y chicharrón.', '[{"id":"con_todo","nombre_es":"con todo"},{"id":"sin_cebolla","nombre_es":"sin cebolla"},{"id":"con_queso","nombre_es":"con queso","precio_mxn":12}]'::jsonb, '[]'::jsonb, NULL, true, 3),
  ('taqueria-el-pastor', 'taco_longaniza', 'Taco de longaniza', 'Tacos', 28, 'Longaniza roja estilo CDMX.', '[{"id":"con_todo","nombre_es":"con todo"},{"id":"sin_cebolla","nombre_es":"sin cebolla"}]'::jsonb, '[]'::jsonb, NULL, true, 4),
  ('taqueria-el-pastor', 'gringa_pastor', 'Gringa de pastor', 'Tacos', 65, 'Tortilla de harina con pastor y queso gratinado.', '[{"id":"con_todo","nombre_es":"con todo"},{"id":"sin_cebolla","nombre_es":"sin cebolla"}]'::jsonb, '["gluten","lacteos"]'::jsonb, NULL, true, 5),
  ('taqueria-el-pastor', 'quesabirria', 'Quesabirria (orden de 3)', 'Especialidades', 130, 'Tacos de birria de res con queso y consomé.', '[{"id":"sin_cebolla","nombre_es":"sin cebolla"}]'::jsonb, '["lacteos"]'::jsonb, NULL, false, 6),
  ('taqueria-el-pastor', 'alambre_res', 'Alambre de res', 'Especialidades', 145, 'Res con tocino, pimiento, cebolla y queso. Con tortillas.', '[{"id":"sin_pimiento","nombre_es":"sin pimiento"},{"id":"extra_queso","nombre_es":"extra queso","precio_mxn":18}]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 7),
  ('taqueria-el-pastor', 'volcan_pastor', 'Volcán de pastor', 'Quesadillas y Volcanes', 45, 'Tostada de queso fundido con pastor.', '[{"id":"con_todo","nombre_es":"con todo"}]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 8),
  ('taqueria-el-pastor', 'quesadilla', 'Quesadilla de queso', 'Quesadillas y Volcanes', 45, 'Tortilla con queso Oaxaca. Elige guiso.', '[{"id":"pastor","nombre_es":"con pastor","precio_mxn":15},{"id":"champinon","nombre_es":"con champiñón","precio_mxn":10}]'::jsonb, '["lacteos","gluten"]'::jsonb, NULL, true, 9),
  ('taqueria-el-pastor', 'torta_pastor', 'Torta de pastor', 'Tortas', 75, 'Telera con pastor, frijol, aguacate y queso.', '[{"id":"sin_chile","nombre_es":"sin chile"},{"id":"extra_carne","nombre_es":"extra carne","precio_mxn":20}]'::jsonb, '["gluten","lacteos"]'::jsonb, NULL, true, 10),
  ('taqueria-el-pastor', 'torta_milanesa', 'Torta de milanesa', 'Tortas', 85, 'Milanesa de res empanizada, aguacate y quesillo.', '[{"id":"sin_chile","nombre_es":"sin chile"}]'::jsonb, '["gluten","lacteos","huevo"]'::jsonb, NULL, true, 11),
  ('taqueria-el-pastor', 'guacamole', 'Guacamole con totopos', 'Guarniciones', 55, 'Guacamole fresco con totopos de la casa.', '[]'::jsonb, '[]'::jsonb, '{"precio_mxn":45,"etiqueta_es":"Promo del día a $45"}'::jsonb, true, 12),
  ('taqueria-el-pastor', 'frijoles_charros', 'Frijoles charros', 'Guarniciones', 40, 'Frijoles con tocino, chorizo y chile.', '[]'::jsonb, '[]'::jsonb, NULL, true, 13),
  ('taqueria-el-pastor', 'queso_fundido', 'Queso fundido', 'Guarniciones', 90, 'Queso fundido con tortillas. Agrega pastor o chorizo.', '[{"id":"pastor","nombre_es":"con pastor","precio_mxn":20},{"id":"chorizo","nombre_es":"con chorizo","precio_mxn":18}]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 14),
  ('taqueria-el-pastor', 'agua_horchata', 'Agua de horchata', 'Bebidas', 35, 'Agua fresca de horchata (1/2 L).', '[]'::jsonb, '[]'::jsonb, NULL, true, 15),
  ('taqueria-el-pastor', 'agua_jamaica', 'Agua de jamaica', 'Bebidas', 35, 'Agua fresca de jamaica (1/2 L).', '[]'::jsonb, '[]'::jsonb, NULL, true, 16),
  ('taqueria-el-pastor', 'agua_tamarindo', 'Agua de tamarindo', 'Bebidas', 35, 'Agua fresca de tamarindo (1/2 L).', '[]'::jsonb, '[]'::jsonb, NULL, false, 17),
  ('taqueria-el-pastor', 'refresco', 'Refresco', 'Bebidas', 30, 'Coca-Cola, Sidral, Fanta o agua mineral.', '[]'::jsonb, '[]'::jsonb, NULL, true, 18),
  ('taqueria-el-pastor', 'michelada', 'Michelada', 'Bebidas', 75, 'Cerveza preparada con limón, salsas y chamoy.', '[{"id":"sin_chamoy","nombre_es":"sin chamoy"}]'::jsonb, '["gluten"]'::jsonb, NULL, true, 19),
  ('taqueria-el-pastor', 'flan', 'Flan napolitano', 'Postres', 45, 'Flan casero de la abuela.', '[]'::jsonb, '["lacteos","huevo"]'::jsonb, NULL, true, 20),
  ('taqueria-el-pastor', 'arroz_con_leche', 'Arroz con leche', 'Postres', 40, 'Arroz con leche y canela.', '[]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 21),
  ('la-mesa-fina', 'aguachile_callo', 'Aguachile de callo de hacha', 'Entradas', 285, 'Callo de hacha, leche de tigre de chile serrano, aguacate y cítricos.', '[{"id":"sin_picante","nombre_es":"sin picante"}]'::jsonb, '["mariscos"]'::jsonb, NULL, true, 0),
  ('la-mesa-fina', 'burrata_huerto', 'Burrata del huerto', 'Entradas', 240, 'Burrata, jitomates heirloom, albahaca y aceite de oliva.', '[]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 1),
  ('la-mesa-fina', 'robalo_pibil', 'Robalo en recado', 'Principales', 480, 'Robalo confitado en recado yucateco, puré de plátano macho.', '[]'::jsonb, '["pescado"]'::jsonb, NULL, true, 2),
  ('la-mesa-fina', 'rib_eye', 'Rib eye madurado 350g', 'Principales', 620, 'Rib eye de maduración 28 días, médula y chimichurri de la casa.', '[{"id":"termino_medio","nombre_es":"término medio"},{"id":"termino_tres_cuartos","nombre_es":"tres cuartos"}]'::jsonb, '[]'::jsonb, NULL, true, 3),
  ('la-mesa-fina', 'risotto_hongos', 'Risotto de hongos', 'Principales', 360, 'Arroz carnaroli, hongos de temporada y parmesano.', '[{"id":"sin_gluten","nombre_es":"sin gluten"}]'::jsonb, '["lacteos"]'::jsonb, NULL, true, 4),
  ('la-mesa-fina', 'fondant_chocolate', 'Fondant de chocolate', 'Postres', 160, 'Coulant tibio de chocolate 70% con helado de vainilla.', '[]'::jsonb, '["lacteos","huevo","gluten"]'::jsonb, NULL, true, 5),
  ('la-mesa-fina', 'vino_copa_tinto', 'Copa de vino tinto de la casa', 'Vinos y Bebidas', 180, 'Selección del sommelier, tinto de Valle de Guadalupe.', '[]'::jsonb, '["sulfitos"]'::jsonb, NULL, true, 6),
  ('la-mesa-fina', 'agua_mineral', 'Agua mineral 750ml', 'Vinos y Bebidas', 60, 'Agua mineral con gas, servicio a la mesa.', '[]'::jsonb, '[]'::jsonb, NULL, true, 7)
ON CONFLICT (business_slug, item_id) DO NOTHING;

INSERT INTO listings
  (business_slug, listing_id, titulo_es, operacion, zona, recamaras, banos, m2, precio_mxn, amenidades, disponible, sort_order)
VALUES
  ('inmobiliaria-cdmx', 'RN-01', 'Departamento en La Condesa, remodelado', 'renta', 'Condesa', 2, 2, 95, 38000, '["balcón","pet friendly","1 cajón","amueblado"]'::jsonb, true, 0),
  ('inmobiliaria-cdmx', 'RN-02', 'Loft en Roma Norte', 'renta', 'Roma Norte', 1, 1, 58, 24000, '["roof garden","seguridad 24h"]'::jsonb, true, 1),
  ('inmobiliaria-cdmx', 'RN-03', 'Departamento de lujo en Polanco', 'renta', 'Polanco', 2, 2, 120, 55000, '["gimnasio","2 cajones","concierge","amueblado"]'::jsonb, true, 2),
  ('inmobiliaria-cdmx', 'RN-04', 'Casa en Del Valle con jardín', 'renta', 'Del Valle', 3, 3, 210, 42000, '["jardín","3 cajones","cuarto de servicio"]'::jsonb, false, 3),
  ('inmobiliaria-cdmx', 'VN-01', 'Penthouse en Polanco con terraza', 'venta', 'Polanco', 3, 3, 240, 18500000, '["terraza","3 cajones","bodega","vista a Reforma"]'::jsonb, true, 4),
  ('inmobiliaria-cdmx', 'VN-02', 'Departamento en Coyoacán cerca del centro', 'venta', 'Coyoacán', 2, 2, 88, 6200000, '["1 cajón","elevador","área común"]'::jsonb, true, 5),
  ('inmobiliaria-cdmx', 'VN-03', 'Casa en Santa Fe en condominio', 'venta', 'Santa Fe', 4, 4, 320, 14900000, '["alberca","vigilancia","4 cajones","family room"]'::jsonb, true, 6),
  ('inmobiliaria-cdmx', 'VN-04', 'Departamento en Roma Sur, obra nueva', 'venta', 'Roma Sur', 2, 2, 102, 7800000, '["roof garden","preventa","2 cajones"]'::jsonb, true, 7)
ON CONFLICT (business_slug, listing_id) DO NOTHING;
