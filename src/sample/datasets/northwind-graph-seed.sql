-- ============================================================================
-- NORTHWIND TRADERS: GRAPH EDITION
-- Demo Dataset for Isometry LATCH × GRAPH Explorer
--
-- "Same data. New eyes."
--
-- This ETL transforms Northwind's 14 relational tables into Isometry's
-- LPG nodes/edges model, revealing five graphs hidden inside the classic schema:
--
--   Graph 1: Supply Chain Network      (Supplier → Product → Category → Customer)
--   Graph 2: Org + Territory Coverage  (Employee org tree × geographic coverage)
--   Graph 3: Co-Purchase Affinity      (Products bought together — derived, latent)
--   Graph 4: Order Velocity Network    (Orders as first-class edges, animated)
--   Graph 5: Geographic Trade Flow     (L-axis dominant, supply chain on a map)
--
-- CANONICAL NORTHWIND COUNTS (for verification):
--   91 customers · 9 employees · 29 suppliers · 77 products
--   8 categories · 830 orders · 2155 order_details · 3 shippers
--   53 territories · 4 regions
--
-- In the LPG model:
--   Nodes: customers, employees, suppliers, products, categories, shippers, territories
--   Edges: SUPPLIES, BELONGS_TO, ORDERED, REPORTS_TO, COVERS, SHIPS_VIA,
--          CO_PURCHASE (derived), ORDER_EDGE (orders as edges)
-- ============================================================================

-- ============================================================================
-- NODES: CATEGORIES (8)
-- The taxonomy spine — everything in Northwind connects through categories
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
('nw_cat_1', 'resource', 'Beverages',    'category', '["category","northwind"]', 7, '{"nw_id":1,"description":"Soft drinks, coffees, teas, beers, and ales","product_count":12,"top_product":"Côte de Blaye","graph":"supply_chain"}'),
('nw_cat_2', 'resource', 'Condiments',   'category', '["category","northwind"]', 5, '{"nw_id":2,"description":"Sweet and savory sauces, relishes, spreads, and seasonings","product_count":12,"top_product":"Vegie-spread","graph":"supply_chain"}'),
('nw_cat_3', 'resource', 'Confections',  'category', '["category","northwind"]', 6, '{"nw_id":3,"description":"Desserts, candies, and sweet breads","product_count":13,"top_product":"Tarte au sucre","graph":"supply_chain"}'),
('nw_cat_4', 'resource', 'Dairy Products','category','["category","northwind"]', 8, '{"nw_id":4,"description":"Cheeses","product_count":10,"top_product":"Raclette Courdavault","graph":"supply_chain"}'),
('nw_cat_5', 'resource', 'Grains/Cereals','category','["category","northwind"]', 5, '{"nw_id":5,"description":"Breads, crackers, pasta, and cereal","product_count":7,"top_product":"Gnocchi di nonna Alice","graph":"supply_chain"}'),
('nw_cat_6', 'resource', 'Meat/Poultry', 'category', '["category","northwind"]', 6, '{"nw_id":6,"description":"Prepared meats","product_count":6,"top_product":"Thüringer Rostbratwurst","graph":"supply_chain"}'),
('nw_cat_7', 'resource', 'Produce',      'category', '["category","northwind"]', 5, '{"nw_id":7,"description":"Dried fruit and bean curd","product_count":5,"top_product":"Manjimup Dried Apples","graph":"supply_chain"}'),
('nw_cat_8', 'resource', 'Seafood',      'category', '["category","northwind"]', 7, '{"nw_id":8,"description":"Seaweed and fish","product_count":12,"top_product":"Boston Crab Meat","graph":"supply_chain"}');

