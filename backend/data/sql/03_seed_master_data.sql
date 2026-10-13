-- 1. Create missing silver.inventory table and gold.v_telemetry_1m view for MCP tools
CREATE TABLE IF NOT EXISTS silver.inventory (
  plant_id STRING,
  part_id STRING,
  stock_qty INT64,
  reserved_qty INT64,
  location_bin STRING,
  last_updated TIMESTAMP
);

CREATE OR REPLACE VIEW gold.v_telemetry_1m AS
SELECT
  ts_min,
  sim_ts_min,
  plant_id,
  line_id,
  asset_id,
  metric,
  avg_value,
  min_value,
  max_value,
  std_value,
  n
FROM silver.telemetry_1m;

-- 2. Seed Master Assets
MERGE kg.n_asset T USING (
  SELECT 'PNQ-CNC-07' AS asset_id, 'PNQ' AS plant_id, 'PNQ-L1' AS line_id, 'CNC Machine' AS asset_type, 'CRITICAL' AS criticality UNION ALL
  SELECT 'PNQ-CNC-08', 'PNQ', 'PNQ-L1', 'CNC Machine', 'HIGH' UNION ALL
  SELECT 'RYG-DC-01', 'RYG', 'RYG-L2', 'Die Casting Machine', 'CRITICAL' UNION ALL
  SELECT 'NGO-GR-01', 'NGO', 'NGO-L1', 'Gear Grinder', 'HIGH'
) S ON T.asset_id = S.asset_id
WHEN NOT MATCHED THEN INSERT (asset_id, plant_id, line_id, asset_type, criticality) VALUES (S.asset_id, S.plant_id, S.line_id, S.asset_type, S.criticality);

-- 3. Seed Suppliers
MERGE kg.n_supplier T USING (
  SELECT 'SUP-FORMOSA' AS supplier_id, 'Formosa Precision Electronics' AS name, 'Taiwan' AS country, 'Hsinchu' AS city, 24.8138 AS lat, 120.9675 AS lng, 1 AS tier, 0.75 AS risk_score, 0.94 AS otd_pct, 12.0 AS ppm, 85.0 AS esg_score, ['typhoon', 'port_delay', 'hsinchu'] AS watch_terms UNION ALL
  SELECT 'SUP-PENANG-ELEC', 'Penang Electronics', 'Malaysia', 'Penang', 5.4164, 100.3327, 2, 0.35, 0.97, 8.0, 78.0, ['flood', 'customs'] UNION ALL
  SELECT 'SUP-SKF-PUNE', 'SKF India Bearings', 'India', 'Pune', 18.5204, 73.8567, 1, 0.20, 0.98, 5.0, 90.0, ['monsoon'] UNION ALL
  SELECT 'SUP-NIPPON-STL', 'Nippon Steel Components', 'Japan', 'Nagoya', 35.1815, 136.9066, 1, 0.15, 0.99, 3.0, 92.0, ['earthquake']
) S ON T.supplier_id = S.supplier_id
WHEN NOT MATCHED THEN INSERT (supplier_id, name, country, city, lat, lng, tier, risk_score, otd_pct, ppm, esg_score, watch_terms)
VALUES (S.supplier_id, S.name, S.country, S.city, S.lat, S.lng, S.tier, S.risk_score, S.otd_pct, S.ppm, S.esg_score, S.watch_terms);

-- 4. Seed Parts
MERGE kg.n_part T USING (
  SELECT 'BRG-6205' AS part_id, 'Deep Groove Ball Bearing 6205-2RS' AS name, 'Bearings' AS category, TRUE AS critical, 24.50 AS unit_cost, 'Precision steel ball bearing for CNC spindle' AS spec_text, CAST([] AS ARRAY<FLOAT64>) AS spec_embedding UNION ALL
  SELECT 'STAT-01', 'Stator Assembly Core 300kW', 'Electrical', TRUE, 420.00, 'Laminated silicon steel stator core', CAST([] AS ARRAY<FLOAT64>) UNION ALL
  SELECT 'ROTR-01', 'Rotor Shaft Assembly TM-300', 'Mechanical', TRUE, 310.00, 'Balanced forged rotor shaft', CAST([] AS ARRAY<FLOAT64>) UNION ALL
  SELECT 'HSG-01', 'Aluminium Motor Housing TM-300', 'Structural', FALSE, 185.00, 'Die-cast high-pressure aluminium housing', CAST([] AS ARRAY<FLOAT64>)
) S ON T.part_id = S.part_id
WHEN NOT MATCHED THEN INSERT (part_id, name, category, critical, unit_cost, spec_text, spec_embedding)
VALUES (S.part_id, S.name, S.category, S.critical, S.unit_cost, S.spec_text, S.spec_embedding);

-- 5. Seed Supplier -> Part relationships
MERGE kg.e_supplies T USING (
  SELECT 'SUP-SKF-PUNE' AS supplier_id, 'BRG-6205' AS part_id, 3 AS lead_time_days, 0.70 AS share_pct, TRUE AS qualified, 24.50 AS unit_price UNION ALL
  SELECT 'SUP-PENANG-ELEC', 'BRG-6205', 6, 0.00, TRUE, 26.46 UNION ALL
  SELECT 'SUP-FORMOSA', 'STAT-01', 14, 0.85, TRUE, 420.00 UNION ALL
  SELECT 'SUP-NIPPON-STL', 'ROTR-01', 7, 0.90, TRUE, 310.00
) S ON T.supplier_id = S.supplier_id AND T.part_id = S.part_id
WHEN NOT MATCHED THEN INSERT (supplier_id, part_id, lead_time_days, share_pct, qualified, unit_price)
VALUES (S.supplier_id, S.part_id, S.lead_time_days, S.share_pct, S.qualified, S.unit_price);

