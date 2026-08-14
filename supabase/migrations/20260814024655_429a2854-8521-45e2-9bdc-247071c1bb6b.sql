UPDATE public.cards c SET stock = c.stock + v.qty, updated_at = now()
FROM (VALUES
 ('303d85a3-a49c-4fbd-96c5-cc6e5efe9dde'::uuid,1),
 ('7a3c4387-6726-49a7-9ac0-e2666ee08c79'::uuid,2),
 ('ef379147-8093-481c-8ffe-508c90ca4aaf'::uuid,3),
 ('2b3cab10-faf0-4d3d-8d08-a279bff6dd25'::uuid,8),
 ('b828c734-05da-4ab1-a27b-8b8b2586dc3d'::uuid,4),
 ('64e7e7e9-4683-489a-9024-4322fc05bc43'::uuid,5),
 ('e734d69b-e147-422f-8636-c635b343dafe'::uuid,3),
 ('079e44cc-b009-43e3-b82c-aa5260b79d90'::uuid,9),
 ('c9dbd113-ea64-4b16-b6b6-5684b35b28ba'::uuid,4),
 ('e37837d6-752e-4fad-9d8c-7e8bc8f93ca4'::uuid,10),
 ('c124fd8e-0629-4f77-bf9f-2b7aaad049fd'::uuid,2),
 ('370580bd-2669-460b-9db7-c14815f65b02'::uuid,12),
 ('14e5bcb9-9142-4c60-bf86-395b1f2e9c77'::uuid,5),
 ('966df533-b44d-4cbb-a750-9152736a1f3f'::uuid,1),
 ('25a09f44-d1ec-40f6-8a58-3ae2dbfc7431'::uuid,4),
 ('c630e98b-d7f2-4cd1-b5ee-4ba3c3308934'::uuid,2),
 ('cb1662e4-616f-436b-80d1-551227413f9f'::uuid,1),
 ('f3c017e1-f734-42f2-ba4b-7f258c26edbd'::uuid,3)
) AS v(id, qty)
WHERE c.id = v.id;