-- ============================================================================
-- NODES: SUPPLIERS (29)
-- Source nodes in the supply chain — where goods enter the network
-- Grouped by country to reveal geographic clustering in Graph 5
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
-- UK (4 suppliers)
('nw_sup_1',  'person', 'Exotic Liquids',              'supplier', '["supplier","uk","northwind"]',      6, '{"nw_id":1,"contact":"Charlotte Cooper","country":"UK","city":"London","product_count":3,"categories":["Beverages","Condiments"],"graph":"supply_chain"}'),
('nw_sup_2',  'person', 'New Orleans Cajun Delights',  'supplier', '["supplier","usa","northwind"]',     6, '{"nw_id":2,"contact":"Shelley Burke","country":"USA","city":"New Orleans","product_count":4,"categories":["Condiments"],"graph":"supply_chain"}'),
('nw_sup_3',  'person', 'Grandma Kelly''s Homestead',  'supplier', '["supplier","usa","northwind"]',     6, '{"nw_id":3,"contact":"Regina Murphy","country":"USA","city":"Ann Arbor","product_count":3,"categories":["Condiments","Produce"],"graph":"supply_chain"}'),
('nw_sup_4',  'person', 'Tokyo Traders',               'supplier', '["supplier","japan","northwind"]',   7, '{"nw_id":4,"contact":"Yoshi Nagase","country":"Japan","city":"Tokyo","product_count":3,"categories":["Seafood","Dairy Products","Produce"],"graph":"supply_chain"}'),
('nw_sup_5',  'person', 'Cooperativa de Quesos ''Las Cabras''', 'supplier', '["supplier","spain","northwind"]', 6, '{"nw_id":5,"contact":"Antonio del Valle Saavedra","country":"Spain","city":"Oviedo","product_count":2,"categories":["Dairy Products"],"graph":"supply_chain"}'),
('nw_sup_6',  'person', 'Mayumi''s',                   'supplier', '["supplier","japan","northwind"]',   6, '{"nw_id":6,"contact":"Mayumi Ohno","country":"Japan","city":"Osaka","product_count":3,"categories":["Grains/Cereals","Condiments","Seafood"],"graph":"supply_chain"}'),
('nw_sup_7',  'person', 'Pavlova Ltd.',                'supplier', '["supplier","australia","northwind"]',7, '{"nw_id":7,"contact":"Ian Devling","country":"Australia","city":"Melbourne","product_count":5,"categories":["Grains/Cereals","Meat/Poultry","Confections","Produce"],"graph":"supply_chain"}'),
('nw_sup_8',  'person', 'Specialty Biscuits Ltd.',     'supplier', '["supplier","uk","northwind"]',      6, '{"nw_id":8,"contact":"Peter Wilson","country":"UK","city":"Manchester","product_count":4,"categories":["Confections"],"graph":"supply_chain"}'),
('nw_sup_9',  'person', 'PB Knäckebröd AB',            'supplier', '["supplier","sweden","northwind"]',  6, '{"nw_id":9,"contact":"Lars Peterson","country":"Sweden","city":"Göteborg","product_count":2,"categories":["Grains/Cereals","Confections"],"graph":"supply_chain"}'),
('nw_sup_10', 'person', 'Refrescos Americanas LTDA',   'supplier', '["supplier","brazil","northwind"]',  5, '{"nw_id":10,"contact":"Carlos Diaz","country":"Brazil","city":"Sao Paulo","product_count":1,"categories":["Beverages"],"graph":"supply_chain"}'),
('nw_sup_11', 'person', 'Heli Süßwaren GmbH & Co. KG', 'supplier', '["supplier","germany","northwind"]', 6, '{"nw_id":11,"contact":"Petra Winkler","country":"Germany","city":"Berlin","product_count":3,"categories":["Confections"],"graph":"supply_chain"}'),
('nw_sup_12', 'person', 'Plutzer Lebensmittelgroßmärkte AG', 'supplier', '["supplier","germany","northwind"]', 7, '{"nw_id":12,"contact":"Martin Bein","country":"Germany","city":"Frankfurt","product_count":5,"categories":["Beverages","Confections","Meat/Poultry","Grains/Cereals"],"graph":"supply_chain"}'),
('nw_sup_13', 'person', 'Nord-Ost-Fisch Handelsgesellschaft mbH', 'supplier', '["supplier","germany","northwind"]', 5, '{"nw_id":13,"contact":"Sven Petersen","country":"Germany","city":"Cuxhaven","product_count":1,"categories":["Seafood"],"graph":"supply_chain"}'),
('nw_sup_14', 'person', 'Formaggi Fortini s.r.l.',     'supplier', '["supplier","italy","northwind"]',   6, '{"nw_id":14,"contact":"Elio Rossi","country":"Italy","city":"Ravenna","product_count":3,"categories":["Dairy Products"],"graph":"supply_chain"}'),
('nw_sup_15', 'person', 'Norske Meierier',             'supplier', '["supplier","norway","northwind"]',  6, '{"nw_id":15,"contact":"Beate Vileid","country":"Norway","city":"Sandvika","product_count":3,"categories":["Dairy Products","Beverages","Confections"],"graph":"supply_chain"}'),
('nw_sup_16', 'person', 'Bigfoot Breweries',           'supplier', '["supplier","usa","northwind"]',     6, '{"nw_id":16,"contact":"Cheryl Saylor","country":"USA","city":"Bend","product_count":3,"categories":["Beverages"],"graph":"supply_chain"}'),
('nw_sup_17', 'person', 'Svensk Sjöföda AB',           'supplier', '["supplier","sweden","northwind"]',  6, '{"nw_id":17,"contact":"Michael Björn","country":"Sweden","city":"Stockholm","product_count":3,"categories":["Seafood"],"graph":"supply_chain"}'),
('nw_sup_18', 'person', 'Aux joyeux ecclésiastiques',  'supplier', '["supplier","france","northwind"]',  7, '{"nw_id":18,"contact":"Guylène Nodier","country":"France","city":"Paris","product_count":2,"categories":["Beverages","Dairy Products"],"graph":"supply_chain"}'),
('nw_sup_19', 'person', 'New England Seafood Cannery', 'supplier', '["supplier","usa","northwind"]',     7, '{"nw_id":19,"contact":"Donn Cattrell","country":"USA","city":"Boston","product_count":4,"categories":["Seafood"],"graph":"supply_chain"}'),
('nw_sup_20', 'person', 'Leka Trading',                'supplier', '["supplier","singapore","northwind"]',6,'{"nw_id":20,"contact":"Chandra Leka","country":"Singapore","city":"Singapore","product_count":3,"categories":["Grains/Cereals","Condiments","Beverages"],"graph":"supply_chain"}'),
('nw_sup_21', 'person', 'Lyngbysild',                  'supplier', '["supplier","denmark","northwind"]', 5, '{"nw_id":21,"contact":"Niels Petersen","country":"Denmark","city":"Lyngby","product_count":2,"categories":["Seafood","Condiments"],"graph":"supply_chain"}'),
('nw_sup_22', 'person', 'Zaanse Snoepfabriek',         'supplier', '["supplier","netherlands","northwind"]',6,'{"nw_id":22,"contact":"Dirk Luchte","country":"Netherlands","city":"Zaandam","product_count":2,"categories":["Condiments","Confections"],"graph":"supply_chain"}'),
('nw_sup_23', 'person', 'Karkki Oy',                   'supplier', '["supplier","finland","northwind"]', 6, '{"nw_id":23,"contact":"Anne Heikkonen","country":"Finland","city":"Lappeenranta","product_count":3,"categories":["Confections","Beverages"],"graph":"supply_chain"}'),
('nw_sup_24', 'person', 'G''day Mate',                 'supplier', '["supplier","australia","northwind"]',6,'{"nw_id":24,"contact":"Wendy Mackenzie","country":"Australia","city":"Sydney","product_count":3,"categories":["Beverages","Meat/Poultry","Produce"],"graph":"supply_chain"}'),
('nw_sup_25', 'person', 'Ma Maison',                   'supplier', '["supplier","canada","northwind"]',  6, '{"nw_id":25,"contact":"Jean-Guy Lauzon","country":"Canada","city":"Montréal","product_count":2,"categories":["Meat/Poultry"],"graph":"supply_chain"}'),
('nw_sup_26', 'person', 'Pasta Buttini s.r.l.',        'supplier', '["supplier","italy","northwind"]',   6, '{"nw_id":26,"contact":"Giovanni Giudici","country":"Italy","city":"Salerno","product_count":2,"categories":["Grains/Cereals"],"graph":"supply_chain"}'),
('nw_sup_27', 'person', 'Escargots Nouveaux',          'supplier', '["supplier","france","northwind"]',  6, '{"nw_id":27,"contact":"Marie Delamare","country":"France","city":"Montceau","product_count":1,"categories":["Seafood"],"graph":"supply_chain"}'),
('nw_sup_28', 'person', 'Gai pâturage',                'supplier', '["supplier","france","northwind"]',  6, '{"nw_id":28,"contact":"Eliane Noz","country":"France","city":"Annecy","product_count":2,"categories":["Dairy Products","Confections"],"graph":"supply_chain"}'),
('nw_sup_29', 'person', 'Forêts d''érables',           'supplier', '["supplier","canada","northwind"]',  6, '{"nw_id":29,"contact":"Chantal Goulet","country":"Canada","city":"Ste-Hyacinthe","product_count":2,"categories":["Dairy Products","Confections"],"graph":"supply_chain"}');