-- 6. Seed Products
MERGE kg.n_product T USING (
  SELECT 'TM-300' AS sku_id, 'Traction Motor Assembly 300kW' AS name, 'e-Powertrain' AS family, 'PNQ' AS plant_id, 3450.00 AS unit_price_usd UNION ALL
  SELECT 'INV-200', 'Inverter Housing Sub-assembly' AS name, 'Power Electronics', 'RYG', 1250.00 AS unit_price_usd
) S ON T.sku_id = S.sku_id
WHEN NOT MATCHED THEN INSERT (sku_id, name, family, plant_id, unit_price_usd)
VALUES (S.sku_id, S.name, S.family, S.plant_id, S.unit_price_usd);

-- 7. Seed Part -> Product relationships
MERGE kg.e_component_of T USING (
  SELECT 'BRG-6205' AS part_id, 'TM-300' AS sku_id, 2.0 AS qty_per UNION ALL
  SELECT 'STAT-01', 'TM-300', 1.0 UNION ALL
  SELECT 'ROTR-01', 'TM-300', 1.0 UNION ALL
  SELECT 'HSG-01', 'TM-300', 1.0
) S ON T.part_id = S.part_id AND T.sku_id = S.sku_id
WHEN NOT MATCHED THEN INSERT (part_id, sku_id, qty_per)
VALUES (S.part_id, S.sku_id, S.qty_per);

-- 8. Seed Customers
MERGE kg.n_customer T USING (
  SELECT 'CUST-TATA' AS customer_id, 'Tata Motors EV Division' AS name, 'India' AS country, TRUE AS penalty_clause, ['ev_delivery', 'pune_line'] AS watch_terms UNION ALL
  SELECT 'CUST-TOYOTA', 'Toyota Tsusho Automotive' AS name, 'Japan' AS country, TRUE, ['jidoka', 'just_in_time']
) S ON T.customer_id = S.customer_id
WHEN NOT MATCHED THEN INSERT (customer_id, name, country, penalty_clause, watch_terms)
VALUES (S.customer_id, S.name, S.country, S.penalty_clause, S.watch_terms);

-- 9. Seed Sales Orders
MERGE kg.n_sales_order T USING (
  SELECT 'SO-1001' AS so_id, 'CUST-TATA' AS customer_id, 'TM-300' AS sku_id, 150 AS qty, DATE_ADD(CURRENT_DATE(), INTERVAL 10 DAY) AS due_date, 517500.00 AS value_usd, 'OPEN' AS status UNION ALL
  SELECT 'SO-1002', 'CUST-TOYOTA', 'TM-300', 80, DATE_ADD(CURRENT_DATE(), INTERVAL 20 DAY), 276000.00, 'CONFIRMED'
) S ON T.so_id = S.so_id
WHEN NOT MATCHED THEN INSERT (so_id, customer_id, sku_id, qty, due_date, value_usd, status)
VALUES (S.so_id, S.customer_id, S.sku_id, S.qty, S.due_date, S.value_usd, S.status);

-- 10. Seed Sales Order Edge Tables
MERGE kg.e_so_for T USING (
  SELECT 'SO-1001' AS so_id, 'TM-300' AS sku_id UNION ALL
  SELECT 'SO-1002', 'TM-300'
) S ON T.so_id = S.so_id AND T.sku_id = S.sku_id
WHEN NOT MATCHED THEN INSERT (so_id, sku_id) VALUES (S.so_id, S.sku_id);

MERGE kg.e_orders T USING (
  SELECT 'CUST-TATA' AS customer_id, 'SO-1001' AS so_id UNION ALL
  SELECT 'CUST-TOYOTA', 'SO-1002'
) S ON T.customer_id = S.customer_id AND T.so_id = S.so_id
WHEN NOT MATCHED THEN INSERT (customer_id, so_id) VALUES (S.customer_id, S.so_id);

-- 11. Seed Inventory
MERGE silver.inventory T USING (
  SELECT 'PNQ' AS plant_id, 'BRG-6205' AS part_id, 45 AS stock_qty, 12 AS reserved_qty, 'BIN-A12-04' AS location_bin, CURRENT_TIMESTAMP() AS last_updated UNION ALL
  SELECT 'RYG', 'BRG-6205', 8, 4, 'BIN-B03-01', CURRENT_TIMESTAMP() UNION ALL
  SELECT 'NGO', 'BRG-6205', 25, 0, 'BIN-C10-09', CURRENT_TIMESTAMP()
) S ON T.plant_id = S.plant_id AND T.part_id = S.part_id
WHEN NOT MATCHED THEN INSERT (plant_id, part_id, stock_qty, reserved_qty, location_bin, last_updated)
VALUES (S.plant_id, S.part_id, S.stock_qty, S.reserved_qty, S.location_bin, S.last_updated);

