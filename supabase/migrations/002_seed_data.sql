INSERT INTO stores (id, name, location, segment) VALUES
  ('D1', 'Zenska radnja Dusanova',     'Dusanova',    'Zenska'),
  ('D2', 'Muska radnja Dusanova',      'Dusanova',    'Muska'),
  ('D4', 'Zenska radnja Delta Planet', 'Delta Planet','Zenska'),
  ('D5', 'Muska radnja Delta Planet',  'Delta Planet','Muska');

INSERT INTO workers (store_id, initials) VALUES
  ('D1', 'JS'), ('D1', 'IJ'), ('D1', 'FD'),
  ('D2', 'SS'), ('D2', 'SE'), ('D2', 'DJM'), ('D2', 'ZI'),
  ('D4', 'AN'), ('D4', 'MIM'), ('D4', 'MS'), ('D4', 'MM'), ('D4', 'JN'),
  ('D5', 'IA'), ('D5', 'VA'), ('D5', 'MM'), ('D5', 'NA'), ('D5', 'MA'), ('D5', 'ST');

INSERT INTO settings (store_id, conversion_target, aov_target)
VALUES (NULL, 15.00, 3000.00);

INSERT INTO settings (store_id, conversion_target, aov_target) VALUES
  ('D1', 15.00, 3000.00),
  ('D2', 15.00, 3000.00),
  ('D4', 15.00, 3000.00),
  ('D5', 15.00, 3000.00);