-- ============================================================================
-- NODES: PRODUCTS (77 — representative 30 for demo clarity)
-- The bridge nodes in supply chain: Supplier → Product → Category
-- High-value / high-volume products selected for graph centrality
-- Note: full 77-product seed would be in production; this is the demo-optimized set
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
-- Beverages (cat 1) — Côte de Blaye is the star: highest price, highest revenue
('nw_p_1',  'resource', 'Chai',                    'product', '["product","beverage","northwind"]', 5, '{"nw_id":1, "supplier_id":1, "category_id":1, "unit_price":18.00, "units_in_stock":39, "discontinued":false, "revenue_rank":15}'),
('nw_p_2',  'resource', 'Chang',                   'product', '["product","beverage","northwind"]', 5, '{"nw_id":2, "supplier_id":1, "category_id":1, "unit_price":19.00, "units_in_stock":17, "discontinued":false, "revenue_rank":14}'),
('nw_p_38', 'resource', 'Côte de Blaye',           'product', '["product","beverage","northwind","top_seller"]', 10, '{"nw_id":38,"supplier_id":18,"category_id":1, "unit_price":263.50,"units_in_stock":17, "discontinued":false, "revenue_rank":1,"graph_note":"Highest unit price AND revenue. Bridge between French supplier cluster and top customer cluster."}'),
('nw_p_39', 'resource', 'Chartreuse verte',        'product', '["product","beverage","northwind"]', 5, '{"nw_id":39,"supplier_id":18,"category_id":1, "unit_price":18.00, "units_in_stock":69, "discontinued":false, "revenue_rank":20}'),
('nw_p_76', 'resource', 'Lakkalikööri',            'product', '["product","beverage","northwind"]', 4, '{"nw_id":76,"supplier_id":23,"category_id":1, "unit_price":18.00, "units_in_stock":57, "discontinued":false, "revenue_rank":25}'),
-- Condiments (cat 2)
('nw_p_3',  'resource', 'Aniseed Syrup',           'product', '["product","condiment","northwind"]', 4, '{"nw_id":3, "supplier_id":1, "category_id":2, "unit_price":10.00, "units_in_stock":13, "discontinued":false, "revenue_rank":50}'),
('nw_p_4',  'resource', 'Chef Anton''s Cajun Seasoning','product','["product","condiment","northwind"]',5,'{"nw_id":4, "supplier_id":2, "category_id":2, "unit_price":22.00, "units_in_stock":53, "discontinued":false, "revenue_rank":30}'),
('nw_p_6',  'resource', 'Grandma''s Boysenberry Spread','product','["product","condiment","northwind"]',5,'{"nw_id":6, "supplier_id":3, "category_id":2, "unit_price":25.00, "units_in_stock":120,"discontinued":false, "revenue_rank":22}'),
-- Confections (cat 3) 
('nw_p_16', 'resource', 'Pavlova',                 'product', '["product","confection","northwind"]', 6, '{"nw_id":16,"supplier_id":7, "category_id":3, "unit_price":17.45, "units_in_stock":29, "discontinued":false, "revenue_rank":18}'),
('nw_p_19', 'resource', 'Teatime Chocolate Biscuits','product','["product","confection","northwind"]',5,'{"nw_id":19,"supplier_id":8, "category_id":3, "unit_price":9.20,  "units_in_stock":25, "discontinued":false, "revenue_rank":45}'),
('nw_p_26', 'resource', 'Gumbär Gummibärchen',     'product', '["product","confection","northwind"]', 6, '{"nw_id":26,"supplier_id":11,"category_id":3, "unit_price":31.23, "units_in_stock":15, "discontinued":false, "revenue_rank":16}'),
('nw_p_27', 'resource', 'Schoggi Schokolade',      'product', '["product","confection","northwind"]', 6, '{"nw_id":27,"supplier_id":11,"category_id":3, "unit_price":43.90, "units_in_stock":49, "discontinued":false, "revenue_rank":12}'),
-- Dairy Products (cat 4) — Raclette and Camembert are revenue leaders
('nw_p_11', 'resource', 'Queso Cabrales',          'product', '["product","dairy","northwind"]',  6, '{"nw_id":11,"supplier_id":5, "category_id":4, "unit_price":21.00, "units_in_stock":22, "discontinued":false, "revenue_rank":19}'),
('nw_p_59', 'resource', 'Raclette Courdavault',    'product', '["product","dairy","northwind","top_seller"]',9,'{"nw_id":59,"supplier_id":28,"category_id":4,"unit_price":55.00, "units_in_stock":79, "discontinued":false,"revenue_rank":3,"graph_note":"High price × high volume. French supplier bridge. Top dairy node."}'),
('nw_p_60', 'resource', 'Camembert Pierrot',       'product', '["product","dairy","northwind","top_seller"]',8,'{"nw_id":60,"supplier_id":28,"category_id":4,"unit_price":34.00, "units_in_stock":19, "discontinued":false,"revenue_rank":5}'),
-- Grains/Cereals (cat 5)
('nw_p_56', 'resource', 'Gnocchi di nonna Alice',  'product', '["product","grain","northwind","top_seller"]',8,'{"nw_id":56,"supplier_id":26,"category_id":5,"unit_price":38.00, "units_in_stock":21, "discontinued":false,"revenue_rank":6}'),
('nw_p_57', 'resource', 'Ravioli Angelo',          'product', '["product","grain","northwind"]',  6, '{"nw_id":57,"supplier_id":26,"category_id":5, "unit_price":19.50, "units_in_stock":36, "discontinued":false, "revenue_rank":24}'),
-- Meat/Poultry (cat 6)
('nw_p_9',  'resource', 'Mishi Kobe Niku',         'product', '["product","meat","northwind"]',  5, '{"nw_id":9, "supplier_id":4, "category_id":6, "unit_price":97.00, "units_in_stock":29, "discontinued":true,  "revenue_rank":8}'),
('nw_p_17', 'resource', 'Alice Mutton',            'product', '["product","meat","northwind"]',  5, '{"nw_id":17,"supplier_id":7, "category_id":6, "unit_price":39.00, "units_in_stock":0,  "discontinued":true,  "revenue_rank":28}'),
('nw_p_29', 'resource', 'Thüringer Rostbratwurst', 'product', '["product","meat","northwind","top_seller"]',9,'{"nw_id":29,"supplier_id":12,"category_id":6,"unit_price":123.79,"units_in_stock":0,  "discontinued":true, "revenue_rank":2,"graph_note":"Highest revenue after Côte de Blaye. Discontinued. German supplier. Shows how discontinued products can still dominate the graph."}'),
-- Produce (cat 7)
('nw_p_7',  'resource', 'Uncle Bob''s Organic Dried Pears','product','["product","produce","northwind"]',5,'{"nw_id":7,"supplier_id":3,"category_id":7,"unit_price":30.00,"units_in_stock":15,"discontinued":false,"revenue_rank":35}'),
('nw_p_14', 'resource', 'Tofu',                    'product', '["product","produce","northwind"]',  5, '{"nw_id":14,"supplier_id":6, "category_id":7, "unit_price":23.25, "units_in_stock":35, "discontinued":false, "revenue_rank":32}'),
('nw_p_28', 'resource', 'Rössle Sauerkraut',       'product', '["product","produce","northwind"]',  5, '{"nw_id":28,"supplier_id":12,"category_id":7, "unit_price":45.60, "units_in_stock":26, "discontinued":true,  "revenue_rank":26}'),
-- Seafood (cat 8) — Boston Crab Meat and Carnarvon Tigers are top
('nw_p_10', 'resource', 'Ikura',                   'product', '["product","seafood","northwind"]',  6, '{"nw_id":10,"supplier_id":4, "category_id":8, "unit_price":31.00, "units_in_stock":31, "discontinued":false, "revenue_rank":17}'),
('nw_p_13', 'resource', 'Konbu',                   'product', '["product","seafood","northwind"]',  5, '{"nw_id":13,"supplier_id":6, "category_id":8, "unit_price":6.00,  "units_in_stock":24, "discontinued":false, "revenue_rank":55}'),
('nw_p_18', 'resource', 'Carnarvon Tigers',        'product', '["product","seafood","northwind","top_seller"]',8,'{"nw_id":18,"supplier_id":7,"category_id":8,"unit_price":62.50,"units_in_stock":42, "discontinued":false,"revenue_rank":4}'),
('nw_p_40', 'resource', 'Boston Crab Meat',        'product', '["product","seafood","northwind","top_seller"]',8,'{"nw_id":40,"supplier_id":19,"category_id":8,"unit_price":18.40,"units_in_stock":123,"discontinued":false,"revenue_rank":7}'),
('nw_p_41', 'resource', 'Jack''s New England Clam Chowder','product','["product","seafood","northwind"]',6,'{"nw_id":41,"supplier_id":19,"category_id":8,"unit_price":9.65,"units_in_stock":85,"discontinued":false,"revenue_rank":21}'),
('nw_p_36', 'resource', 'Inlagd Sill',             'product', '["product","seafood","northwind"]',  5, '{"nw_id":36,"supplier_id":17,"category_id":8, "unit_price":19.00, "units_in_stock":112,"discontinued":false, "revenue_rank":29}'),
('nw_p_37', 'resource', 'Gravad Lax',              'product', '["product","seafood","northwind"]',  5, '{"nw_id":37,"supplier_id":17,"category_id":8, "unit_price":26.00, "units_in_stock":11, "discontinued":false, "revenue_rank":23}');

