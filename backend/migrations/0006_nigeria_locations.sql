-- Real Nigerian states and LGAs for the applicant location selects.
-- Generated from the nigeria-state-lga-data package (v1.1.5).
-- Idempotent: re-running updates the seeded reference rows by slug.
--
-- The original seed treated Ojota as an LGA. It is a Lagos district, not a
-- local government area, so it is retired from the approved location tree.

INSERT INTO locations (id, type, name, code, slug, status)
VALUES ('0c6cd1a1-fabf-5ef1-8556-ec711a045ab1', 'country', 'Nigeria', 'NG', 'nigeria', 'approved')
ON CONFLICT (slug) DO UPDATE SET type = 'country', name = EXCLUDED.name, code = EXCLUDED.code, status = 'approved';

-- Abia
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('ccf39c38-2c33-5f48-84d9-f16bf2a18bda', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Abia', 'AB', 'abia', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('fcf9affd-9201-54ed-b433-cd9292972f53', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Aba North', 'aba-north', 'approved'),
  ('2b0e230c-4fa0-55d3-af97-969bb9355625', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Aba South', 'aba-south', 'approved'),
  ('166908f8-6876-5ba5-ad64-0b9bf2d80a72', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Arochukwu', 'arochukwu', 'approved'),
  ('a2322c5a-e4b4-5d7f-bd1b-17d43eb4a324', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Bende', 'bende', 'approved'),
  ('737d26cc-bafb-5a3d-8b0b-883d82d77f3f', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ikwuano', 'ikwuano', 'approved'),
  ('608b4cbe-e11b-5c29-8b36-1edb69bb9ea6', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Isiala-Ngwa North', 'isiala-ngwa-north', 'approved'),
  ('69769d1f-3d8f-5798-852d-f83dd9481b21', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Isiala-Ngwa South', 'isiala-ngwa-south', 'approved'),
  ('3850b08c-1902-54ed-bd94-73a80f8e2f36', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Isuikwato', 'isuikwato', 'approved'),
  ('b441a299-753f-545b-8793-eb51d90d29a6', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Obi Nwa', 'obi-nwa', 'approved'),
  ('4d3e8d3e-5220-5d4a-91c8-0bcc3dc766c6', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ohafia', 'ohafia', 'approved'),
  ('625a4754-e45f-541a-8888-f9d44dbc24fa', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Osisioma', 'osisioma', 'approved'),
  ('e05d5e91-c217-5a9f-977c-07a2d1b76aed', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ngwa', 'ngwa', 'approved'),
  ('12f5f475-b7c9-5f7d-950a-aec8d79ad259', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ugwunagbo', 'ugwunagbo', 'approved'),
  ('769de9a5-b700-539a-8ce3-9e2035c895a2', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ukwa East', 'ukwa-east', 'approved'),
  ('48d5e762-27ff-526d-b110-e8d8186f498d', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Ukwa West', 'ukwa-west', 'approved'),
  ('cba87be5-de7c-5d40-b479-72f8f243ec7c', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Umuahia North', 'umuahia-north', 'approved'),
  ('c42ae4e6-4da2-52bc-9d92-640621e74659', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Umuahia South', 'umuahia-south', 'approved'),
  ('5386c440-4e58-5e4e-8da1-7f77fc4dd65f', (SELECT id FROM locations WHERE slug = 'abia'), 'lga', 'Umu-Neochi', 'umu-neochi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Adamawa
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('e8890392-90d3-5cf5-87c8-63188fc1eeb3', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Adamawa', 'AD', 'adamawa', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('8d148836-9129-50a8-a419-1dbbb3baadf9', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Demsa', 'demsa', 'approved'),
  ('1e02ca49-3343-5ddb-a8f4-01fe2451442d', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Fufore', 'fufore', 'approved'),
  ('72fa459d-cec2-59bb-83fe-1ad573ba752e', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Ganye', 'ganye', 'approved'),
  ('9aa3d1ff-41c0-5897-aef8-75480c3a4808', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Girei', 'girei', 'approved'),
  ('b42fa584-2d92-5932-926b-1f2d2c03c2a7', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Gombi', 'gombi', 'approved'),
  ('37892789-fe53-5399-abd9-690d41d8e2b5', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Guyuk', 'guyuk', 'approved'),
  ('d29bcd2e-5423-5a7f-8a4a-7e8a12ddd528', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Hong', 'hong', 'approved'),
  ('c9c0850a-6021-5c08-9283-c7b5db57bc9e', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Jada', 'jada', 'approved'),
  ('90a4ec41-384e-51fd-bd73-196bbefc0858', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Lamurde', 'lamurde', 'approved'),
  ('92b80d85-07c8-5ed5-b1e5-65fac4a848d9', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Madagali', 'madagali', 'approved'),
  ('c8777fc0-6f2e-5d54-9166-0c8e840517bb', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Maiha', 'maiha', 'approved'),
  ('c71f46a0-a6e1-59e4-88fa-4646931469c0', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Mayo-Belwa', 'mayo-belwa', 'approved'),
  ('bfcf1b57-57e4-5785-b2df-5bc3d8521f96', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Michika', 'michika', 'approved'),
  ('cc9f06f9-8037-579f-9c3e-de870453f64a', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Mubi North', 'mubi-north', 'approved'),
  ('149df323-471c-5c0a-8b24-339c4e78208d', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Mubi South', 'mubi-south', 'approved'),
  ('a26693f8-6572-5137-a109-15d79ce90998', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Numan', 'numan', 'approved'),
  ('5d12223d-d15d-5dc3-a27a-347e756ac0d9', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Shelleng', 'shelleng', 'approved'),
  ('a5aea7db-cdeb-5943-9699-3783cc1e9156', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Song', 'song', 'approved'),
  ('64d924aa-f5ee-5dd1-9fc5-f5095a25cdf1', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Toungo', 'toungo', 'approved'),
  ('3460d2a3-f8d9-54f4-ab77-b6929a0aeb54', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Yola North', 'yola-north', 'approved'),
  ('9834159e-30ea-586d-9947-9a2613285652', (SELECT id FROM locations WHERE slug = 'adamawa'), 'lga', 'Yola South', 'yola-south', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Akwa Ibom
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('63d01bb1-b288-54c4-8568-08db86985b43', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Akwa Ibom', 'AK', 'akwa-ibom', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('8112450a-cc86-5d31-9555-27d393136aa8', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Abak', 'abak', 'approved'),
  ('6908636b-0c08-5912-9c36-59280fc0de49', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Eastern Obolo', 'eastern-obolo', 'approved'),
  ('38bdc465-ae45-56b6-bead-1362b75e9dc7', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Eket', 'eket', 'approved'),
  ('e61d1efa-b35d-5524-8cca-176e991674d6', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Esit Eket', 'esit-eket', 'approved'),
  ('51c7354f-6db7-5c46-8635-26201d92509d', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Essien Udim', 'essien-udim', 'approved'),
  ('d7838684-82cb-5ed6-8e6a-97e34ea52972', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Etim Ekpo', 'etim-ekpo', 'approved'),
  ('46ac85e5-9afc-574c-95f1-fbb4b0f9df2f', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Etinan', 'etinan', 'approved'),
  ('87b05a74-2d7e-5175-a94c-fa8f8a1a3aff', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ibeno', 'ibeno', 'approved'),
  ('c9e15db4-0f99-565d-86de-e27284663120', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ibesikpo Asutan', 'ibesikpo-asutan', 'approved'),
  ('0aa75fcc-7b56-5e93-ad66-3a7fea7f93e8', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ibiono-Ibom', 'ibiono-ibom', 'approved'),
  ('dbd9c703-ddb2-580b-b8c6-70cd29d36a90', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ika', 'ika', 'approved'),
  ('04af8a71-812c-55d9-b4c6-73be22e34375', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ikono', 'ikono', 'approved'),
  ('e55c4fdd-a10f-5820-a29e-cb4ec46d0321', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ikot Abasi', 'ikot-abasi', 'approved'),
  ('004c97da-edcd-58f4-b52c-67f05d7b8573', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ikot Ekpene', 'ikot-ekpene', 'approved'),
  ('4c173458-c7ca-565f-b72b-79c511246c84', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ini', 'ini', 'approved'),
  ('6e3d4f6a-8b6f-5a9a-bf49-02b055f165eb', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Itu', 'itu', 'approved'),
  ('e56ce9e3-9d63-5336-9d5f-33c571b34ead', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Mbo', 'mbo', 'approved'),
  ('1f2215b9-4900-5d94-83a7-9bcf1734bacd', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Mkpat-Enin', 'mkpat-enin', 'approved'),
  ('060b9bf4-7bfe-534d-bf47-5edf925f5961', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Nsit-Atai', 'nsit-atai', 'approved'),
  ('9259bfad-4d9a-522b-a099-147cbc45dfe8', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Nsit-Ibom', 'nsit-ibom', 'approved'),
  ('30ab9c4d-6c53-55e8-b36d-a44a1220fc8d', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Nsit-Ubium', 'nsit-ubium', 'approved'),
  ('dc5df821-e7f7-5929-bc8e-4a5e0203a7c2', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Obot Akara', 'obot-akara', 'approved'),
  ('ace0f715-cdcc-5065-b8e6-fd127f288f16', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Okobo', 'okobo', 'approved'),
  ('c5f68ff9-0830-55b1-ad90-3f13d431754e', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Onna', 'onna', 'approved'),
  ('c5d79e86-a9a8-5b3a-95de-3ca3d8ed5868', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Oron', 'oron', 'approved'),
  ('5498886d-4b89-5836-9aa0-c1368f8f83c3', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Oruk Anam', 'oruk-anam', 'approved'),
  ('ba186f7d-0dff-5e37-bb8c-6324367f1070', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Udung-Uko', 'udung-uko', 'approved'),
  ('dcca4b3d-246b-5b7c-90c7-d3cc36e8f650', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Ukanafun', 'ukanafun', 'approved'),
  ('33cc5e21-8a9b-554f-a61e-5aebb4af6653', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Uruan', 'uruan', 'approved'),
  ('917e9651-e014-5161-b409-0b902f414f86', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Urue-Offong/Oruko', 'urue-offong-oruko', 'approved'),
  ('5e6662df-c0c9-5bba-9818-15763b0df2c0', (SELECT id FROM locations WHERE slug = 'akwa-ibom'), 'lga', 'Uyo', 'uyo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Anambra
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('34e208a0-8616-5542-95a3-57691ae695ff', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Anambra', 'AN', 'anambra', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('0b0234cb-af67-509f-be87-34f2a4f18ba0', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Aguata', 'aguata', 'approved'),
  ('a1e6fe18-4cca-53bf-a593-19b1c05a36e0', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Anambra East', 'anambra-east', 'approved'),
  ('115ced36-0683-54eb-b75d-2367d5231f2b', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Anambra West', 'anambra-west', 'approved'),
  ('1f4d1054-0cc0-518e-8304-1de1e43b463a', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Anaocha', 'anaocha', 'approved'),
  ('f02435f0-da69-506e-ae64-aa03dc506ab0', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Awka North', 'awka-north', 'approved'),
  ('c4c848da-d663-56d5-a4ba-155d344a2ef8', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Awka South', 'awka-south', 'approved'),
  ('f9734875-3da0-5792-8aea-ecdfeaac4ed6', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Ayamelum', 'ayamelum', 'approved'),
  ('0435c41f-2e25-5396-9746-48707416e9a2', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Dunukofia', 'dunukofia', 'approved'),
  ('c83a468e-2822-557d-8f9f-362372a2bc55', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Ekwusigo', 'ekwusigo', 'approved'),
  ('c937be95-0115-51b4-802c-8879458a2d25', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Idemili North', 'idemili-north', 'approved'),
  ('725c8682-720e-5e91-83bd-df9618a81ab7', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Idemili south', 'idemili-south', 'approved'),
  ('e1ad814c-8b46-588e-900e-1627d9ae53d1', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Ihiala', 'ihiala', 'approved'),
  ('78e3df52-3b88-54fc-a4bb-89601875defd', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Njikoka', 'njikoka', 'approved'),
  ('53d2731f-32af-597c-a7d6-77ed0a635d58', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Nnewi North', 'nnewi-north', 'approved'),
  ('5f534806-bd2e-5302-abe5-75c0a1523db0', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Nnewi South', 'nnewi-south', 'approved'),
  ('2b3bfe77-9e5e-505d-ae09-63bb87bf42d2', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Ogbaru', 'ogbaru', 'approved'),
  ('84310d12-78ad-58f2-857c-54930fe490f2', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Onitsha North', 'onitsha-north', 'approved'),
  ('bc42142f-dc80-55bf-94fc-bde00498d737', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Onitsha South', 'onitsha-south', 'approved'),
  ('34da0f38-ad1e-5b1d-88f5-423827fbac28', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Orumba North', 'orumba-north', 'approved'),
  ('f41b7df3-6526-5d5b-9dc6-54fe2efd44b9', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Orumba South', 'orumba-south', 'approved'),
  ('14213a00-4a5b-57ba-a892-491fe44303bc', (SELECT id FROM locations WHERE slug = 'anambra'), 'lga', 'Oyi', 'oyi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Bauchi
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('878d177e-aa23-5540-b097-e5f8c425264a', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Bauchi', 'BA', 'bauchi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('d039ba2f-b21c-5b68-a2fd-68bc4a8a911f', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Alkaleri', 'alkaleri', 'approved'),
  ('c1a1f015-b326-5e67-85bb-978c6d3ce6a9', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Bauchi', 'bauchi-2', 'approved'),
  ('7eed4c06-9edc-5491-8226-4890a75f9294', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Bogoro', 'bogoro', 'approved'),
  ('a30cd2cd-a24b-59b8-9929-607329424be0', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Damban', 'damban', 'approved'),
  ('a0f35acb-9301-5f0d-9774-6229fcec68d6', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Darazo', 'darazo', 'approved'),
  ('72f091f1-c278-5ee2-8e6b-3023659f17ff', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Dass', 'dass', 'approved'),
  ('74371dd8-aff6-5b9d-b332-a900a091395c', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Gamawa', 'gamawa', 'approved'),
  ('e7585aa1-0ff9-5c4a-8eb3-9f7344e3554a', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Ganjuwa', 'ganjuwa', 'approved'),
  ('05a41dff-a3cd-56eb-8d3e-c68e14776b0e', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Giade', 'giade', 'approved'),
  ('8fe36bb0-489f-54d8-9608-62d6501e3898', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Itas/Gadau', 'itas-gadau', 'approved'),
  ('7b1876fa-23c2-56b7-9cfd-e0c39b8cdc4d', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Jama''are', 'jama-are', 'approved'),
  ('b122b980-6f46-5e49-901f-fcfcae7e7d9a', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Katagum', 'katagum', 'approved'),
  ('47019c79-cc70-5934-b244-589abd16585e', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Kirfi', 'kirfi', 'approved'),
  ('4718c739-5686-54e7-88bb-f9569b2f933d', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Misau', 'misau', 'approved'),
  ('810aabf9-4769-5847-9c88-277b1ca20f88', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Ningi', 'ningi', 'approved'),
  ('02cffa44-d2e2-564e-8732-491583af767a', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Shira', 'shira', 'approved'),
  ('2ee95543-6e44-55a3-8f8d-97aca8fe5b2a', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Tafawa Balewa', 'tafawa-balewa', 'approved'),
  ('985bf756-3a69-5356-b141-138614ba39c9', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Toro', 'toro', 'approved'),
  ('7e9dc2db-7073-594f-b790-06d6eebaa835', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Warji', 'warji', 'approved'),
  ('f27d09cd-fb5a-5edc-94c9-b5f54aca3e1a', (SELECT id FROM locations WHERE slug = 'bauchi'), 'lga', 'Zaki', 'zaki', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Bayelsa
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('a6c906ea-b7e1-54b4-a789-92cea4a55fb1', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Bayelsa', 'BY', 'bayelsa', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('5a265a06-9119-5843-bbd1-4350d1b9a54e', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Brass', 'brass', 'approved'),
  ('56c421fe-b716-5cca-92aa-ea97a90f3feb', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Ekeremor', 'ekeremor', 'approved'),
  ('920cfa74-165e-5833-8578-77b68c9759d9', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Kolokuma/Opokuma', 'kolokuma-opokuma', 'approved'),
  ('628c87eb-6672-5954-a110-388c82d19880', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Nembe', 'nembe', 'approved'),
  ('2066174a-1299-5976-8987-5ecf1dd4694e', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Ogbia', 'ogbia', 'approved'),
  ('b6b15f99-a9c3-5b32-b5f5-da2c69a0e9fd', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Sagbama', 'sagbama', 'approved'),
  ('eaeda3eb-f1d0-55c1-a0a9-042b20966d95', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Southern Ijaw', 'southern-ijaw', 'approved'),
  ('b8700b63-a64f-5343-9bc5-5601d3ea7834', (SELECT id FROM locations WHERE slug = 'bayelsa'), 'lga', 'Yenagoa', 'yenagoa', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Benue
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('7bf0d542-c3b7-5fc4-be97-9d8d8c5fddaa', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Benue', 'BE', 'benue', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('7992bbcb-9bb6-55b3-a016-67d6497632d2', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Ado', 'ado', 'approved'),
  ('8d1b6532-e2c9-5b6f-9a9b-811f1cb578a0', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Agatu', 'agatu', 'approved'),
  ('342f3b5c-a680-52d8-ade7-30f0594c2462', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Apa', 'apa', 'approved'),
  ('24f8b1c1-5d07-5403-9801-26701343dcc6', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Buruku', 'buruku', 'approved'),
  ('603882fb-ad8e-5fc1-b6a4-c333c7f9f6a4', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Gboko', 'gboko', 'approved'),
  ('bd66a0b8-aeaa-5b17-8cfb-0fe723f22072', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Guma', 'guma', 'approved'),
  ('6e7bb080-feda-535c-baaa-656f4ec32684', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Gwer East', 'gwer-east', 'approved'),
  ('2dfdb334-749c-55bc-98ec-e0717db42c06', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Gwer West', 'gwer-west', 'approved'),
  ('edb19cdd-1950-55c1-93d8-e8a91bace4cf', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Katsina-Ala', 'katsina-ala', 'approved'),
  ('ecd437e6-3c7a-5642-9bbd-77209b275c09', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Konshisha', 'konshisha', 'approved'),
  ('732a0ce6-d12a-514f-a9f1-cade44c2b5e9', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Kwande', 'kwande', 'approved'),
  ('0982f462-8c27-5dc5-99f8-9ed4630b5007', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Logo', 'logo', 'approved'),
  ('61be38a3-95ee-55f6-bf3e-293d745f3b9b', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Makurdi', 'makurdi', 'approved'),
  ('5963a80e-11da-5bbd-89d2-2cfbaf83b374', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Obi', 'benue-obi', 'approved'),
  ('fe6ed121-7f7d-5bb6-9475-b7f937f578c0', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Ogbadibo', 'ogbadibo', 'approved'),
  ('8c9a81ad-9d70-57e9-83c3-939a8f888905', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Ohimini', 'ohimini', 'approved'),
  ('038bb80a-df12-53ba-9ec8-4a0f32a234bb', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Oju', 'oju', 'approved'),
  ('0232d16e-684a-5bda-a40f-137571c7d490', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Okpokwu', 'okpokwu', 'approved'),
  ('3be94b38-0513-551a-b485-6e3d90372368', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Otukpo', 'otukpo', 'approved'),
  ('689ef617-8eeb-5db6-9c93-8196648cdb19', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Tarka', 'tarka', 'approved'),
  ('fb28c369-25e5-5014-b762-e479feeea48e', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Ukum', 'ukum', 'approved'),
  ('a065a3e7-cfb5-5474-b255-6b87a528008d', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Ushongo', 'ushongo', 'approved'),
  ('fd59771e-5af1-5ecd-8827-61ac7833824e', (SELECT id FROM locations WHERE slug = 'benue'), 'lga', 'Vandeikya', 'vandeikya', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Borno
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('cc7eb21f-5d7b-562e-8fc9-d3edb717988a', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Borno', 'BO', 'borno', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('ae22c215-4826-54f2-93e1-e19d559f9f5d', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Abadam', 'abadam', 'approved'),
  ('6cd00dad-4c6d-56d1-9bd3-3558b5481f11', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Askira/Uba', 'askira-uba', 'approved'),
  ('a5a4d3a7-d226-521c-9569-e56fa8fb5d17', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Bama', 'bama', 'approved'),
  ('695dbe7c-eaf2-5176-8d38-0a0484b9c0a7', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Bayo', 'bayo', 'approved'),
  ('c4d500d7-1d0f-5d0a-adae-4d4c092e6a23', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Biu', 'biu', 'approved'),
  ('dc0f906a-c42b-57f8-ab08-e08d733a8541', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Chibok', 'chibok', 'approved'),
  ('99e378d2-be08-506f-ab17-5101aa6abb61', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Damboa', 'damboa', 'approved'),
  ('b96ec188-f752-5b78-9b4b-5b4dc32a38b2', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Dikwa', 'dikwa', 'approved'),
  ('30ae4dfa-932e-5951-9c5f-f108d85ee343', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Gubio', 'gubio', 'approved'),
  ('bbcc897c-0364-5d89-a86e-f95ee7347a06', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Guzamala', 'guzamala', 'approved'),
  ('c61580e8-7ad4-541a-9299-a225a2111e1e', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Gwoza', 'gwoza', 'approved'),
  ('af43916b-520a-5a76-92e7-08cd5362bd48', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Hawul', 'hawul', 'approved'),
  ('b8fe1286-8c3c-5e35-9f21-e274564bdffc', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Jere', 'jere', 'approved'),
  ('4b7fd979-a005-59ed-818a-eda0fb94b4dd', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Kaga', 'kaga', 'approved'),
  ('f92b0efc-2068-513d-a8cc-c73ef5923b80', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Kala/Balge', 'kala-balge', 'approved'),
  ('d42471e9-c884-5963-b932-963d0f8c08f6', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Konduga', 'konduga', 'approved'),
  ('09aea47d-4aa1-5459-a44d-58a8b3b485f8', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Kukawa', 'kukawa', 'approved'),
  ('b9961ab3-57a9-50f2-955a-8c18526372dd', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Kwaya Kusar', 'kwaya-kusar', 'approved'),
  ('c49338e7-74b3-57e1-97b6-51b9e706b1a0', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Mafa', 'mafa', 'approved'),
  ('7ddb6b7f-c7b0-5398-a79b-ef7b797eaece', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Magumeri', 'magumeri', 'approved'),
  ('9d333ee0-ccf5-5bdb-8477-8676bc553191', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Maiduguri', 'maiduguri', 'approved'),
  ('534f509a-08f4-587c-916c-4048ef64437e', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Marte', 'marte', 'approved'),
  ('6ca286bf-3503-52a9-89e9-c79585874867', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Mobbar', 'mobbar', 'approved'),
  ('5aee8ab6-5069-5ca3-a9f5-d06ca55a448f', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Monguno', 'monguno', 'approved'),
  ('0ee59df0-2815-5c35-bd2c-af320302f0e3', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Ngala', 'ngala', 'approved'),
  ('cab5d2f3-565c-5d7b-ad29-e30bee227970', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Nganzai', 'nganzai', 'approved'),
  ('bc9a8506-af61-5ea4-ab8c-1a2f9a21d1da', (SELECT id FROM locations WHERE slug = 'borno'), 'lga', 'Shani', 'shani', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Cross River
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('1246ea20-5ea3-5b4e-9419-e83b3eb952dc', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Cross River', 'CR', 'cross-river', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('e1458bf1-4d50-5961-890b-da532e0b94e7', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Abi', 'abi', 'approved'),
  ('cfebc615-3545-50b0-9c61-9ed05df28ba5', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Akamkpa', 'akamkpa', 'approved'),
  ('76d98e80-2132-5d1d-9ff5-f93636642786', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Akpabuyo', 'akpabuyo', 'approved'),
  ('fc2d5c51-6066-5a28-bcab-deda36a60359', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Bakassi', 'bakassi', 'approved'),
  ('f6733834-3c58-5488-b46a-824cfc08ee7c', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Bekwarra', 'bekwarra', 'approved'),
  ('e0c30a38-31d1-564c-a1d6-b344cc1b0fa4', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Biase', 'biase', 'approved'),
  ('f5caf761-0367-5d94-a088-d84944b08a81', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Boki', 'boki', 'approved'),
  ('7efb1a59-2c1f-57f5-bfb4-cf334da87b92', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Calabar Municipal', 'calabar-municipal', 'approved'),
  ('1293da0b-20cc-5d73-bc30-92a2f0fd70aa', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Calabar South', 'calabar-south', 'approved'),
  ('81aa37c2-39ae-5d0d-b397-706b0adc8c8a', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Etung', 'etung', 'approved'),
  ('62847af2-cbd8-5d11-84f4-47dd0fbf1f3c', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Ikom', 'ikom', 'approved'),
  ('70872a93-1baf-564b-9f32-bc0b81db097c', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Obanliku', 'obanliku', 'approved'),
  ('019ae399-c0be-5ad7-aee1-2f3601014d78', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Obubra', 'obubra', 'approved'),
  ('ab325338-04d7-580b-9535-53dcb5f1e627', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Obudu', 'obudu', 'approved'),
  ('1a208ed6-17c4-57d6-9613-e4baf90f552c', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Odukpani', 'odukpani', 'approved'),
  ('e88dabb9-5a20-5789-b429-b1ebe496d973', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Ogoja', 'ogoja', 'approved'),
  ('f5cf4b14-1065-5ebb-85d6-dbbcaa968ad1', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Yakuur', 'yakuur', 'approved'),
  ('d7bf3e2e-48f1-54ab-95d4-c1cfca72c333', (SELECT id FROM locations WHERE slug = 'cross-river'), 'lga', 'Yala', 'yala', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Delta
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('9efe16c7-c816-5ca0-a9c6-df6c34889da4', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Delta', 'DE', 'delta', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('ab8c2d61-bc74-5b14-98a7-5e16a39198e9', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Aniocha North', 'aniocha-north', 'approved'),
  ('1e0ac123-5b6e-5bfb-9095-3202ad0f9e00', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Aniocha South', 'aniocha-south', 'approved'),
  ('36cd2753-9a8a-5674-a7bc-aaf3fe609e75', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Bomadi', 'bomadi', 'approved'),
  ('1e0dbf4f-9ded-5a17-84c5-d9840e4b0f2c', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Burutu', 'burutu', 'approved'),
  ('170b023d-649c-5a1a-8422-42250499b079', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ethiope East', 'ethiope-east', 'approved'),
  ('65ae2d9d-bcaa-5d9b-ad79-57a2faaca47c', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ethiope West', 'ethiope-west', 'approved'),
  ('d73fe279-4281-536d-bd5e-6acbc272f176', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ika North East', 'ika-north-east', 'approved'),
  ('eb053065-4092-546c-a897-577f2e6cbaee', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ika South', 'ika-south', 'approved'),
  ('26ba5c01-8759-5cbd-a3e9-0ba160016304', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Isoko North', 'isoko-north', 'approved'),
  ('7b2e3533-ecc8-5021-82ac-fff86c21bdda', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Isoko South', 'isoko-south', 'approved'),
  ('6092efb3-14da-5a3f-b24f-984611a48fb6', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ndokwa East', 'ndokwa-east', 'approved'),
  ('762277bf-2fd1-53e1-aba1-9cb52013fe35', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ndokwa West', 'ndokwa-west', 'approved'),
  ('fae7df18-297d-59b3-853b-e727de75a64c', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Okpe', 'okpe', 'approved'),
  ('9ff15a2a-8cf4-519a-a7b7-0e99ab34251c', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Oshimili North', 'oshimili-north', 'approved'),
  ('0c3c7c9d-1cb9-55ae-9783-3c636a0f4a01', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Oshimili South', 'oshimili-south', 'approved'),
  ('5ae7a568-cd6a-5724-a8f3-47e6e2bcd09f', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Patani', 'patani', 'approved'),
  ('d26a9cc0-bc97-59e3-bcee-4008ba30a3d7', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Sapele', 'sapele', 'approved'),
  ('de2a9c70-83e3-5b1b-aa89-067d88d835e8', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Udu', 'udu', 'approved'),
  ('33f8bca5-e725-5fa2-9450-6d812333afe4', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ughelli North', 'ughelli-north', 'approved'),
  ('7bf26579-65b5-5852-84cd-59ea13c0ad11', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ughelli South', 'ughelli-south', 'approved'),
  ('3b27b47d-7fa4-53d2-86a0-e62116e9c6ef', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Ukwuani', 'ukwuani', 'approved'),
  ('a81767df-191c-5d5b-b624-908653baed99', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Uvwie', 'uvwie', 'approved'),
  ('61177755-b8ca-54af-b72c-e9514fccb814', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Warri North', 'warri-north', 'approved'),
  ('bf9a9917-a8b8-5532-a0b1-248c6ad8fd69', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Warri South', 'warri-south', 'approved'),
  ('4a33e378-c265-57f3-aa1c-1b9a84429c9c', (SELECT id FROM locations WHERE slug = 'delta'), 'lga', 'Warri South West', 'warri-south-west', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Ebonyi
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('8ca18e03-d53a-57dd-bc67-671545292e54', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Ebonyi', 'EB', 'ebonyi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('5c018dbe-1497-5793-ab99-59f2b4228df9', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Abakaliki', 'abakaliki', 'approved'),
  ('e2366687-1dbb-586b-b722-61e31dcab53f', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Afikpo North', 'afikpo-north', 'approved'),
  ('5acb2cc4-1309-546a-9717-1f1fb686536a', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Afikpo South', 'afikpo-south', 'approved'),
  ('93cc6a05-3320-5e47-a76e-efed028af15f', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ebonyi', 'ebonyi-2', 'approved'),
  ('4959fc9d-0f2d-5144-b3f5-3191d659100a', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ezza North', 'ezza-north', 'approved'),
  ('6d68fb02-293a-5fd6-af66-739b1f6f43cd', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ezza South', 'ezza-south', 'approved'),
  ('83c50ce2-8fe2-56d6-9731-f9e7c93bf6cf', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ikwo', 'ikwo', 'approved'),
  ('be23d4d8-4ad7-5259-9e68-2aeba3c094f7', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ishielu', 'ishielu', 'approved'),
  ('c88101ac-b9cf-5fb6-9a6d-e944c2844f7a', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ivo', 'ivo', 'approved'),
  ('5594c9fc-7d0c-5406-9c56-5adb301c926e', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Izzi', 'izzi', 'approved'),
  ('5ebd716d-64b3-54b7-8fd9-7e5396c4655e', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ohaozara', 'ohaozara', 'approved'),
  ('a72d1525-325a-5387-b4c6-a7dca22c0f86', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Ohaukwu', 'ohaukwu', 'approved'),
  ('cbba1502-46aa-5884-b499-d7122c19f2e2', (SELECT id FROM locations WHERE slug = 'ebonyi'), 'lga', 'Onicha', 'onicha', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Edo
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('864e1d53-d2f2-513f-b2c7-cdbd97718702', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Edo', 'ED', 'edo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('4402ae3a-e7d5-5684-ba5b-ebc838465cc5', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Akoko-Edo', 'akoko-edo', 'approved'),
  ('0ba5dbf4-d278-5f3a-8e85-111d1d5994af', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Egor', 'egor', 'approved'),
  ('5d11e6b9-22fc-540e-84c7-497a76078100', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Esan Central', 'esan-central', 'approved'),
  ('c1e06561-ba7a-5c04-9651-fbbd0be4ce74', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Esan North-East', 'esan-north-east', 'approved'),
  ('bdc645eb-8e4a-5cf6-a46e-6309b70bd477', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Esan South-East', 'esan-south-east', 'approved'),
  ('9fad9e7a-14af-5f82-934e-fd547d83d334', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Esan West', 'esan-west', 'approved'),
  ('899b7518-e5bb-5539-80ef-d24dd0586984', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Etsako Central', 'etsako-central', 'approved'),
  ('b6df6794-8794-5b96-af04-4d5cdbf9d688', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Etsako East', 'etsako-east', 'approved'),
  ('2c716c54-ebd3-5144-a86d-7339579b1ba7', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Etsako West', 'etsako-west', 'approved'),
  ('4c70d9ed-5517-5e2e-a4ad-0583e59a9181', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Igueben', 'igueben', 'approved'),
  ('98480b00-e72e-5f46-8d4d-0c1597213336', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Ikpoba Okha', 'ikpoba-okha', 'approved'),
  ('1f10670a-feb1-5e97-9ae7-7865cfdfe46c', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Orhionmwon', 'orhionmwon', 'approved'),
  ('450e2f04-f13e-5287-938b-172b52829ddd', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Oredo', 'oredo', 'approved'),
  ('2ecc81b6-bae1-521b-8691-86fc74f990ff', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Ovia North-East', 'ovia-north-east', 'approved'),
  ('b5125ec4-a97d-5f0d-bfcb-ab618f8a2552', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Ovia South-West', 'ovia-south-west', 'approved'),
  ('963e0e06-a3af-5fea-bd00-27511632f299', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Owan East', 'owan-east', 'approved'),
  ('caaeb41f-e277-59e7-b01d-e4ace063daa6', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Owan West', 'owan-west', 'approved'),
  ('bf42c360-ae6c-5ce5-a858-99545b086533', (SELECT id FROM locations WHERE slug = 'edo'), 'lga', 'Uhunmwonde', 'uhunmwonde', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Ekiti
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('ca324f35-d416-597b-ac99-875607513ad5', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Ekiti', 'EK', 'ekiti', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('003a7c36-c836-50c5-b644-21f6beef7f34', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ado-Ekiti', 'ado-ekiti', 'approved'),
  ('9bca954b-5f87-501d-a90b-e40f8fe9ba1c', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Efon', 'efon', 'approved'),
  ('0af1874a-ff86-5fa9-98bc-fad2222968c9', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ekiti East', 'ekiti-east', 'approved'),
  ('03c32c39-c118-5499-86e9-3f554fc6e85c', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ekiti South-West', 'ekiti-south-west', 'approved'),
  ('7c4d2c08-5e70-5c15-acea-6202bf06e668', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ekiti West', 'ekiti-west', 'approved'),
  ('81c8201a-ffff-5eb3-9219-528ac0acb7e0', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Emure', 'emure', 'approved'),
  ('0e469c7b-644a-598a-b649-c98844555162', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Gbonyin', 'gbonyin', 'approved'),
  ('68e624a0-1e10-585a-b443-8febabab9928', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ido-Osi', 'ido-osi', 'approved'),
  ('9b87e572-dbed-5d69-88d2-9a5747e02481', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ijero', 'ijero', 'approved'),
  ('59c7b641-1726-5260-b0ac-08b20e65c4fd', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ikere', 'ikere', 'approved'),
  ('1eb108d4-e6c9-5e1d-a165-9b77b7782f38', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ikole', 'ikole', 'approved'),
  ('f5ef23ca-2118-516e-b59e-56d322dc920c', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ilejemeje', 'ilejemeje', 'approved'),
  ('2f59748c-11e5-5726-a238-935424bc9f20', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Irepodun/Ifelodun', 'irepodun-ifelodun', 'approved'),
  ('d747628f-a0af-5cc1-8351-8b00dd989896', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Ise/Orun', 'ise-orun', 'approved'),
  ('16f32d8d-41f5-53e1-9372-5a00d5310da3', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Moba', 'moba', 'approved'),
  ('84a6d681-e99f-5719-ac24-b9a1e22b31af', (SELECT id FROM locations WHERE slug = 'ekiti'), 'lga', 'Oye', 'oye', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Enugu
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('af49817b-6b04-558f-938a-c70ef2550cf4', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Enugu', 'EN', 'enugu', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('aa2cf1e9-a18d-57b6-955d-34eb9baa7836', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Aninri', 'aninri', 'approved'),
  ('237306d1-1788-5ed0-909c-c499e1b95932', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Awgu', 'awgu', 'approved'),
  ('9aab66ba-cceb-59c8-88a4-2883e118c885', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Enugu East', 'enugu-east', 'approved'),
  ('d8ab3904-4e1b-5df9-aa86-703d4529febe', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Enugu North', 'enugu-north', 'approved'),
  ('383f3929-2530-58f7-8ee5-47599367d4a0', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Enugu South', 'enugu-south', 'approved'),
  ('2ba8edbd-3b09-5dbb-ae58-c570d72b98c8', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Ezeagu', 'ezeagu', 'approved'),
  ('0c8c5f00-e103-5d17-8576-455e8db6d89e', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Igbo Etiti', 'igbo-etiti', 'approved'),
  ('faac4b60-5667-5955-9b5a-e4ea9684eb6d', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Igbo Eze North', 'igbo-eze-north', 'approved'),
  ('6351f075-f553-524f-b0a0-5662f9782441', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Igbo Eze South', 'igbo-eze-south', 'approved'),
  ('090697f5-9703-558a-98b8-113a76a73453', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Isi Uzo', 'isi-uzo', 'approved'),
  ('01ac9482-49bd-5b03-b2c5-2d3e2965e091', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Nkanu East', 'nkanu-east', 'approved'),
  ('9ff64c79-987a-5548-9696-4d5a65fc9ac5', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Nkanu West', 'nkanu-west', 'approved'),
  ('fd724cf4-b445-5e15-bf64-a8c5a5c5c5be', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Nsukka', 'nsukka', 'approved'),
  ('312a4518-a402-5ad5-b631-cd8b91b1a60b', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Oji River', 'oji-river', 'approved'),
  ('7b938490-4af4-53af-90cc-8b2c40fc5678', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Udenu', 'udenu', 'approved'),
  ('c91f3f4d-21e7-5340-9f93-3d04a4a00783', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Udi', 'udi', 'approved'),
  ('cf0013af-b84f-5fd8-9b0e-8e11380b8af5', (SELECT id FROM locations WHERE slug = 'enugu'), 'lga', 'Uzo-Uwani', 'uzo-uwani', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Federal Capital Territory
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('fbfc5845-9e66-54ce-92cc-62c332535303', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Federal Capital Territory', 'FC', 'abuja-fct', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('4c0349c4-8d15-5deb-8e56-0fc37eafc080', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Abaji', 'abaji', 'approved'),
  ('dc430e7e-9ed6-5284-b27e-a5f41fad33fb', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Bwari', 'bwari', 'approved'),
  ('642a0ecd-52dd-57e4-b6ae-7191875d3f27', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Gwagwalada', 'gwagwalada', 'approved'),
  ('11c7ccff-071b-56c8-bdf5-3c195fd62d8a', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Kuje', 'kuje', 'approved'),
  ('5d1e78f2-7a5e-5e7c-9cae-2855394fdd0a', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Kwali', 'kwali', 'approved'),
  ('d8d3d727-0ad0-55d5-b70d-5f35f71ffd7b', (SELECT id FROM locations WHERE slug = 'abuja-fct'), 'lga', 'Municipal Area Council', 'municipal', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Gombe
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('d89a4f44-8beb-5d3a-8c0a-4eb5d0d014ba', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Gombe', 'GO', 'gombe', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('aa83ab4e-6ff0-5565-82a1-37975e9defb6', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Akko', 'akko', 'approved'),
  ('d35cc288-68b7-5b8e-8abd-4eb98c941673', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Balanga', 'balanga', 'approved'),
  ('818acfa6-526b-51bd-8c06-e280dc5c0107', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Billiri', 'billiri', 'approved'),
  ('a337fe6a-4ac9-52bb-b720-db7cf72999fa', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Dukku', 'dukku', 'approved'),
  ('98819304-3a58-5da6-b557-9b7165e0bc8c', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Funakaye', 'funakaye', 'approved'),
  ('edf3f84b-55a5-56b6-88c2-74f6c0df4cdb', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Gombe', 'gombe-2', 'approved'),
  ('089b24ae-7fa7-580c-95b8-288070b1322e', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Kaltungo', 'kaltungo', 'approved'),
  ('f9fbae46-8f0b-5be4-833a-8c89574253de', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Kwami', 'kwami', 'approved'),
  ('ce11354a-c999-5018-b9bc-df90c9002557', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Nafada', 'nafada', 'approved'),
  ('9537c5d2-40fd-57a1-b113-b29d57e75e62', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Shongom', 'shongom', 'approved'),
  ('b396ab18-2fce-53fc-95f9-8d264a913d0f', (SELECT id FROM locations WHERE slug = 'gombe'), 'lga', 'Yamaltu/Deba', 'yamaltu-deba', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Imo
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('52cd3a9f-a022-50ea-ad05-1fae717563a0', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Imo', 'IM', 'imo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('96b81d1d-759f-573e-ac46-b9c743e71d3b', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Aboh Mbaise', 'aboh-mbaise', 'approved'),
  ('852c4921-68a4-5ff9-ac09-2f3187a55c09', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ahiazu Mbaise', 'ahiazu-mbaise', 'approved'),
  ('470e5987-8bfa-5cd7-88ea-2223c1e9baf7', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ehime Mbano', 'ehime-mbano', 'approved'),
  ('dda382a4-9bba-57e3-bf99-cd807b62e042', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ezinihitte', 'ezinihitte', 'approved'),
  ('8a693266-2826-510f-8e32-9f1cdac2e602', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ideato North', 'ideato-north', 'approved'),
  ('8c8d494f-7433-55e3-a93e-cc41d6d0ee62', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ideato South', 'ideato-south', 'approved'),
  ('ba5bdada-53d2-57e5-9bd2-50b87de19c7b', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ihitte/Uboma', 'ihitte-uboma', 'approved'),
  ('6ec60202-cf12-5efc-9f3f-a086cc2e3750', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ikeduru', 'ikeduru', 'approved'),
  ('39e5af83-e2c3-5084-b2eb-5ac7d3960751', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Isiala Mbano', 'isiala-mbano', 'approved'),
  ('e6467a4d-effc-5ae6-baeb-17de7707f876', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Isu', 'isu', 'approved'),
  ('ca8161ff-c467-505c-8d86-5e4a225fde7b', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Mbaitoli', 'mbaitoli', 'approved'),
  ('2a53149d-19bd-55f4-baf5-d72d4eec28b1', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ngor Okpala', 'ngor-okpala', 'approved'),
  ('09946427-ed89-534b-a551-b3f64135ccec', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Njaba', 'njaba', 'approved'),
  ('5aa618f6-59c5-5040-a682-e0dc95d138cd', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Nkwerre', 'nkwerre', 'approved'),
  ('d223d928-70b2-5030-84bb-f24871b6977b', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Nwangele', 'nwangele', 'approved'),
  ('8d6e2643-0398-599c-ac2b-05769c64bda2', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Obowo', 'obowo', 'approved'),
  ('5fd4d261-224e-5139-b752-395966391d1c', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Oguta', 'oguta', 'approved'),
  ('df80dd94-d5f6-5cda-bd72-c5c63b141cba', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Ohaji/Egbema', 'ohaji-egbema', 'approved'),
  ('e9c93552-2f8b-5a4c-90d9-fb78f9a2bb5f', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Okigwe', 'okigwe', 'approved'),
  ('f01088c8-ddc0-5eae-8406-4a07c343d654', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Orlu', 'orlu', 'approved'),
  ('180a8a06-aa55-5a58-b52f-5fa10ea05605', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Orsu', 'orsu', 'approved'),
  ('79e22e1c-f6b5-5ba4-8938-249a9bf11f8d', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Oru East', 'oru-east', 'approved'),
  ('76fea84e-4115-5f4b-80e2-95b4b3648efd', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Oru West', 'oru-west', 'approved'),
  ('6393fcce-abe4-54e8-bb8e-7a195d4876a3', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Owerri Municipal', 'owerri-municipal', 'approved'),
  ('c6c5d64c-5d60-51ab-9e30-6f01a6d2f946', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Owerri North', 'owerri-north', 'approved'),
  ('636676ef-50dd-50a7-ba3d-db07e37dc8bd', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Owerri West', 'owerri-west', 'approved'),
  ('d2205510-8c8a-56e4-a845-244ed5fbdc4b', (SELECT id FROM locations WHERE slug = 'imo'), 'lga', 'Unuimo', 'unuimo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Jigawa
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('4c2f4285-6d13-5a97-a40c-9f47b298b7a8', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Jigawa', 'JI', 'jigawa', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('a4806c34-0937-5ae6-968a-c99c7d97016f', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Auyo', 'auyo', 'approved'),
  ('cb2291d4-a63e-5a4a-9061-35482c739810', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Babura', 'babura', 'approved'),
  ('6b541dca-a921-5885-9e13-b02f9c872844', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Birni Kudu', 'birni-kudu', 'approved'),
  ('8f7711c5-0f2a-5776-ba4e-7331a0a540d9', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Biriniwa', 'biriniwa', 'approved'),
  ('29f22257-ff35-5ac1-a905-e5170f8dda6f', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Buji', 'buji', 'approved'),
  ('670729d8-edfa-5d74-811c-ae0e262eb113', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Dutse', 'dutse', 'approved'),
  ('1584ed69-2f2b-596d-b1e9-d78ebfa98694', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Gagarawa', 'gagarawa', 'approved'),
  ('297a17f0-0250-5196-bcd0-01517692695d', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Garki', 'garki', 'approved'),
  ('133b5dd4-6d84-5332-850e-448f2c6e36de', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Gumel', 'gumel', 'approved'),
  ('f2888424-3e2b-550e-afea-494f41602bb9', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Guri', 'guri', 'approved'),
  ('ba21b800-bb99-5927-8cbf-9bb0a2dbfae7', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Gwaram', 'gwaram', 'approved'),
  ('040a9271-7978-5bb5-be9f-1f1dad6a9656', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Gwiwa', 'gwiwa', 'approved'),
  ('0efa4c2c-8718-5266-b144-a3f7e3f8660f', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Hadejia', 'hadejia', 'approved'),
  ('95c865d4-ff14-5997-8dc5-c42d851ae161', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Jahun', 'jahun', 'approved'),
  ('3826b8d1-97a9-592e-afa6-45fb0de03939', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Kafin Hausa', 'kafin-hausa', 'approved'),
  ('b52d23d9-cee3-530c-b9e7-c5b56dab2898', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Kaugama Kazaure', 'kaugama-kazaure', 'approved'),
  ('4644b108-c596-5ec0-ae52-209aaf0fa872', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Kiri Kasamma', 'kiri-kasamma', 'approved'),
  ('f88463be-76a8-5d22-8a1a-40372dc58f65', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Kiyawa', 'kiyawa', 'approved'),
  ('ebb40cc7-f8aa-5120-b882-d1f3ceb19eb7', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Maigatari', 'maigatari', 'approved'),
  ('942ece7e-1f38-5a03-aca4-5dbbbeb5e394', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Malam Madori', 'malam-madori', 'approved'),
  ('0b30bc87-1eb8-5440-8fe2-43d7ac72f4a4', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Miga', 'miga', 'approved'),
  ('3cb56aed-675c-583c-9508-05a0e081c495', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Ringim', 'ringim', 'approved'),
  ('6c9e2069-c0fa-52c8-92e8-07226b1f5e55', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Roni', 'roni', 'approved'),
  ('086c47ad-a7df-54e5-97a0-07776f478829', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Sule-Tankarkar', 'sule-tankarkar', 'approved'),
  ('5a4f3995-38be-52b2-974d-f1eb7bc62653', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Taura', 'taura', 'approved'),
  ('45a3481d-426a-580e-bbd6-e0a866c335f0', (SELECT id FROM locations WHERE slug = 'jigawa'), 'lga', 'Yankwashi', 'yankwashi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Kaduna
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('596a9533-e30d-5a7e-bd56-ebe5b3e1bb95', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Kaduna', 'KD', 'kaduna', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('b077949c-f7d9-5c81-a3cb-a5ce28b75ad3', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Birnin Gwari', 'birnin-gwari', 'approved'),
  ('940e2735-8e2f-57ef-9dea-5a2b135b9712', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Chikun', 'chikun', 'approved'),
  ('af3a4cb7-eb1c-5a57-8a64-38af1f4b15f6', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Giwa', 'giwa', 'approved'),
  ('cb331c46-1c1e-571c-a60b-a1d8b6b8ae75', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Igabi', 'igabi', 'approved'),
  ('47931020-2604-5cf5-a5d0-1ee4745c87dc', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Ikara', 'ikara', 'approved'),
  ('a4337603-fb58-575d-b060-ecd9793ebb1d', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Jaba', 'jaba', 'approved'),
  ('ae34c01f-9bfa-51b2-acb7-efd0b9e3474d', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Jema''a', 'jema-a', 'approved'),
  ('8342fae0-fdc2-5d53-89a2-86d430b801bf', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kachia', 'kachia', 'approved'),
  ('c0fd4604-f7a8-5d60-aa1d-44fc00c983a2', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kaduna North', 'kaduna-north', 'approved'),
  ('2e1b9221-61d2-53d5-88ad-a48ac70c0c25', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kaduna South', 'kaduna-south', 'approved'),
  ('dfe8f5b0-62b8-52e1-a133-6dc1b824b5d9', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kagarko', 'kagarko', 'approved'),
  ('4860d799-1955-55e0-a564-c7bcde352a9f', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kajuru', 'kajuru', 'approved'),
  ('a0863a76-bacc-578f-966c-159321efb50c', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kaura', 'kaduna-kaura', 'approved'),
  ('07281372-d2c2-591b-8629-57dfa8ef925b', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kauru', 'kauru', 'approved'),
  ('1da2ce29-351c-52d3-bbe6-1334f1b1f328', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kubau', 'kubau', 'approved'),
  ('a8794b06-1ac6-553e-ad73-b04ea073e32a', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Kudan', 'kudan', 'approved'),
  ('0aff46e1-3264-5274-a2f6-109f5f20ad63', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Lere', 'lere', 'approved'),
  ('e54aecd0-d86a-5d29-90c3-2f61520ac645', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Makarfi', 'makarfi', 'approved'),
  ('cf88e9f1-3d9b-53e1-be20-3e7871d749aa', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Sabon Gari', 'sabon-gari', 'approved'),
  ('cdf8b702-c17e-5e76-bb02-d9afe7d55e17', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Sanga', 'sanga', 'approved'),
  ('372790a7-5ae8-52e6-9a9e-ce9279fa0f12', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Soba', 'soba', 'approved'),
  ('880719ad-ed8c-5c7e-8dc9-29ca249f2839', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Zangon Kataf', 'zangon-kataf', 'approved'),
  ('5ff67311-d4b7-598c-af8f-7efddb7cb596', (SELECT id FROM locations WHERE slug = 'kaduna'), 'lga', 'Zaria', 'zaria', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Kano
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('bd15d53f-5777-587a-8d93-469c6b58cfa3', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Kano', 'KN', 'kano', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('da150def-19eb-5719-bffd-03d5b73db72b', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Ajingi', 'ajingi', 'approved'),
  ('e71ac957-e400-5f1a-b426-afb592842dec', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Albasu', 'albasu', 'approved'),
  ('8cf23dac-7df7-5980-9e6a-4d47f3250f59', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Bagwai', 'bagwai', 'approved'),
  ('d51d54a5-9ee5-5f22-bdc0-0ab8a8db1440', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Bebeji', 'bebeji', 'approved'),
  ('1b397dd4-1fac-5cba-8970-7b6f4e62910c', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Bichi', 'bichi', 'approved'),
  ('d0c0b1d3-3a62-5afc-98fa-acff6e6d1cad', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Bunkure', 'bunkure', 'approved'),
  ('d5f94541-222f-53c3-9c3d-1ae5744d3d94', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Dala', 'dala', 'approved'),
  ('9300045d-9a6a-56e9-8418-53752c4d79a4', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Dambatta', 'dambatta', 'approved'),
  ('e8bb2431-9bce-50a2-84d5-55d32fbb9fab', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Dawakin Kudu', 'dawakin-kudu', 'approved'),
  ('88393219-e541-515d-a257-33f2d66ade0c', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Dawakin Tofa', 'dawakin-tofa', 'approved'),
  ('ea553ef6-0d19-598a-9b88-f242deacf00f', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Doguwa', 'doguwa', 'approved'),
  ('a7bb896f-61cf-5f90-b937-396773333e13', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Fagge', 'fagge', 'approved'),
  ('cb04b402-658c-54e0-9c58-04e9d3fa46d3', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Gabasawa', 'gabasawa', 'approved'),
  ('f28c0985-a0d6-5f8a-93c4-aed1e7bf0837', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Garko', 'garko', 'approved'),
  ('61e40d98-b199-5bcf-9a4e-c8ec5de91e9f', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Garum', 'garum', 'approved'),
  ('edc62e1f-b37e-5918-93b2-23b357be4450', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Mallam', 'mallam', 'approved'),
  ('3ad99d05-f0c8-5178-a6db-3bd803104c85', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Gaya', 'gaya', 'approved'),
  ('7a81c97b-20dd-5cc8-801a-dc865902427b', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Gezawa', 'gezawa', 'approved'),
  ('bdcc887a-81c3-5bbf-8b36-a229c3557abf', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Gwale', 'gwale', 'approved'),
  ('524ae5b8-3990-5470-8902-5c98c701a2b3', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Gwarzo', 'gwarzo', 'approved'),
  ('0eaf3b4f-f57e-56c2-8aaf-2e01a867684b', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Kabo', 'kabo', 'approved'),
  ('be9faa44-7919-5aee-a2c4-46c11722f5e3', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Kano Municipal', 'kano-municipal', 'approved'),
  ('86499b18-38de-5561-a2a8-1d6f13346fe1', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Karaye', 'karaye', 'approved'),
  ('cbd48663-deb5-5380-8a3e-ef2422cfd018', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Kibiya', 'kibiya', 'approved'),
  ('c9278b69-04a8-5eca-9208-7c0f8e97e7dd', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Kiru', 'kiru', 'approved'),
  ('39bc5257-0a7f-5cb2-9464-c646caebc3ce', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'kumbotso', 'kumbotso', 'approved'),
  ('1dd01426-bf1f-5325-a6f5-96b7c0cd9dbe', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Ghari', 'ghari', 'approved'),
  ('636e1038-b375-5935-a4bd-f8e0bc5b6b71', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Kura', 'kura', 'approved'),
  ('0de845dd-c091-5ab1-b6e5-4e9f9fb5298b', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Madobi', 'madobi', 'approved'),
  ('d7ce92a2-8682-531e-babb-b7cf358805a1', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Makoda', 'makoda', 'approved'),
  ('5852a1b7-8668-5254-b1cb-4e1898806055', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Minjibir', 'minjibir', 'approved'),
  ('451c5acb-fe54-5cd1-83f4-cf56f9dc5bdf', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Nasarawa', 'kano-nasarawa', 'approved'),
  ('7cac927d-8bc7-58e7-bce9-38193cd74a3d', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Rano', 'rano', 'approved'),
  ('27dd04f1-3ff1-5b46-88ef-dfaa1f665449', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Rimin Gado', 'rimin-gado', 'approved'),
  ('e2eef668-f4ce-5f9d-a93a-bfea08384949', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Rogo', 'rogo', 'approved'),
  ('ac68e844-4086-54f7-975a-47b1a8b577bd', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Shanono', 'shanono', 'approved'),
  ('ffba8c7a-8e34-58fd-84ad-810dbe9b6524', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Sumaila', 'sumaila', 'approved'),
  ('7c6c602e-8e45-518e-af73-9fb523c6446e', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Takali', 'takali', 'approved'),
  ('12569777-9006-5aa1-94d6-3c4e5af67021', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Tarauni', 'tarauni', 'approved'),
  ('54f247b1-e482-57c6-892a-226fa2142204', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Tofa', 'tofa', 'approved'),
  ('d6a9f7f2-91f6-58a4-bd0f-daaaa41286ba', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Tsanyawa', 'tsanyawa', 'approved'),
  ('78c9048d-1768-5a06-ab78-1be99c37f560', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Tudun Wada', 'tudun-wada', 'approved'),
  ('d0ef07a8-b6a1-575d-9164-1c7415f603d8', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Ungogo', 'ungogo', 'approved'),
  ('d1bcd8c6-6070-50c8-b9d6-eaca23137c91', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Warawa', 'warawa', 'approved'),
  ('bb423e04-ad5a-54c0-b6bb-b2e30939594d', (SELECT id FROM locations WHERE slug = 'kano'), 'lga', 'Wudil', 'wudil', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Katsina
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('2c3943ff-37a2-5300-a416-959d1e8ef3a9', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Katsina', 'KT', 'katsina', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('ba436c2e-1779-5f38-a36d-00003170688b', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Bakori', 'bakori', 'approved'),
  ('48a03fa4-2a3a-5b9d-9059-04d3c4738dae', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Batagarawa', 'batagarawa', 'approved'),
  ('b3995aca-7541-5bc8-8751-c7c3db06cdde', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Batsari', 'batsari', 'approved'),
  ('0d6a2d7d-26c2-58ff-ae75-fc4bd2686077', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Baure', 'baure', 'approved'),
  ('2a672f7e-8bdf-5af3-b4a2-23b14b86c361', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Bindawa', 'bindawa', 'approved'),
  ('167e227c-422c-55a2-a107-5193ced97fd7', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Charanchi', 'charanchi', 'approved'),
  ('19bfa2bd-6dfc-5958-a5fb-60c6a184719a', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Dandume', 'dandume', 'approved'),
  ('8ea1f2d1-4b7c-54e8-aea3-8cc20f8eadc6', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Danja', 'danja', 'approved'),
  ('f4507633-647b-5875-bf7e-cb833fa70307', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Dan Musa', 'dan-musa', 'approved'),
  ('5f3c9b7f-d28c-52a2-91d6-ef138f6059c1', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Daura', 'daura', 'approved'),
  ('a29316ea-5b9f-5ebd-a4c2-d65c230ab4c7', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Dutsi', 'dutsi', 'approved'),
  ('518451a5-b7ba-5167-8b63-1f06a87422dc', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Dutsin-Ma', 'dutsin-ma', 'approved'),
  ('6251cad3-d63c-50fe-ba8c-6ad6cb458a6b', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Faskari', 'faskari', 'approved'),
  ('b7e338bd-3570-5d7a-8aa3-e663173a751d', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Funtua', 'funtua', 'approved'),
  ('9bf444b1-e537-5cc1-8f58-770f89506dad', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Ingawa', 'ingawa', 'approved'),
  ('8c4c4b30-7142-5cc8-80cd-bb48438aa1bd', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Jibia', 'jibia', 'approved'),
  ('88d022c5-73bd-58c4-b79d-e46aea4b242e', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kafur', 'kafur', 'approved'),
  ('444f7659-babc-556d-874d-8ef425e3845c', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kaita', 'kaita', 'approved'),
  ('a7f328b4-e7db-59e6-8723-2df4e2b39f6c', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kankara', 'kankara', 'approved'),
  ('2cd6fe9b-edeb-5790-89ce-33df350782b3', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kankia', 'kankia', 'approved'),
  ('e5f928a0-e106-5fea-b500-cb12a6527189', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Katsina', 'katsina-2', 'approved'),
  ('1f30047f-cc76-5a40-bf1d-a7f9dd6c4ff1', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kurfi', 'kurfi', 'approved'),
  ('9397b899-b973-5f65-9cc2-e4c1f5c8f176', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Kusada', 'kusada', 'approved'),
  ('97bf7aec-0818-5be5-8848-7918f51102fe', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Mai''Adua', 'mai-adua', 'approved'),
  ('2f38c917-2862-50a9-ae48-3160407c24d3', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Malumfashi', 'malumfashi', 'approved'),
  ('86337740-4352-5119-95ec-051b8f527813', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Mani', 'mani', 'approved'),
  ('018d994c-5b39-509e-bed4-29275eb0aae3', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Mashi', 'mashi', 'approved'),
  ('d6a32406-88d1-58d7-a241-2d8c098bc320', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Matazuu', 'matazuu', 'approved'),
  ('05915c1c-a129-5185-8790-6f6f8c965a2f', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Musawa', 'musawa', 'approved'),
  ('3477f175-e12d-5a0a-948c-951f524e35d8', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Rimi', 'rimi', 'approved'),
  ('9d32e3e4-4e87-5b31-817f-fd41880dfda0', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Sabuwa', 'sabuwa', 'approved'),
  ('52504189-5f0b-548a-a813-49c9077aa708', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Safana', 'safana', 'approved'),
  ('fd02163f-ac7f-554f-bd84-9005821d0a49', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Sandamu', 'sandamu', 'approved'),
  ('6968bcb9-e7f3-58da-a246-be9d353cc45d', (SELECT id FROM locations WHERE slug = 'katsina'), 'lga', 'Zango', 'zango', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Kebbi
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('ebae86c3-6951-58bb-9ff7-5d9f346f64ce', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Kebbi', 'KE', 'kebbi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('0b7f7efa-0710-5be2-9284-1ed214f1897e', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Aleiro', 'aleiro', 'approved'),
  ('6e3cc369-83f5-5c95-abd3-535e12276854', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Arewa Dandi', 'arewa-dandi', 'approved'),
  ('8f91bfaa-7ca0-52df-9459-b597b2b274f9', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Argungu', 'argungu', 'approved'),
  ('35e6aabe-f465-57a6-9fec-ad4793049598', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Augie', 'augie', 'approved'),
  ('1bcbd4c9-0185-5d68-9126-ef8c0ad21f28', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Bagudo', 'bagudo', 'approved'),
  ('822665ac-8c50-5b74-9c02-edf0f4c5ca43', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Birnin Kebbi', 'birnin-kebbi', 'approved'),
  ('e65036cc-5429-5488-a149-5370f8eb50b9', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Bunza', 'bunza', 'approved'),
  ('332fc6ae-0991-56e9-be69-7f3934ffc327', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Dandi', 'dandi', 'approved'),
  ('da5d3799-c31d-5a9a-8cd5-fde8912e1f26', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Fakai', 'fakai', 'approved'),
  ('fb865a1e-aedf-5ced-ade7-1d16c82ef655', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Gwandu', 'gwandu', 'approved'),
  ('bfb3b5a1-f6ac-50f1-bcfa-39edd40741ba', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Jega', 'jega', 'approved'),
  ('405f24cf-81d3-558f-9fbf-7aa420a22164', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Kalgo', 'kalgo', 'approved'),
  ('85e3039a-0320-5ba6-a7a5-e2de5fc5a487', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Koko/Besse', 'koko-besse', 'approved'),
  ('66230833-8ba9-5cc3-bed1-22a70c9097ff', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Maiyama', 'maiyama', 'approved'),
  ('803fa9e3-df74-5580-9129-429dbc9885c9', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Ngaski', 'ngaski', 'approved'),
  ('4d8d702f-53ee-5dd5-8eee-8d49f488587a', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Sakaba', 'sakaba', 'approved'),
  ('a1ab7df0-5cd2-5a18-bf4c-241f2d970ef8', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Shanga', 'shanga', 'approved'),
  ('45418385-91fa-5cf5-85b8-05a1d204d9f4', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Suru', 'suru', 'approved'),
  ('ef0f9791-2d5f-5445-8cd8-45b4b20edbbf', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Wasagu/Danko', 'wasagu-danko', 'approved'),
  ('70be38d0-2ff7-586d-9350-1880a30ae9ef', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Yauri', 'yauri', 'approved'),
  ('c0fad62e-c204-5c16-b40c-21cb7ef7235c', (SELECT id FROM locations WHERE slug = 'kebbi'), 'lga', 'Zuru', 'zuru', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Kogi
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('3d35e132-f9f4-5936-ba15-6f4b06a5eb94', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Kogi', 'KO', 'kogi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('19b68a5b-2759-52e6-a6c5-2f3df40738cf', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Adavi', 'adavi', 'approved'),
  ('34bb044e-490d-5f25-b36d-1a2501805396', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ajaokuta', 'ajaokuta', 'approved'),
  ('73b74c40-cabc-5439-b122-cdd5ecbb7a61', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ankpa', 'ankpa', 'approved'),
  ('43cd4742-5d2d-5aa1-bfce-10514df683a5', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Bassa', 'kogi-bassa', 'approved'),
  ('bf30b26a-a369-5537-88c1-8760adff1117', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Dekina', 'dekina', 'approved'),
  ('394508bb-7dcf-505a-aea5-73ee9d10c664', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ibaji', 'ibaji', 'approved'),
  ('908b2b33-7928-5b69-8fba-412071d1632c', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Idah', 'idah', 'approved'),
  ('482fc719-304c-511f-993d-33b8ed7f21fa', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Igalamela Odolu', 'igalamela-odolu', 'approved'),
  ('f6874e02-08a1-5b63-af73-2a44875b87cb', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ijumu', 'ijumu', 'approved'),
  ('cc4316b1-0b27-53d0-bd52-195fb0e4b440', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Kabba/Bunu', 'kabba-bunu', 'approved'),
  ('0555e03b-bc1f-52e3-8ad7-177efbd9991c', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Kogi', 'kogi-2', 'approved'),
  ('8c580a0b-886e-5f1e-a224-fcecb53b3d54', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Lokoja', 'lokoja', 'approved'),
  ('95cc78a9-b6fd-5f0c-ad9d-8abd30e733ca', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Mopa Muro', 'mopa-muro', 'approved'),
  ('672ecd28-7cbe-5267-bd26-ab9e5d483520', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ofu', 'ofu', 'approved'),
  ('92b4c458-27a4-54dc-ba6a-528675fd7f85', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Ogori/Magongo', 'ogori-magongo', 'approved'),
  ('bc9d7335-a534-579a-b041-a08f549b6a0f', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Okehi', 'okehi', 'approved'),
  ('94061167-5037-5d04-a967-96fa2df0ba8a', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Okene', 'okene', 'approved'),
  ('743e06a2-e3fa-5574-a9e1-db64844c6ac2', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Olamaboro', 'olamaboro', 'approved'),
  ('a7542699-aefd-5943-9ab5-1e09365c8251', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Omala', 'omala', 'approved'),
  ('d6ec16b4-3101-5cc9-835f-d0363f63c572', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Yagba East', 'yagba-east', 'approved'),
  ('bb39d893-1310-50b8-82ab-ee13a0a98b6a', (SELECT id FROM locations WHERE slug = 'kogi'), 'lga', 'Yagba West', 'yagba-west', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Kwara
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('183ff7b7-4894-549b-afbd-bb644f9138df', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Kwara', 'KW', 'kwara', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('39c888df-45de-5701-89d9-cbdad17c23e7', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Asa', 'asa', 'approved'),
  ('940e7e04-35bb-5bcf-b188-6dc4237827c4', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Baruten', 'baruten', 'approved'),
  ('f54252ab-09f3-558d-9124-baeff649cc26', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Edu', 'edu', 'approved'),
  ('280e5351-dee4-575f-993e-53f7488f8991', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Ekiti', 'ekiti-2', 'approved'),
  ('3b03d59f-7c3f-5a3e-a066-96a349045c20', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Ifelodun', 'kwara-ifelodun', 'approved'),
  ('9d13abf6-1089-5672-814c-5a83acd7e252', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Ilorin East', 'ilorin-east', 'approved'),
  ('3dba9c26-67ef-50cb-bfab-9d24748bac38', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Ilorin South', 'ilorin-south', 'approved'),
  ('081d80e7-d255-5b00-a8db-210d7253cc87', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Ilorin West', 'ilorin-west', 'approved'),
  ('c10f85c5-2b39-5156-9d90-62baeedf1e7d', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Irepodun', 'kwara-irepodun', 'approved'),
  ('38488754-cdf4-52e5-a162-acdb61a47ef0', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Isin', 'isin', 'approved'),
  ('84aa30aa-2882-5218-b5da-70e15f47a9f0', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Kaiama', 'kaiama', 'approved'),
  ('8ecf1a01-3177-5473-b41c-f43fba549089', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Moro', 'moro', 'approved'),
  ('aa6c5ee2-78a1-576c-92db-d8f056b1a2bb', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Offa', 'offa', 'approved'),
  ('d2b0c0b0-1766-5157-a8c8-68fdf93433c9', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Oke Ero', 'oke-ero', 'approved'),
  ('b3cfdb49-bfd3-5156-8a42-35cebaa58c1b', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Oyun', 'oyun', 'approved'),
  ('4d613456-9947-5646-bc75-4424adc2febf', (SELECT id FROM locations WHERE slug = 'kwara'), 'lga', 'Pategi', 'pategi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Lagos
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('b7349100-c1a5-53bf-9144-4c1486c2f783', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Lagos', 'LA', 'lagos', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('9d801e89-eb32-5e8e-919f-81cc5374aff9', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Agege', 'agege', 'approved'),
  ('ef8324c2-1f12-503e-bd00-780175cacb0d', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ajeromi-Ifelodun', 'ajeromi-ifelodun', 'approved'),
  ('6aa868e5-1942-5d36-a699-b2314ab3a0bb', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Alimosho', 'alimosho', 'approved'),
  ('59374d63-d356-546a-809a-d47f307c079c', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Amuwo-Odofin', 'amuwo-odofin', 'approved'),
  ('c9630527-c1bc-5e91-a2b6-9602bac46228', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Apapa', 'apapa', 'approved'),
  ('742b23b0-f43c-527e-820f-0c1ac878f116', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Badagry', 'badagry', 'approved'),
  ('dbcc1690-f99e-5b19-887a-f0ca56a0dd7c', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Epe', 'epe', 'approved'),
  ('91fb5dcf-f348-5f65-a68c-485197044c7c', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Eti-Osa', 'eti-osa', 'approved'),
  ('80a7d9d7-10bb-506d-8bbc-472866b836f9', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ibeju/Lekki', 'ibeju-lekki', 'approved'),
  ('d9a56177-938b-550d-a2e9-11bbdb08a680', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ifako-Ijaye', 'ifako-ijaye', 'approved'),
  ('8dc550c0-fbfd-5308-a352-2ab867707956', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ikeja', 'ikeja', 'approved'),
  ('55c49658-3630-51cb-9ee2-be4f3d0514cb', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ikorodu', 'ikorodu', 'approved'),
  ('3c5be7bc-53ab-5147-a142-a22d02847cc0', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Kosofe', 'kosofe', 'approved'),
  ('e12ba571-7fed-5177-840f-fd53a5451d11', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Lagos Island', 'lagos-island', 'approved'),
  ('14ca8bc0-81f3-5179-9009-7bfa2afe189c', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Lagos Mainland', 'lagos-mainland', 'approved'),
  ('edea1d50-f912-50fc-9ed2-9bba417b722e', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Mushin', 'mushin', 'approved'),
  ('98c7b60e-695f-5dc6-93fc-0e64b1a22b2b', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Ojo', 'ojo', 'approved'),
  ('0bb4003c-ef57-594d-bd99-097fcffbdd34', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Oshodi-Isolo', 'oshodi-isolo', 'approved'),
  ('288d5ede-4d9d-56ee-9bf4-44094df9c25d', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Shomolu', 'shomolu', 'approved'),
  ('663b6667-d1e6-5ef1-9aed-e1bf03f3acc6', (SELECT id FROM locations WHERE slug = 'lagos'), 'lga', 'Surulere', 'surulere', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Nasarawa
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('5c5c5378-5a1e-5390-98b9-36ec47fac879', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Nasarawa', 'NA', 'nasarawa', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('a563f4b6-1e76-5bff-9d47-c62a3830f6c1', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Akwanga', 'akwanga', 'approved'),
  ('08828aaf-d0cb-591d-a8c0-f1fbdb0e0125', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Awe', 'awe', 'approved'),
  ('c691b704-2809-5585-af09-a8d323dbebef', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Doma', 'doma', 'approved'),
  ('254831e7-79d3-5db2-9f0f-89cbc6567c74', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Karu', 'karu', 'approved'),
  ('799f7994-bb4b-5c7e-8f24-470c74f7f737', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Keana', 'keana', 'approved'),
  ('538855c7-6009-500d-80fb-f5513777c88a', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Keffi', 'keffi', 'approved'),
  ('0bc54715-d6fc-533f-8257-48a3d430f320', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Kokona', 'kokona', 'approved'),
  ('ec82a40b-a191-5592-9b98-3446354fd1d6', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Lafia', 'lafia', 'approved'),
  ('ba6c0696-2fb0-5701-ab7d-4975c05907ba', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Nasarawa', 'nasarawa-nasarawa', 'approved'),
  ('da2e18e1-bf0e-5336-a1c2-15cdd281fe30', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Nasarawa Egon', 'nasarawa-egon', 'approved'),
  ('6537e9eb-7fa8-56c9-9fd0-45f91d89704a', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Obi', 'nasarawa-obi', 'approved'),
  ('ecf695f8-575d-5fbe-a981-0276ce290f4b', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Toto', 'toto', 'approved'),
  ('077e18d8-48fa-56db-bd8b-85d6d9cefeb4', (SELECT id FROM locations WHERE slug = 'nasarawa'), 'lga', 'Wamba', 'wamba', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Niger
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('cf2f3530-a2d6-53e4-b31c-8dd35e176f37', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Niger', 'NI', 'niger', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('4c1f98b6-112b-5eae-a100-5348cbbd9f78', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Agaie', 'agaie', 'approved'),
  ('41266c3d-ecf5-5269-8cb8-1bc72514dad3', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Agwara', 'agwara', 'approved'),
  ('d04a67b0-67cc-5b3f-bacc-87458e8838b6', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Bida', 'bida', 'approved'),
  ('d557c77e-a87f-56a2-bc65-fdf02d3c78e4', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Borgu', 'borgu', 'approved'),
  ('9ac05de9-ef4d-5f5c-94ca-bef70a065d77', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Bosso', 'bosso', 'approved'),
  ('2af16f26-b585-5cbe-be22-a146e91b37e3', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Chanchaga', 'chanchaga', 'approved'),
  ('61816da4-e831-5b4d-93ab-a196fc1d69f8', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Edati', 'edati', 'approved'),
  ('8f9b3f9b-f071-5687-a7c8-79508720bc41', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Gbako', 'gbako', 'approved'),
  ('6f1411c1-3861-5804-adbf-23f98868b1c4', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Gurara', 'gurara', 'approved'),
  ('0c62c313-332d-547f-8c0b-be6818bb919f', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Katcha', 'katcha', 'approved'),
  ('d604ed75-6d98-5d13-a27f-a5d4e9a4bf24', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Kontagora', 'kontagora', 'approved'),
  ('16ef87e9-8924-5f24-9b22-7791bf765eb2', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Lapai', 'lapai', 'approved'),
  ('46b3825b-3583-5605-99f7-e3c6ebdec119', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Lavun', 'lavun', 'approved'),
  ('9ec880de-cff8-596e-878f-80b2da0bc9cf', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Magama', 'magama', 'approved'),
  ('f4f3fbd1-5b9a-5e8a-8436-f662f218cf94', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Mariga', 'mariga', 'approved'),
  ('157e046e-32e5-599f-b40d-c555fea880f7', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Mashegu', 'mashegu', 'approved'),
  ('f4ed84fe-0d8f-5a8c-b296-b00d9763659c', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Mokwa', 'mokwa', 'approved'),
  ('37485bf3-2945-5a4e-b8dd-17b826ee7a2d', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Munya', 'munya', 'approved'),
  ('53941ffe-a561-57b3-89e4-455da2278409', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Paikoro', 'paikoro', 'approved'),
  ('fbefdd78-d1cc-5261-8325-69266adfb27f', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Rafi', 'rafi', 'approved'),
  ('8c281e76-950b-575d-b7bf-8b7589c4564e', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Rijau', 'rijau', 'approved'),
  ('9f28e0ce-5e92-5b72-b04d-d1e37a5349ca', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Shiroro', 'shiroro', 'approved'),
  ('d41a3f33-d01f-5aa9-b893-fabd543ee9ec', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Suleja', 'suleja', 'approved'),
  ('25dc9cae-a533-5116-be27-e3919ad4923a', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Tafa', 'tafa', 'approved'),
  ('248bace4-f2de-5e7f-9bdb-fb26e5829920', (SELECT id FROM locations WHERE slug = 'niger'), 'lga', 'Wushishi', 'wushishi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Ogun
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('b9f1924a-c0be-5340-ae2d-4eb26662a039', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Ogun', 'OG', 'ogun', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('4ca65612-caaf-522f-b98f-99dcc97d596a', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Abeokuta North', 'abeokuta-north', 'approved'),
  ('2e8050f2-57d7-5380-8957-007661282cca', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Abeokuta South', 'abeokuta-south', 'approved'),
  ('c7145a9b-a94c-5445-b81d-c071f9c7d727', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ado-Odo/Ota', 'ado-odo-ota', 'approved'),
  ('efb841a5-d419-5cfa-9dff-eda9720c7073', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Egbado North', 'egbado-north', 'approved'),
  ('7de75920-dd01-59df-b38e-c7ad2421c0ee', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Egbado South', 'egbado-south', 'approved'),
  ('ce4d18ff-00c4-5965-bc9d-f3f22261d242', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ewekoro', 'ewekoro', 'approved'),
  ('263746e5-91c0-5444-bce7-168c8086f057', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ifo', 'ifo', 'approved'),
  ('f28b3e6c-5ace-5c5a-932a-340b1f0b6a1a', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ijebu East', 'ijebu-east', 'approved'),
  ('dcbcd0bc-635b-5f00-aa44-0dd1cc520945', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ijebu North', 'ijebu-north', 'approved'),
  ('8e829658-e0db-56a6-9e98-dba8d834ac81', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ijebu North East', 'ijebu-north-east', 'approved'),
  ('4e36f207-153d-55b7-872b-ac110b4d6d37', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ijebu Ode', 'ijebu-ode', 'approved'),
  ('65ba5047-9d99-5179-8f86-3486fd37a510', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ikenne', 'ikenne', 'approved'),
  ('9c8f7ddc-2351-5bd5-8cf2-d4d1d398d968', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Imeko Afon', 'imeko-afon', 'approved'),
  ('3dfba0b2-7a7e-55dd-b265-7b5c3a117382', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ipokia', 'ipokia', 'approved'),
  ('06e1bba1-2e4f-5877-823f-9fb35655a4cd', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Obafemi Owode', 'obafemi-owode', 'approved'),
  ('1f7d1b7b-369d-529a-b335-0ded0c392313', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Odeda', 'odeda', 'approved'),
  ('cde63235-5e32-5262-a841-11ff12707d2e', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Odogbolu', 'odogbolu', 'approved'),
  ('c3a14d56-8771-50cb-8aed-0c1568220700', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Ogun Waterside', 'ogun-waterside', 'approved'),
  ('06288182-29b8-5b21-b1d0-efd8f10c4c2d', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Remo North', 'remo-north', 'approved'),
  ('d15f34af-bae8-55e7-8f24-e57bff82cb91', (SELECT id FROM locations WHERE slug = 'ogun'), 'lga', 'Shagamu', 'shagamu', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Ondo
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('622362ae-7146-5e80-b284-adf267f92705', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Ondo', 'ON', 'ondo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('ea8eef21-cda7-50ed-82a0-66767025e494', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akoko North East', 'akoko-north-east', 'approved'),
  ('179a0df8-7795-59c3-8f83-cee74bc2768b', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akoko North West', 'akoko-north-west', 'approved'),
  ('1ba27df0-260f-5ee3-a9fc-67808d418a4a', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akoko South Akure East', 'akoko-south-akure-east', 'approved'),
  ('1e688ad1-3080-5d9f-ab93-f1b3eb65ded3', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akoko South West', 'akoko-south-west', 'approved'),
  ('65bf6aa6-03f6-55f1-83b9-acf3f6865f64', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akure North', 'akure-north', 'approved'),
  ('b5609720-ba01-5d51-a6c3-6d3e9f3ef68e', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Akure South', 'akure-south', 'approved'),
  ('577ccb56-3623-59b2-9327-cb1943199cdf', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ese-Odo', 'ese-odo', 'approved'),
  ('ed176e2e-f1fb-548f-85fd-51ffa1ecf1cc', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Idanre', 'idanre', 'approved'),
  ('aec4645a-56e4-5ba2-81bf-fa050e826c27', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ifedore', 'ifedore', 'approved'),
  ('66fcb168-2344-556d-84ac-84ea6dea03a9', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ilaje', 'ilaje', 'approved'),
  ('16dc4a36-cc1d-58d5-895e-6d3e74a53ddc', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ile-Oluji', 'ile-oluji', 'approved'),
  ('d4b70ce1-3adc-5a15-afb8-e4fc5c5928e2', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Okeigbo', 'okeigbo', 'approved'),
  ('e80deab0-e981-50cc-bfd3-fc8d02526d31', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Irele', 'irele', 'approved'),
  ('a52f5727-a866-576a-bd99-32e7ad89915f', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Odigbo', 'odigbo', 'approved'),
  ('d827780d-4686-5a5b-a128-42964bb01466', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Okitipupa', 'okitipupa', 'approved'),
  ('4fd28739-e8c1-59e3-8759-0e16c012b15c', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ondo East', 'ondo-east', 'approved'),
  ('bf3b938e-f197-5b0c-831e-a7874b1cb9f4', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ondo West', 'ondo-west', 'approved'),
  ('97a47027-53d9-5d0d-838e-fee1a0eb9e12', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Ose', 'ose', 'approved'),
  ('f838acf8-6811-5bf9-aab0-6f6b61e481e1', (SELECT id FROM locations WHERE slug = 'ondo'), 'lga', 'Owo', 'owo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Osun
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('1742e7d3-6a78-5c98-815b-5142e1cf78a7', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Osun', 'OS', 'osun', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('76a31080-8cfd-5b8d-836b-4790e3ebf683', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Aiyedade', 'aiyedade', 'approved'),
  ('1b806e31-532c-5195-b0e7-9f454f4844cb', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Aiyedire', 'aiyedire', 'approved'),
  ('d8ba4a7f-5c0a-5f68-8b7b-a247c0d57ac4', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Atakunmosa East', 'atakunmosa-east', 'approved'),
  ('6cb51679-4597-5017-88ff-c545a62df639', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Atakunmosa West', 'atakunmosa-west', 'approved'),
  ('769cd0c1-7311-5dfd-87e8-0d7a637e9373', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Boluwaduro', 'boluwaduro', 'approved'),
  ('136eab9e-f765-52b3-97ec-ed6a61e620c8', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Boripe', 'boripe', 'approved'),
  ('dc327e8f-f702-5097-825e-f8f0f1e757b6', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ede North', 'ede-north', 'approved'),
  ('42dc22de-4109-59c1-91bc-33cc064d6ed5', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ede South', 'ede-south', 'approved'),
  ('49238e80-5ab3-5cb3-8f8a-ae578e275afd', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Egbedore', 'egbedore', 'approved'),
  ('9997491b-6ce2-55f8-b2ee-5761a5a7efe5', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ejigbo', 'ejigbo', 'approved'),
  ('196a2e10-0594-5502-956f-f44c54edf66b', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ife Central', 'ife-central', 'approved'),
  ('7c1c9f54-aad5-598a-a55f-7f8195a7de03', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ife East', 'ife-east', 'approved'),
  ('81f98b25-5aa2-51cb-b183-7837ff31f08f', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ife North', 'ife-north', 'approved'),
  ('f90e3a00-def9-5d76-a033-4cd5dec55704', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ife South', 'ife-south', 'approved'),
  ('27f8a063-63ce-5e1a-86d6-fc7abe9160e8', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ifedayo', 'ifedayo', 'approved'),
  ('5ce12525-48bd-5c6a-82b2-3eeecd10f2ca', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ifelodun', 'osun-ifelodun', 'approved'),
  ('1f631c3a-eafd-5473-b6d5-f266b640c0c4', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ila', 'ila', 'approved'),
  ('233b76ef-d5dd-5b95-a2ef-812549720af3', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ilesa East', 'ilesa-east', 'approved'),
  ('4a5000c1-d2ed-58b6-9d61-530294c40b74', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ilesa West', 'ilesa-west', 'approved'),
  ('303ee494-b3c1-584d-b329-683c8a627618', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Irepodun', 'osun-irepodun', 'approved'),
  ('113b3acd-4788-5f15-b430-716261afeb4b', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Irewole', 'irewole', 'approved'),
  ('9e11610f-8f5d-5739-adc0-23ed3df1d4cf', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Isokan', 'isokan', 'approved'),
  ('7c2f118d-e988-58a6-a495-eda8c1263cfc', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Iwo', 'iwo', 'approved'),
  ('a8b52b80-0b28-5d68-9bb3-d8fd0af0cb90', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Obokun', 'obokun', 'approved'),
  ('a0f28838-b73e-5912-9688-3519ac57d50c', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Odo Otin', 'odo-otin', 'approved'),
  ('9d1c47e4-da72-5439-a63c-13afec387b0b', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Ola Oluwa', 'ola-oluwa', 'approved'),
  ('33aae968-45d8-54df-bfc6-3cefcfee9e27', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Olorunda', 'olorunda', 'approved'),
  ('a9f7d3d9-720e-5f81-9979-6b9639ec70e6', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Oriade', 'oriade', 'approved'),
  ('3c2f0f4e-adc0-59b1-9b6b-62401dbe7232', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Orolu', 'orolu', 'approved'),
  ('4fdae1ad-c7b1-5566-aafb-e73506a64f6f', (SELECT id FROM locations WHERE slug = 'osun'), 'lga', 'Osogbo', 'osogbo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Oyo
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('c2a647cb-41da-55cd-8bc0-c4d8b36e6d0e', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Oyo', 'OY', 'oyo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('73c756e0-b729-5f2f-a0ab-e1e4a8265eaf', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Afijio', 'afijio', 'approved'),
  ('be53b237-48f5-5ac4-b574-5cf17a1799d2', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Akinyele', 'akinyele', 'approved'),
  ('d50c5736-d47b-5696-b873-7289b884a803', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Atiba', 'atiba', 'approved'),
  ('9c90cd89-44e2-5c5b-bba6-d2b45a167425', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Atisbo', 'atisbo', 'approved'),
  ('07c7100d-cbc4-5825-8ba9-d9bb41f1ec26', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Egbeda', 'egbeda', 'approved'),
  ('2564e6f2-4876-5558-af7b-5d59f9868c7c', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibadan North', 'ibadan-north', 'approved'),
  ('e1e90387-2e49-5ade-b1cd-903a220159b6', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibadan North-East', 'ibadan-north-east', 'approved'),
  ('60d58cd8-45e5-557b-937a-a9a2d99af410', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibadan North-West', 'ibadan-north-west', 'approved'),
  ('4f204031-6a7e-5772-a823-d594f7587d7f', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibadan South-East', 'ibadan-south-east', 'approved'),
  ('23d45ea2-96d2-5b39-9ab2-a85892d6bba8', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibadan South-West', 'ibadan-south-west', 'approved'),
  ('43af7719-95fe-5d0e-83c2-c3bdfdbdc968', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibarapa Central', 'ibarapa-central', 'approved'),
  ('2e521df6-8870-5045-8b70-faec54fb5844', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibarapa East', 'ibarapa-east', 'approved'),
  ('1e99fb43-7417-52d4-8004-1f52f29103e2', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ibarapa North', 'ibarapa-north', 'approved'),
  ('097b4f51-4c9e-5672-aa6b-b46f2d38eab6', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ido', 'ido', 'approved'),
  ('660ddd15-72df-5260-a910-63b63e70afe2', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Irepo', 'irepo', 'approved'),
  ('eef6f957-1564-54ea-8dc3-b7901af20d42', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Iseyin', 'iseyin', 'approved'),
  ('0c60b801-758b-526d-af92-2d84bea38e50', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Itesiwaju', 'itesiwaju', 'approved'),
  ('c08dcb20-5afa-5018-aa2b-11c23df5123a', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Iwajowa', 'iwajowa', 'approved'),
  ('f109dfbf-66df-541a-ba4b-1f0e9874a347', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Kajola', 'kajola', 'approved'),
  ('6d250d9d-5cb4-5434-bdb0-a2d805d8cf40', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Lagelu', 'lagelu', 'approved'),
  ('5f50ce5a-f18f-5dbe-9faa-78d9f40c4865', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ogbomosho North', 'ogbomosho-north', 'approved'),
  ('3891f6e6-49d6-58ff-8120-f05a17957359', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ogbomosho South', 'ogbomosho-south', 'approved'),
  ('73bf7f01-a583-5e2c-9523-43443bc62f87', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ogo Oluwa', 'ogo-oluwa', 'approved'),
  ('3980e2e8-7afd-59c7-a9a2-0db3f8ae0868', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Olorunsogo', 'olorunsogo', 'approved'),
  ('e97290e3-bb6b-579f-ae36-9ae7538626a6', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Oluyole', 'oluyole', 'approved'),
  ('3c2db763-36f0-5901-8f77-e5793e343559', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ona Ara', 'ona-ara', 'approved'),
  ('04729c51-8037-5bce-9ab4-16f90db3b0e3', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Orelope', 'orelope', 'approved'),
  ('0cb7baec-51b8-5f98-970a-19081b2c5b23', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Ori Ire', 'ori-ire', 'approved'),
  ('fe594896-1ac5-5bdd-97de-07160f3481ca', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Oyo East', 'oyo-east', 'approved'),
  ('dd6b4f69-f9bc-577d-aedd-2ea636ae01fc', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Oyo West', 'oyo-west', 'approved'),
  ('45090a35-faf4-51de-94f1-effd1a6198e9', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Saki East', 'saki-east', 'approved'),
  ('7a1fb255-72fb-50f7-9540-ef7045776081', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Saki West', 'saki-west', 'approved'),
  ('f628be5b-c1da-5159-a796-6c7c65b16445', (SELECT id FROM locations WHERE slug = 'oyo'), 'lga', 'Surulere', 'oyo-surulere', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Plateau
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('b9daef2e-253f-5834-9db6-6e9cd53692d0', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Plateau', 'PL', 'plateau', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('2d348007-c693-5ae5-b6a9-efd3f9cfcc9f', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Barkin Ladi', 'barkin-ladi', 'approved'),
  ('0187fb06-db61-5034-bf57-f8fcef16ced0', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Bassa', 'plateau-bassa', 'approved'),
  ('77061ec1-d3b3-5d64-a6ee-d637d7329fc4', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Bokkos', 'bokkos', 'approved'),
  ('9f6e5d70-6d27-55c0-90dd-ca875a1c0171', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Jos East', 'jos-east', 'approved'),
  ('89fe4b22-8af6-5ee8-a9a8-8d37948a9650', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Jos North', 'jos-north', 'approved'),
  ('7c2a08a6-a6a2-5670-9d6c-cc4fc343188b', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Jos South', 'jos-south', 'approved'),
  ('3e85236b-165c-527a-8756-de86e8ccbd80', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Kanam', 'kanam', 'approved'),
  ('d47ed558-0850-5651-9ace-b6406668acb9', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Kanke', 'kanke', 'approved'),
  ('b6f38be4-70ce-5215-b0f6-0309e41e848a', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Langtang North', 'langtang-north', 'approved'),
  ('b1823e7b-1448-51d8-b24a-c24b94be4bda', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Langtang South', 'langtang-south', 'approved'),
  ('3a255c04-faa0-5969-90fb-369ea78023f1', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Mangu', 'mangu', 'approved'),
  ('404170ea-9eee-5a35-9e03-865f3a33f203', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Mikang', 'mikang', 'approved'),
  ('0965933f-6f8b-51df-be7c-d6e54a5a2a57', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Pankshin', 'pankshin', 'approved'),
  ('7cbb7e85-bf17-5110-84ae-fc7f4d36f852', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Qua''an Pan', 'qua-an-pan', 'approved'),
  ('4b2fa123-ee07-53d6-98d1-9f03fddc4459', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Riyom', 'riyom', 'approved'),
  ('4aeaa1cb-bdea-5ed1-aa69-6e99c6fd2150', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Shendam', 'shendam', 'approved'),
  ('72b92b84-541b-5185-8a03-f4ecd72a0242', (SELECT id FROM locations WHERE slug = 'plateau'), 'lga', 'Wase', 'wase', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Rivers
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('434126e6-8a1b-5436-8c1a-ac70ea4678d5', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Rivers', 'RI', 'rivers', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('d8e8cfe7-7c7a-56d3-8c84-5873221b3f9b', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Abua/Odual', 'abua-odual', 'approved'),
  ('3bdbdda4-97d3-5b42-a106-d2dc27ff056b', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Ahoada East', 'ahoada-east', 'approved'),
  ('47483fcf-2f4d-516b-8236-99dbe4f649e0', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Ahoada West', 'ahoada-west', 'approved'),
  ('72f56bed-25dc-58d1-896a-e55bf4a7bc94', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Akuku-Toru', 'akuku-toru', 'approved'),
  ('71e521fc-9ea8-5678-a616-c39ff2d38c03', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Andoni', 'andoni', 'approved'),
  ('8675988f-21ef-5707-9219-b6b45c1faf5a', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Asari-Toru', 'asari-toru', 'approved'),
  ('9cda4cbc-3d36-5056-ab17-a6d5b769772f', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Bonny', 'bonny', 'approved'),
  ('575b9975-898a-5960-aafc-5cdea828a92f', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Degema', 'degema', 'approved'),
  ('248832f4-710c-5a27-a05c-93f04cf12039', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Eleme', 'eleme', 'approved'),
  ('107fb30d-06e5-5836-8a15-e10870fd6324', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Emuoha', 'emuoha', 'approved'),
  ('655fe042-ae72-512c-a970-9333ff78a3f8', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Etche', 'etche', 'approved'),
  ('458594da-bf04-53cf-a98f-8d2b459d2e69', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Gokana', 'gokana', 'approved'),
  ('6e0b1712-c22c-570c-97af-c8085a74a70d', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Ikwerre', 'ikwerre', 'approved'),
  ('00403887-5d88-5053-9f17-184b38d1837b', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Khana', 'khana', 'approved'),
  ('027b7029-d01f-5faf-9c5e-3e2b38a12796', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Obio/Akpor', 'obio-akpor', 'approved'),
  ('65590cca-024b-520d-9a2f-b64237045aaf', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Ogba/Egbema/Ndoni', 'ogba-egbema-ndoni', 'approved'),
  ('cf137a06-4d7c-5864-bbbb-e32c5a208b8b', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Ogu/Bolo', 'ogu-bolo', 'approved'),
  ('c6bf882c-c1a0-53e2-82a3-79ee21518953', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Okrika', 'okrika', 'approved'),
  ('b7ce3db5-560e-5201-bfef-f4a1b5d4d114', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Omuma', 'omuma', 'approved'),
  ('796982c7-24dc-5db7-9c95-df9d4055a8d7', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Opobo/Nkoro', 'opobo-nkoro', 'approved'),
  ('27e99078-c074-5e0c-b641-33356bf3deeb', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Oyigbo', 'oyigbo', 'approved'),
  ('de5cbf4c-aa2a-5d8b-9ab5-b047080a4bcc', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Port Harcourt', 'port-harcourt', 'approved'),
  ('3df28493-2744-56dc-b1a5-212c82acd4d3', (SELECT id FROM locations WHERE slug = 'rivers'), 'lga', 'Tai', 'tai', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Sokoto
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('b4d9478a-e992-5734-b22b-27366673948c', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Sokoto', 'SO', 'sokoto', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('f21054ff-622d-5842-ab40-3f71d42ad1e1', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Binji', 'binji', 'approved'),
  ('cf2fc3e5-f929-540f-b8a4-9ea10b125b22', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Bodinga', 'bodinga', 'approved'),
  ('c203b1d9-aa8e-50d0-9793-1d4d86ac14fc', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Dange Shuni', 'dange-shuni', 'approved'),
  ('5b93b3f6-2306-550a-be70-e319a463cd78', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Gada', 'gada', 'approved'),
  ('eb73dfe6-7d07-51ee-be52-bdf969107fc0', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Goronyo', 'goronyo', 'approved'),
  ('07bac09d-a6f3-57f8-bffd-4aad425bb483', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Gudu', 'gudu', 'approved'),
  ('51a7944c-bf01-517e-ba5d-4fdc311be1fa', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Gwadabawa', 'gwadabawa', 'approved'),
  ('cbfee097-d020-58c2-bf0f-16199200b9a8', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Illela', 'illela', 'approved'),
  ('def71d78-6374-54f8-8a0a-a113cf4e0ea2', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Isa', 'isa', 'approved'),
  ('8e198960-d7dc-52a7-bfc4-8b54a09e67d2', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Kebbe', 'kebbe', 'approved'),
  ('aee2ba72-c751-5428-b561-8c465605763b', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Kware', 'kware', 'approved'),
  ('f39c8674-8291-5293-a776-1a6dda82180f', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Rabah', 'rabah', 'approved'),
  ('abcfc1a6-dbfd-59ba-8f0a-263b10e5848c', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Sabon Birni', 'sabon-birni', 'approved'),
  ('cd189f2b-9c3e-5e83-9850-2c02a2f0ffb6', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Shagari', 'shagari', 'approved'),
  ('18fe0cb7-99c0-5e12-a7f4-68b1940a7f55', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Silame', 'silame', 'approved'),
  ('84d90f7c-618a-5d7c-a3d9-6464d793c933', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Sokoto North', 'sokoto-north', 'approved'),
  ('1b5677db-57d7-5607-a822-677f14853642', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Sokoto South', 'sokoto-south', 'approved'),
  ('ee36616b-78a4-5edb-af63-ebd9cf2ca40e', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Tambuwal', 'tambuwal', 'approved'),
  ('b21d7ebd-7f2f-517d-b549-e17749dd0482', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Tangaza', 'tangaza', 'approved'),
  ('55dc958a-ec84-53f8-aa38-d551f2a2940d', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Tureta', 'tureta', 'approved'),
  ('b129ef21-9a1f-5534-8f63-9351134f8ac4', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Wamako', 'wamako', 'approved'),
  ('40199ea6-ea37-515c-a4f1-53ccd81849cc', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Wurno', 'wurno', 'approved'),
  ('285eec31-f536-51de-ac35-31afaaf9d05c', (SELECT id FROM locations WHERE slug = 'sokoto'), 'lga', 'Yabo', 'yabo', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Taraba
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('aa23323b-caf8-565f-8bea-16519943ddd1', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Taraba', 'TA', 'taraba', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('417d3ba2-1d44-5920-b550-a8ba82c5866e', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Ardo Kola', 'ardo-kola', 'approved'),
  ('5678cff0-acff-51d4-84a7-09c652a98901', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Bali', 'bali', 'approved'),
  ('fcc64566-fcb0-5881-8611-cda7ed9bd62c', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Donga', 'donga', 'approved'),
  ('3480d0bc-d9b6-532f-ab63-03e8c849c9bf', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Gashaka', 'gashaka', 'approved'),
  ('b621618e-22c4-5d61-b109-8458cf708dd2', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Gassol', 'gassol', 'approved'),
  ('4bbdefa3-20b7-557c-b648-0ef3c5976e3c', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Ibi', 'ibi', 'approved'),
  ('33c07e1f-18c9-5ea8-bef9-b1c15a7880eb', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Jalingo', 'jalingo', 'approved'),
  ('18d3084c-8e62-5eb7-a220-df1d26fae1f4', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Karim Lamido', 'karim-lamido', 'approved'),
  ('f6314184-5800-52cf-885d-fad12ea5fef8', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Kumi', 'kumi', 'approved'),
  ('eadb285a-9040-52e5-84f3-1082c0181dab', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Lau', 'lau', 'approved'),
  ('71d394b3-6649-56bc-b7be-f4afcd4e70e8', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Sardauna', 'sardauna', 'approved'),
  ('a729883f-b028-5054-962c-d18c3481d370', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Takum', 'takum', 'approved'),
  ('9b1b50ca-4778-5c99-844c-8c46bcdebbcd', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Ussa', 'ussa', 'approved'),
  ('3147fc3f-0c41-58fc-bebb-6a5cdb46ff4f', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Wukari', 'wukari', 'approved'),
  ('421487d8-73ed-5ce0-8364-f862de99db2a', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Yorro', 'yorro', 'approved'),
  ('35902262-23a8-5074-8c02-709aa9a361b3', (SELECT id FROM locations WHERE slug = 'taraba'), 'lga', 'Zing', 'zing', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Yobe
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('c589fa7d-8ea0-5ca2-a741-19090cda63d0', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Yobe', 'YO', 'yobe', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('d7d0dd92-4436-5511-976b-3cfe50079f2a', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Bade', 'bade', 'approved'),
  ('cc9ae26d-8423-51b1-acb9-9ed3ddce3f41', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Bursari', 'bursari', 'approved'),
  ('fdfa757a-405f-598c-95a3-1b9b133bcb8c', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Damaturu', 'damaturu', 'approved'),
  ('f74ff71d-aa16-535d-87a0-760483c35024', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Fika', 'fika', 'approved'),
  ('4d28f7a3-6f82-5042-91f3-10571153561f', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Fune', 'fune', 'approved'),
  ('e7d201ef-df3f-5790-bb43-26834cba574c', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Geidam', 'geidam', 'approved'),
  ('b4139387-c6cd-5037-8a8f-c97fb9d4b510', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Gujba', 'gujba', 'approved'),
  ('d915d001-9e52-5c81-b7f7-66a1d450e931', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Gulani', 'gulani', 'approved'),
  ('69c3504f-f44d-5db1-9922-addce682e786', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Jakusko', 'jakusko', 'approved'),
  ('ca1972d8-e9c1-55bf-94e6-a8226ff23043', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Karasuwa', 'karasuwa', 'approved'),
  ('4bbb4a54-8bf5-5ceb-8cac-b2e601a2f06b', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Karawa', 'karawa', 'approved'),
  ('5d40dd5f-eb77-5b0d-98f6-ea2a70b26100', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Machina', 'machina', 'approved'),
  ('048d9b7f-a66c-5868-bb3f-a3357055d235', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Nangere', 'nangere', 'approved'),
  ('7b034626-dde2-5bd8-a520-2bbb01d3df66', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Nguru Potiskum', 'nguru-potiskum', 'approved'),
  ('ed0550b0-83ca-5947-9fc3-0de220b8f982', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Tarmua', 'tarmua', 'approved'),
  ('0c664d76-bd4a-5a3a-8cf8-a6dbcafe3da4', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Yunusari', 'yunusari', 'approved'),
  ('32be9815-6443-5894-82a4-635077bb827a', (SELECT id FROM locations WHERE slug = 'yobe'), 'lga', 'Yusufari', 'yusufari', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Zamfara
INSERT INTO locations (id, parent_id, type, name, code, slug, status)
VALUES ('6c68e77b-2684-5162-bafc-d28866a56a17', (SELECT id FROM locations WHERE slug = 'nigeria'), 'state', 'Zamfara', 'ZA', 'zamfara', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, code = COALESCE(locations.code, EXCLUDED.code), status = 'approved';
INSERT INTO locations (id, parent_id, type, name, slug, status)
VALUES
  ('77f88c5b-a974-5d33-bf0d-7118b948b835', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Anka', 'anka', 'approved'),
  ('eb4e9abe-fb6a-581e-95ca-3d5b7fde8e4d', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Bakura', 'bakura', 'approved'),
  ('f2e43cfb-0d72-5ce5-bb91-95d0b64b1577', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Birnin Magaji', 'birnin-magaji', 'approved'),
  ('980480e8-c3f9-5e45-8912-aafc76d23c2a', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Bukkuyum', 'bukkuyum', 'approved'),
  ('9ca0f565-b0ca-58a9-9ef5-15178ed25b1d', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Bungudu', 'bungudu', 'approved'),
  ('66190f05-8860-5e97-adb7-d534b9e8fbaa', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Gummi', 'gummi', 'approved'),
  ('3acd5ddc-2ffb-5fc2-bc13-c6536fc6dd06', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Gusau', 'gusau', 'approved'),
  ('bba7ca78-7b0c-5930-aa31-d64fb37fc099', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Kaura', 'zamfara-kaura', 'approved'),
  ('acbe5ca8-1931-5d53-8d87-b77f3830311a', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Namoda', 'namoda', 'approved'),
  ('60587e84-42d5-5951-a48a-8610c86b1692', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Maradun', 'maradun', 'approved'),
  ('48e9d241-10cf-5c0d-83b1-65de7855b875', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Maru', 'maru', 'approved'),
  ('8bebb633-7c5e-5c73-a4f9-f531208b2d66', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Shinkafi', 'shinkafi', 'approved'),
  ('70a3be06-ccab-5c0d-be84-4f5b2b931f2d', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Talata Mafara', 'talata-mafara', 'approved'),
  ('7d864df4-9b82-57a2-82a7-73bce6a42ef2', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Tsafe', 'tsafe', 'approved'),
  ('a66fc059-20b4-5980-bfbe-6d102793ee26', (SELECT id FROM locations WHERE slug = 'zamfara'), 'lga', 'Zurmi', 'zurmi', 'approved')
ON CONFLICT (slug) DO UPDATE SET parent_id = EXCLUDED.parent_id, type = EXCLUDED.type, name = EXCLUDED.name, status = 'approved';

-- Ojota was part of the original mock seed but is not an LGA.
UPDATE locations SET status = 'inactive' WHERE type = 'lga' AND slug = 'ojota';