-- ============================================================================
-- NODES: EMPLOYEES (9)
-- The org chart lives in reports_to — a recursive FK nobody visualizes as a tree
-- Also connected to territories for the coverage map
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
-- The hierarchy: Fuller (2) is VP Sales, everyone reports to him
-- Buchanan (5) manages three (6,7,9)
('nw_emp_1', 'person', 'Nancy Davolio',   'employee', '["employee","sales_rep","northwind","wa"]', 7, '{"nw_id":1,"title":"Sales Representative","reports_to":2,"city":"Seattle","region":"WA","hire_year":1992,"territory_count":3,"order_count":123,"graph":"org_territory"}'),
('nw_emp_2', 'person', 'Andrew Fuller',   'employee', '["employee","vp","northwind","wa","manager"]',10,'{"nw_id":2,"title":"Vice President Sales","reports_to":null,"city":"Tacoma","region":"WA","hire_year":1992,"territory_count":5,"order_count":96,"graph":"org_territory","graph_note":"Root of org tree. Highest betweenness centrality. Manages all 8 others directly or indirectly."}'),
('nw_emp_3', 'person', 'Janet Leverling', 'employee', '["employee","sales_rep","northwind","wa"]', 7, '{"nw_id":3,"title":"Sales Representative","reports_to":2,"city":"Kirkland","region":"WA","hire_year":1992,"territory_count":4,"order_count":127,"graph":"org_territory"}'),
('nw_emp_4', 'person', 'Margaret Peacock','employee', '["employee","sales_rep","northwind","wa"]', 7, '{"nw_id":4,"title":"Sales Representative","reports_to":2,"city":"Redmond","region":"WA","hire_year":1993,"territory_count":3,"order_count":156,"graph":"org_territory","graph_note":"Highest order count. Central in velocity network."}'),
('nw_emp_5', 'person', 'Steven Buchanan', 'employee', '["employee","manager","northwind","uk"]',   8, '{"nw_id":5,"title":"Sales Manager","reports_to":2,"city":"London","region":null,"hire_year":1993,"territory_count":4,"order_count":42,"graph":"org_territory","graph_note":"UK manager. Bridge between US cluster and European customer cluster."}'),
('nw_emp_6', 'person', 'Michael Suyama',  'employee', '["employee","sales_rep","northwind","uk"]', 6, '{"nw_id":6,"title":"Sales Representative","reports_to":5,"city":"London","region":null,"hire_year":1993,"territory_count":5,"order_count":67,"graph":"org_territory"}'),
('nw_emp_7', 'person', 'Robert King',     'employee', '["employee","sales_rep","northwind","uk"]', 6, '{"nw_id":7,"title":"Sales Representative","reports_to":5,"city":"London","region":null,"hire_year":1994,"territory_count":10,"order_count":72,"graph":"org_territory","graph_note":"Most territory assignments (10). Geographic coverage outlier."}'),
('nw_emp_8', 'person', 'Laura Callahan',  'employee', '["employee","sales_rep","northwind","wa"]', 7, '{"nw_id":8,"title":"Inside Sales Coordinator","reports_to":2,"city":"Seattle","region":"WA","hire_year":1994,"territory_count":3,"order_count":104,"graph":"org_territory"}'),
('nw_emp_9', 'person', 'Anne Dodsworth',  'employee', '["employee","sales_rep","northwind","uk"]', 5, '{"nw_id":9,"title":"Sales Representative","reports_to":5,"city":"London","region":null,"hire_year":1994,"territory_count":5,"order_count":43,"graph":"org_territory"}');

-- ============================================================================
-- NODES: SHIPPERS (3)
-- Small cluster but structurally important in Graph 4 (velocity) and Graph 5 (geo)
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
('nw_ship_1', 'resource', 'Speedy Express',  'shipper', '["shipper","northwind"]', 6, '{"nw_id":1,"phone":"(503) 555-9831","order_count":249,"avg_freight":66.63,"graph":"velocity"}'),
('nw_ship_2', 'resource', 'United Package',  'shipper', '["shipper","northwind"]', 7, '{"nw_id":2,"phone":"(503) 555-3199","order_count":326,"avg_freight":65.67,"graph":"velocity","graph_note":"Highest order count. Bridge between employee network and customer destinations."}'),
('nw_ship_3', 'resource', 'Federal Shipping','shipper', '["shipper","northwind"]', 6, '{"nw_id":3,"phone":"(503) 555-9931","order_count":255,"avg_freight":68.03,"graph":"velocity"}');

-- ============================================================================
-- NODES: KEY CUSTOMERS (representative 20 of 91)
-- Selected for graph centrality: highest revenue, most orders, most countries
-- The full 91-customer set would be in production
-- ============================================================================
INSERT INTO nodes (id, node_type, name, folder, tags, priority, content) VALUES
-- Top revenue customers (these dominate the co-purchase and velocity graphs)
('nw_cust_QUICK', 'person', 'QUICK-Stop',                    'customer', '["customer","germany","northwind","top_customer"]', 10, '{"nw_id":"QUICK","contact":"Horst Kloss","country":"Germany","city":"Cunewalde","total_orders":28,"total_revenue":110277,"graph_note":"Highest revenue customer. Central in all graphs. Removal would reveal biggest cluster gap."}'),
('nw_cust_ERNSH', 'person', 'Ernst Handel',                  'customer', '["customer","austria","northwind","top_customer"]',  9,  '{"nw_id":"ERNSH","contact":"Roland Mendel","country":"Austria","city":"Graz","total_orders":30,"total_revenue":104875,"graph_note":"Most orders of any customer (30). Austrian anchor of Central European cluster."}'),
('nw_cust_SAVEA', 'person', 'Save-a-lot Markets',            'customer', '["customer","usa","northwind","top_customer"]',      9,  '{"nw_id":"SAVEA","contact":"Jose Pavarotti","country":"USA","city":"Boise","total_orders":31,"total_revenue":104361,"graph_note":"Most orders tied with ERNSH. US West Coast anchor."}'),
('nw_cust_RATTC', 'person', 'Rattlesnake Canyon Grocery',    'customer', '["customer","usa","northwind"]',                     7,  '{"nw_id":"RATTC","contact":"Paula Wilson","country":"USA","city":"Albuquerque","total_orders":18,"total_revenue":51098}'),
('nw_cust_HANAR', 'person', 'Hanari Carnes',                 'customer', '["customer","brazil","northwind"]',                  7,  '{"nw_id":"HANAR","contact":"Mario Pontes","country":"Brazil","city":"Rio de Janeiro","total_orders":14,"total_revenue":32555}'),
('nw_cust_BERGS', 'person', 'Berglunds snabbköp',            'customer', '["customer","sweden","northwind"]',                  7,  '{"nw_id":"BERGS","contact":"Christina Berglund","country":"Sweden","city":"Luleå","total_orders":18,"total_revenue":26969}'),
('nw_cust_FOLKO', 'person', 'Folk och fä HB',                'customer', '["customer","sweden","northwind"]',                  6,  '{"nw_id":"FOLKO","contact":"Maria Larsson","country":"Sweden","city":"Bräcke","total_orders":19,"total_revenue":24244}'),
('nw_cust_HUNGO', 'person', 'Hungry Owl All-Night Grocers',  'customer', '["customer","ireland","northwind"]',                 7,  '{"nw_id":"HUNGO","contact":"Patricia McKenna","country":"Ireland","city":"Cork","total_orders":19,"total_revenue":49979}'),
('nw_cust_HILAA', 'person', 'HILARION-Abastos',              'customer', '["customer","venezuela","northwind"]',               6,  '{"nw_id":"HILAA","contact":"Carlos Hernández","country":"Venezuela","city":"San Cristóbal","total_orders":18,"total_revenue":27364}'),
('nw_cust_KOENE', 'person', 'Königlich Essen',               'customer', '["customer","germany","northwind"]',                 7,  '{"nw_id":"KOENE","contact":"Philip Cramer","country":"Germany","city":"Brandenburg","total_orders":14,"total_revenue":42490}'),
('nw_cust_WHITC', 'person', 'White Clover Markets',          'customer', '["customer","usa","northwind"]',                     6,  '{"nw_id":"WHITC","contact":"Karl Jablonski","country":"USA","city":"Seattle","total_orders":14,"total_revenue":21844}'),
('nw_cust_BLONP', 'person', 'Blondesddsl père et fils',      'customer', '["customer","france","northwind"]',                  6,  '{"nw_id":"BLONP","contact":"Frédérique Citeaux","country":"France","city":"Strasbourg","total_orders":11,"total_revenue":12601}'),
('nw_cust_BONAP', 'person', 'Bon app''',                     'customer', '["customer","france","northwind"]',                  7,  '{"nw_id":"BONAP","contact":"Laurence Lebihan","country":"France","city":"Marseille","total_orders":17,"total_revenue":23479}'),
('nw_cust_BOTTM', 'person', 'Bottom-Dollar Markets',         'customer', '["customer","canada","northwind"]',                  7,  '{"nw_id":"BOTTM","contact":"Elizabeth Lincoln","country":"Canada","city":"Tsawassen","total_orders":14,"total_revenue":38650}'),
('nw_cust_SUPRD', 'person', 'Suprêmes délices',              'customer', '["customer","belgium","northwind"]',                 6,  '{"nw_id":"SUPRD","contact":"Pascale Cartrain","country":"Belgium","city":"Charleroi","total_orders":12,"total_revenue":26260}'),
('nw_cust_PICCO', 'person', 'Piccolo und mehr',              'customer', '["customer","austria","northwind"]',                 6,  '{"nw_id":"PICCO","contact":"Georg Pipps","country":"Austria","city":"Salzburg","total_orders":10,"total_revenue":20480}'),
('nw_cust_FRANK', 'person', 'Frankenversand',                'customer', '["customer","germany","northwind"]',                 6,  '{"nw_id":"FRANK","contact":"Peter Franken","country":"Germany","city":"München","total_orders":15,"total_revenue":24612}'),
('nw_cust_RICSU', 'person', 'Richter Supermarkt',            'customer', '["customer","switzerland","northwind"]',             6,  '{"nw_id":"RICSU","contact":"Michael Holz","country":"Switzerland","city":"Genève","total_orders":10,"total_revenue":26838}'),
('nw_cust_LAZYK', 'person', 'Lazy K Kountry Store',          'customer', '["customer","usa","northwind"]',                     3,  '{"nw_id":"LAZYK","contact":"John Steel","country":"USA","city":"Walla Walla","total_orders":2,"total_revenue":357,"graph_note":"Fewest orders (2). Isolated node. Useful for demonstrating periphery vs. core."}'),
('nw_cust_ANATR', 'person', 'Ana Trujillo Emparedados',      'customer', '["customer","mexico","northwind"]',                  5,  '{"nw_id":"ANATR","contact":"Ana Trujillo","country":"Mexico","city":"México D.F.","total_orders":4,"total_revenue":1402}');

-- ============================================================================
-- EDGES: GRAPH 1 — SUPPLY CHAIN
-- Supplier → SUPPLIES → Product → BELONGS_TO → Category
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
-- SUPPLIES edges (supplier → product)
-- Key suppliers to key products
('nw_e_s1_p38',  'LINK', 'nw_sup_18', 'nw_p_38',  1.0, 'SUPPLIES', 1),  -- Aux joyeux → Côte de Blaye (revenue king)
('nw_e_s1_p39',  'LINK', 'nw_sup_18', 'nw_p_39',  0.6, 'SUPPLIES', 1),  -- Aux joyeux → Chartreuse
('nw_e_s12_p29', 'LINK', 'nw_sup_12', 'nw_p_29',  1.0, 'SUPPLIES', 1),  -- Plutzer → Thüringer (revenue #2)
('nw_e_s12_p28', 'LINK', 'nw_sup_12', 'nw_p_28',  0.5, 'SUPPLIES', 1),  -- Plutzer → Rössle Sauerkraut
('nw_e_s28_p59', 'LINK', 'nw_sup_28', 'nw_p_59',  0.9, 'SUPPLIES', 1),  -- Gai pâturage → Raclette (#3)
('nw_e_s28_p60', 'LINK', 'nw_sup_28', 'nw_p_60',  0.8, 'SUPPLIES', 1),  -- Gai pâturage → Camembert (#5)
('nw_e_s7_p18',  'LINK', 'nw_sup_7',  'nw_p_18',  0.8, 'SUPPLIES', 1),  -- Pavlova → Carnarvon Tigers (#4)
('nw_e_s7_p16',  'LINK', 'nw_sup_7',  'nw_p_16',  0.7, 'SUPPLIES', 1),  -- Pavlova → Pavlova product
('nw_e_s7_p17',  'LINK', 'nw_sup_7',  'nw_p_17',  0.5, 'SUPPLIES', 1),  -- Pavlova → Alice Mutton
('nw_e_s26_p56', 'LINK', 'nw_sup_26', 'nw_p_56',  0.8, 'SUPPLIES', 1),  -- Pasta Buttini → Gnocchi (#6)
('nw_e_s26_p57', 'LINK', 'nw_sup_26', 'nw_p_57',  0.6, 'SUPPLIES', 1),  -- Pasta Buttini → Ravioli
('nw_e_s19_p40', 'LINK', 'nw_sup_19', 'nw_p_40',  0.8, 'SUPPLIES', 1),  -- New England → Boston Crab (#7)
('nw_e_s19_p41', 'LINK', 'nw_sup_19', 'nw_p_41',  0.6, 'SUPPLIES', 1),  -- New England → Clam Chowder
('nw_e_s4_p9',   'LINK', 'nw_sup_4',  'nw_p_9',   0.5, 'SUPPLIES', 1),  -- Tokyo → Mishi Kobe
('nw_e_s4_p10',  'LINK', 'nw_sup_4',  'nw_p_10',  0.6, 'SUPPLIES', 1),  -- Tokyo → Ikura
('nw_e_s1_p1',   'LINK', 'nw_sup_1',  'nw_p_1',   0.5, 'SUPPLIES', 1),  -- Exotic Liquids → Chai
('nw_e_s1_p2',   'LINK', 'nw_sup_1',  'nw_p_2',   0.5, 'SUPPLIES', 1),  -- Exotic Liquids → Chang
('nw_e_s1_p3',   'LINK', 'nw_sup_1',  'nw_p_3',   0.4, 'SUPPLIES', 1),  -- Exotic Liquids → Aniseed Syrup
('nw_e_s11_p26', 'LINK', 'nw_sup_11', 'nw_p_26',  0.6, 'SUPPLIES', 1),  -- Heli → Gummibärchen
('nw_e_s11_p27', 'LINK', 'nw_sup_11', 'nw_p_27',  0.7, 'SUPPLIES', 1),  -- Heli → Schoggi Schokolade
('nw_e_s17_p36', 'LINK', 'nw_sup_17', 'nw_p_36',  0.5, 'SUPPLIES', 1),  -- Svensk → Inlagd Sill
('nw_e_s17_p37', 'LINK', 'nw_sup_17', 'nw_p_37',  0.5, 'SUPPLIES', 1),  -- Svensk → Gravad Lax
('nw_e_s6_p14',  'LINK', 'nw_sup_6',  'nw_p_14',  0.5, 'SUPPLIES', 1),  -- Mayumi → Tofu
('nw_e_s6_p13',  'LINK', 'nw_sup_6',  'nw_p_13',  0.4, 'SUPPLIES', 1),  -- Mayumi → Konbu
('nw_e_s2_p4',   'LINK', 'nw_sup_2',  'nw_p_4',   0.5, 'SUPPLIES', 1),  -- NO Cajun → Chef Anton Cajun
('nw_e_s3_p6',   'LINK', 'nw_sup_3',  'nw_p_6',   0.5, 'SUPPLIES', 1),  -- Grandma Kelly → Boysenberry
('nw_e_s3_p7',   'LINK', 'nw_sup_3',  'nw_p_7',   0.5, 'SUPPLIES', 1),  -- Grandma Kelly → Dried Pears
('nw_e_s8_p19',  'LINK', 'nw_sup_8',  'nw_p_19',  0.4, 'SUPPLIES', 1),  -- Specialty Biscuits → Teatime
('nw_e_s5_p11',  'LINK', 'nw_sup_5',  'nw_p_11',  0.5, 'SUPPLIES', 1);  -- Cooperativa → Queso Cabrales

-- BELONGS_TO edges (product → category)
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
('nw_e_p1_c1',   'NEST', 'nw_p_1',  'nw_cat_1', 1.0, 'BELONGS_TO', 1),
('nw_e_p2_c1',   'NEST', 'nw_p_2',  'nw_cat_1', 1.0, 'BELONGS_TO', 1),
('nw_e_p38_c1',  'NEST', 'nw_p_38', 'nw_cat_1', 1.0, 'BELONGS_TO', 1),
('nw_e_p39_c1',  'NEST', 'nw_p_39', 'nw_cat_1', 1.0, 'BELONGS_TO', 1),
('nw_e_p76_c1',  'NEST', 'nw_p_76', 'nw_cat_1', 1.0, 'BELONGS_TO', 1),
('nw_e_p3_c2',   'NEST', 'nw_p_3',  'nw_cat_2', 1.0, 'BELONGS_TO', 1),
('nw_e_p4_c2',   'NEST', 'nw_p_4',  'nw_cat_2', 1.0, 'BELONGS_TO', 1),
('nw_e_p6_c2',   'NEST', 'nw_p_6',  'nw_cat_2', 1.0, 'BELONGS_TO', 1),
('nw_e_p16_c3',  'NEST', 'nw_p_16', 'nw_cat_3', 1.0, 'BELONGS_TO', 1),
('nw_e_p19_c3',  'NEST', 'nw_p_19', 'nw_cat_3', 1.0, 'BELONGS_TO', 1),
('nw_e_p26_c3',  'NEST', 'nw_p_26', 'nw_cat_3', 1.0, 'BELONGS_TO', 1),
('nw_e_p27_c3',  'NEST', 'nw_p_27', 'nw_cat_3', 1.0, 'BELONGS_TO', 1),
('nw_e_p11_c4',  'NEST', 'nw_p_11', 'nw_cat_4', 1.0, 'BELONGS_TO', 1),
('nw_e_p59_c4',  'NEST', 'nw_p_59', 'nw_cat_4', 1.0, 'BELONGS_TO', 1),
('nw_e_p60_c4',  'NEST', 'nw_p_60', 'nw_cat_4', 1.0, 'BELONGS_TO', 1),
('nw_e_p56_c5',  'NEST', 'nw_p_56', 'nw_cat_5', 1.0, 'BELONGS_TO', 1),
('nw_e_p57_c5',  'NEST', 'nw_p_57', 'nw_cat_5', 1.0, 'BELONGS_TO', 1),
('nw_e_p9_c6',   'NEST', 'nw_p_9',  'nw_cat_6', 1.0, 'BELONGS_TO', 1),
('nw_e_p17_c6',  'NEST', 'nw_p_17', 'nw_cat_6', 1.0, 'BELONGS_TO', 1),
('nw_e_p29_c6',  'NEST', 'nw_p_29', 'nw_cat_6', 1.0, 'BELONGS_TO', 1),
('nw_e_p7_c7',   'NEST', 'nw_p_7',  'nw_cat_7', 1.0, 'BELONGS_TO', 1),
('nw_e_p14_c7',  'NEST', 'nw_p_14', 'nw_cat_7', 1.0, 'BELONGS_TO', 1),
('nw_e_p28_c7',  'NEST', 'nw_p_28', 'nw_cat_7', 1.0, 'BELONGS_TO', 1),
('nw_e_p10_c8',  'NEST', 'nw_p_10', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p13_c8',  'NEST', 'nw_p_13', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p18_c8',  'NEST', 'nw_p_18', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p40_c8',  'NEST', 'nw_p_40', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p41_c8',  'NEST', 'nw_p_41', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p36_c8',  'NEST', 'nw_p_36', 'nw_cat_8', 1.0, 'BELONGS_TO', 1),
('nw_e_p37_c8',  'NEST', 'nw_p_37', 'nw_cat_8', 1.0, 'BELONGS_TO', 1);

-- ============================================================================
-- EDGES: GRAPH 2 — ORG + TERRITORY COVERAGE
-- REPORTS_TO (recursive employee hierarchy)
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
-- Reports-to chain (all 8 report ultimately to Fuller)
('nw_e_emp1_2',  'NEST', 'nw_emp_1', 'nw_emp_2', 0.8, 'REPORTS_TO', 1),
('nw_e_emp3_2',  'NEST', 'nw_emp_3', 'nw_emp_2', 0.8, 'REPORTS_TO', 1),
('nw_e_emp4_2',  'NEST', 'nw_emp_4', 'nw_emp_2', 0.8, 'REPORTS_TO', 1),
('nw_e_emp5_2',  'NEST', 'nw_emp_5', 'nw_emp_2', 0.7, 'REPORTS_TO', 1),
('nw_e_emp6_5',  'NEST', 'nw_emp_6', 'nw_emp_5', 0.8, 'REPORTS_TO', 1),
('nw_e_emp7_5',  'NEST', 'nw_emp_7', 'nw_emp_5', 0.8, 'REPORTS_TO', 1),
('nw_e_emp8_2',  'NEST', 'nw_emp_8', 'nw_emp_2', 0.8, 'REPORTS_TO', 1),
('nw_e_emp9_5',  'NEST', 'nw_emp_9', 'nw_emp_5', 0.8, 'REPORTS_TO', 1);

-- ============================================================================
-- EDGES: GRAPH 3 — CO-PURCHASE AFFINITY (the derived/latent graph)
-- These edges don't exist in Northwind's schema — derived from OrderDetails
-- Weight = normalized co-purchase frequency across 830 orders
-- The revelation: product bundles invisible to any SQL GROUP BY
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
-- Beverages cluster
('nw_cp_1_38',  'AFFINITY', 'nw_p_1',  'nw_p_38',  0.6, 'CO_PURCHASE', 0),  -- Chai ↔ Côte de Blaye
('nw_cp_1_2',   'AFFINITY', 'nw_p_1',  'nw_p_2',   0.8, 'CO_PURCHASE', 0),  -- Chai ↔ Chang (same supplier, often together)
('nw_cp_38_39', 'AFFINITY', 'nw_p_38', 'nw_p_39',  0.7, 'CO_PURCHASE', 0),  -- Côte de Blaye ↔ Chartreuse (French wines together)
-- Dairy cluster (the tightest co-purchase cluster)
('nw_cp_59_60', 'AFFINITY', 'nw_p_59', 'nw_p_60',  0.9, 'CO_PURCHASE', 0),  -- Raclette ↔ Camembert (same supplier, same occasion)
('nw_cp_59_11', 'AFFINITY', 'nw_p_59', 'nw_p_11',  0.7, 'CO_PURCHASE', 0),  -- Raclette ↔ Queso Cabrales
('nw_cp_60_11', 'AFFINITY', 'nw_p_60', 'nw_p_11',  0.6, 'CO_PURCHASE', 0),  -- Camembert ↔ Queso Cabrales
-- Seafood cluster
('nw_cp_40_41', 'AFFINITY', 'nw_p_40', 'nw_p_41',  0.8, 'CO_PURCHASE', 0),  -- Boston Crab ↔ Clam Chowder (same supplier)
('nw_cp_18_40', 'AFFINITY', 'nw_p_18', 'nw_p_40',  0.6, 'CO_PURCHASE', 0),  -- Carnarvon Tigers ↔ Boston Crab
('nw_cp_36_37', 'AFFINITY', 'nw_p_36', 'nw_p_37',  0.8, 'CO_PURCHASE', 0),  -- Inlagd Sill ↔ Gravad Lax (Swedish fish together)
('nw_cp_10_13', 'AFFINITY', 'nw_p_10', 'nw_p_13',  0.7, 'CO_PURCHASE', 0),  -- Ikura ↔ Konbu (Japanese seafood)
-- The BRIDGE edges — cross-category bundles (the real insight)
-- These connect otherwise separate clusters: the graph reveals natural meal pairings
('nw_cp_38_59', 'AFFINITY', 'nw_p_38', 'nw_p_59',  0.7, 'CO_PURCHASE', 0),  -- Côte de Blaye ↔ Raclette (wine + cheese = dinner party)
('nw_cp_38_60', 'AFFINITY', 'nw_p_38', 'nw_p_60',  0.6, 'CO_PURCHASE', 0),  -- Côte de Blaye ↔ Camembert
('nw_cp_29_56', 'AFFINITY', 'nw_p_29', 'nw_p_56',  0.6, 'CO_PURCHASE', 0),  -- Thüringer ↔ Gnocchi (meat + pasta)
('nw_cp_18_59', 'AFFINITY', 'nw_p_18', 'nw_p_59',  0.5, 'CO_PURCHASE', 0),  -- Carnarvon Tigers ↔ Raclette (premium occasion cluster)
-- Condiment-as-bridge: condiments appear across categories
('nw_cp_4_29',  'AFFINITY', 'nw_p_4',  'nw_p_29',  0.5, 'CO_PURCHASE', 0),  -- Chef Anton Cajun ↔ Thüringer
('nw_cp_6_7',   'AFFINITY', 'nw_p_6',  'nw_p_7',   0.6, 'CO_PURCHASE', 0),  -- Boysenberry Spread ↔ Dried Pears (same supplier, gift basket)
-- Confection cluster
('nw_cp_26_27', 'AFFINITY', 'nw_p_26', 'nw_p_27',  0.8, 'CO_PURCHASE', 0),  -- Gummibärchen ↔ Schoggi Schokolade (same supplier)
('nw_cp_16_19', 'AFFINITY', 'nw_p_16', 'nw_p_19',  0.5, 'CO_PURCHASE', 0);  -- Pavlova ↔ Teatime Biscuits

-- ============================================================================
-- EDGES: GRAPH 4 — ORDER VELOCITY NETWORK
-- Orders as first-class LPG edges between customers and employees
-- Each edge represents a business relationship, not just a transaction
-- Weight = normalized order frequency; properties include freight and date range
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed, channel, subject) VALUES
-- QUICK-Stop (top customer) relationships
('nw_ov_QUICK_4',  'SEQUENCE', 'nw_cust_QUICK', 'nw_emp_4',  1.0, 'ORDER_CHANNEL', 1, 'northwind_orders', 'QUICK-Stop → Peacock: 12 orders, $64K'),
('nw_ov_QUICK_3',  'SEQUENCE', 'nw_cust_QUICK', 'nw_emp_3',  0.7, 'ORDER_CHANNEL', 1, 'northwind_orders', 'QUICK-Stop → Leverling: 8 orders'),
('nw_ov_QUICK_1',  'SEQUENCE', 'nw_cust_QUICK', 'nw_emp_1',  0.5, 'ORDER_CHANNEL', 1, 'northwind_orders', 'QUICK-Stop → Davolio: 5 orders'),
-- Ernst Handel (most orders) relationships
('nw_ov_ERNSH_4',  'SEQUENCE', 'nw_cust_ERNSH', 'nw_emp_4',  0.9, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Ernst Handel → Peacock: 10 orders'),
('nw_ov_ERNSH_1',  'SEQUENCE', 'nw_cust_ERNSH', 'nw_emp_1',  0.8, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Ernst Handel → Davolio: 9 orders'),
('nw_ov_ERNSH_3',  'SEQUENCE', 'nw_cust_ERNSH', 'nw_emp_3',  0.6, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Ernst Handel → Leverling: 6 orders'),
-- Save-a-lot relationships
('nw_ov_SAVEA_8',  'SEQUENCE', 'nw_cust_SAVEA', 'nw_emp_8',  0.8, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Save-a-lot → Callahan: 8 orders'),
('nw_ov_SAVEA_3',  'SEQUENCE', 'nw_cust_SAVEA', 'nw_emp_3',  0.7, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Save-a-lot → Leverling: 7 orders'),
('nw_ov_SAVEA_4',  'SEQUENCE', 'nw_cust_SAVEA', 'nw_emp_4',  0.6, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Save-a-lot → Peacock: 6 orders'),
-- Hungry Owl (Ireland — Buchanan/UK cluster)
('nw_ov_HUNGO_5',  'SEQUENCE', 'nw_cust_HUNGO', 'nw_emp_5',  0.8, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Hungry Owl → Buchanan: 7 orders (UK cluster)'),
('nw_ov_HUNGO_7',  'SEQUENCE', 'nw_cust_HUNGO', 'nw_emp_7',  0.6, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Hungry Owl → King: 5 orders'),
-- Berglunds (Sweden — Davolio relationship)
('nw_ov_BERGS_1',  'SEQUENCE', 'nw_cust_BERGS', 'nw_emp_1',  0.7, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Berglunds → Davolio: 7 orders'),
('nw_ov_BERGS_3',  'SEQUENCE', 'nw_cust_BERGS', 'nw_emp_3',  0.5, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Berglunds → Leverling: 4 orders'),
-- Königlich Essen (Germany high value)
('nw_ov_KOENE_2',  'SEQUENCE', 'nw_cust_KOENE', 'nw_emp_2',  0.7, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Königlich Essen → Fuller: 7 orders (VP direct)'),
-- Peacock is the hub — most total orders processed
('nw_ov_RATTC_4',  'SEQUENCE', 'nw_cust_RATTC', 'nw_emp_4',  0.6, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Rattlesnake Canyon → Peacock'),
('nw_ov_WHITC_4',  'SEQUENCE', 'nw_cust_WHITC', 'nw_emp_4',  0.5, 'ORDER_CHANNEL', 1, 'northwind_orders', 'White Clover → Peacock (Seattle local)'),
('nw_ov_FRANK_3',  'SEQUENCE', 'nw_cust_FRANK', 'nw_emp_3',  0.5, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Frankenversand → Leverling'),
('nw_ov_BONAP_7',  'SEQUENCE', 'nw_cust_BONAP', 'nw_emp_7',  0.6, 'ORDER_CHANNEL', 1, 'northwind_orders', 'Bon app'' → King (French/UK cluster)'),
-- Shippers as second hop in velocity network
('nw_ov_emp4_ship2','SEQUENCE', 'nw_emp_4', 'nw_ship_2',  0.9, 'SHIPS_VIA', 1, 'northwind_orders', 'Peacock prefers United Package'),
('nw_ov_emp3_ship1','SEQUENCE', 'nw_emp_3', 'nw_ship_1',  0.8, 'SHIPS_VIA', 1, 'northwind_orders', 'Leverling prefers Speedy Express'),
('nw_ov_emp1_ship2','SEQUENCE', 'nw_emp_1', 'nw_ship_2',  0.7, 'SHIPS_VIA', 1, 'northwind_orders', 'Davolio prefers United Package'),
('nw_ov_emp5_ship3','SEQUENCE', 'nw_emp_5', 'nw_ship_3',  0.8, 'SHIPS_VIA', 1, 'northwind_orders', 'Buchanan uses Federal (UK routes)'),
('nw_ov_emp7_ship3','SEQUENCE', 'nw_emp_7', 'nw_ship_3',  0.7, 'SHIPS_VIA', 1, 'northwind_orders', 'King uses Federal (UK/Europe routes)');

-- ============================================================================
-- EDGES: CUSTOMER → PRODUCT (ORDERED — representative set)
-- Which customers buy which products — the demand side of supply chain graph
-- Weight = normalized order frequency for this customer-product pair
-- ============================================================================
INSERT INTO edges (id, edge_type, source_id, target_id, weight, label, directed) VALUES
-- QUICK-Stop buys premium products
('nw_ord_QUICK_38', 'LINK', 'nw_cust_QUICK', 'nw_p_38',  0.9, 'ORDERED', 1),  -- Côte de Blaye (premium buyer)
('nw_ord_QUICK_59', 'LINK', 'nw_cust_QUICK', 'nw_p_59',  0.8, 'ORDERED', 1),  -- Raclette
('nw_ord_QUICK_29', 'LINK', 'nw_cust_QUICK', 'nw_p_29',  0.7, 'ORDERED', 1),  -- Thüringer
-- Ernst Handel — volume buyer
('nw_ord_ERNSH_38', 'LINK', 'nw_cust_ERNSH', 'nw_p_38',  0.8, 'ORDERED', 1),
('nw_ord_ERNSH_56', 'LINK', 'nw_cust_ERNSH', 'nw_p_56',  0.7, 'ORDERED', 1),  -- Gnocchi
('nw_ord_ERNSH_40', 'LINK', 'nw_cust_ERNSH', 'nw_p_40',  0.6, 'ORDERED', 1),  -- Boston Crab
-- Save-a-lot — breadth buyer
('nw_ord_SAVEA_60', 'LINK', 'nw_cust_SAVEA', 'nw_p_60',  0.7, 'ORDERED', 1),  -- Camembert
('nw_ord_SAVEA_40', 'LINK', 'nw_cust_SAVEA', 'nw_p_40',  0.7, 'ORDERED', 1),  -- Boston Crab
('nw_ord_SAVEA_18', 'LINK', 'nw_cust_SAVEA', 'nw_p_18',  0.6, 'ORDERED', 1),  -- Carnarvon Tigers
-- Hungry Owl — Irish premium
('nw_ord_HUNGO_38', 'LINK', 'nw_cust_HUNGO', 'nw_p_38',  0.7, 'ORDERED', 1),
('nw_ord_HUNGO_18', 'LINK', 'nw_cust_HUNGO', 'nw_p_18',  0.6, 'ORDERED', 1),
-- Berglunds — Swedish, buys Swedish products (geographic affinity!)
('nw_ord_BERGS_36', 'LINK', 'nw_cust_BERGS', 'nw_p_36',  0.8, 'ORDERED', 1),  -- Inlagd Sill (Swedish herring)
('nw_ord_BERGS_37', 'LINK', 'nw_cust_BERGS', 'nw_p_37',  0.7, 'ORDERED', 1),  -- Gravad Lax (Swedish salmon)
-- Lazy K — minimal buyer (illustrates peripheral node)
('nw_ord_LAZYK_1',  'LINK', 'nw_cust_LAZYK', 'nw_p_1',   0.3, 'ORDERED', 1),  -- Just Chai
('nw_ord_LAZYK_6',  'LINK', 'nw_cust_LAZYK', 'nw_p_6',   0.2, 'ORDERED', 1);  -- And Boysenberry Spread

-- ============================================================================
-- SETTINGS: Dataset metadata for Isometry
-- ============================================================================
INSERT OR REPLACE INTO settings (key, value) VALUES
  ('demo_dataset',              'northwind_graph'),
  ('demo_dataset_version',      '1.0'),
  ('demo_graph_count',          '5'),
  ('demo_node_types',           'customer,employee,supplier,product,category,shipper'),
  ('demo_description',          'Northwind Traders reimagined as five interlocking graphs. Same 14 tables. New eyes. Supply Chain · Org+Territory · Co-Purchase (derived) · Order Velocity · Geographic Trade Flow.'),
  ('demo_tagline',              'Same data. New eyes.'),
  ('demo_graph_1',              'Supply Chain: Supplier → Product → Category → Customer'),
  ('demo_graph_2',              'Org + Territory: Employee hierarchy × geographic coverage'),
  ('demo_graph_3',              'Co-Purchase Affinity: Latent product bundles derived from OrderDetails'),
  ('demo_graph_4',              'Order Velocity: Orders as first-class LPG edges'),
  ('demo_graph_5',              'Geographic Trade Flow: L-axis dominant, supply chain on a map'),
  ('demo_insight_1',            'QUICK-Stop removal disconnects the German premium cluster'),
  ('demo_insight_2',            'Côte de Blaye + Raclette bridge: wine+cheese co-purchase is the highest-value cross-category bundle'),
  ('demo_insight_3',            'Robert King covers 10 territories but reports to Buchanan who covers 4 — management/coverage mismatch'),
  ('demo_insight_4',            'Berglunds snabbköp buys Swedish seafood from Swedish suppliers — geographic affinity invisible to SQL GROUP BY'),
  ('demo_insight_5',            'Thüringer Rostbratwurst is discontinued but still shows highest revenue edge weight — ghost product problem');
