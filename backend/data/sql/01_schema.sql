-- silver.telemetry : 1 row per sensor reading
CREATE TABLE silver.telemetry (
  ts TIMESTAMP NOT NULL,                      -- real (wall-clock) time
  sim_ts TIMESTAMP,                           -- simulated plant time 
  plant_id STRING, line_id STRING, asset_id STRING,
  sensor_id STRING, metric STRING,            
  value FLOAT64, unit STRING, quality STRING, 
  ingest_ts TIMESTAMP
) PARTITION BY DATE(ts) CLUSTER BY plant_id, asset_id, metric
  OPTIONS (partition_expiration_days = 7);   

-- bronze.telemetry_raw : written directly by the Pub/Sub BigQuery subscription 
CREATE TABLE bronze.telemetry_raw (
  event_id STRING, ts TIMESTAMP, sim_ts TIMESTAMP, plant_id STRING, line_id STRING, asset_id STRING,
  sensor_id STRING, metric STRING, value FLOAT64, unit STRING, quality STRING
) PARTITION BY DATE(ts) CLUSTER BY plant_id, asset_id
  OPTIONS (partition_expiration_days = 7);

-- silver.machine_states : state changes (running/idle/down/setup) with reason codes
CREATE TABLE silver.machine_states (
  ts_start TIMESTAMP, ts_end TIMESTAMP, plant_id STRING, asset_id STRING,
  state STRING, reason_code STRING, production_order_id STRING, sku_id STRING,
  good_count INT64, reject_count INT64, ideal_cycle_s FLOAT64
) PARTITION BY DATE(ts_start) CLUSTER BY plant_id, asset_id;

-- silver.inspections : vision results (ObjectRef for multimodal SQL)
CREATE TABLE silver.inspections (
  inspection_id STRING, ts TIMESTAMP, plant_id STRING, asset_id STRING, lot_id STRING, sku_id STRING,
  image_ref STRUCT<uri STRING, version STRING, authorizer STRING, details JSON>,  
  stage STRING, model_id STRING, is_defect BOOL, defect_type STRING, severity STRING,
  confidence FLOAT64, bboxes JSON, rationale STRING, human_label STRING, labeled_by STRING
) PARTITION BY DATE(ts);

-- ref.suppliers / kg node tables 
CREATE TABLE kg.n_supplier (supplier_id STRING NOT NULL, name STRING, country STRING, city STRING,
  lat FLOAT64, lng FLOAT64, tier INT64, risk_score FLOAT64, otd_pct FLOAT64, ppm FLOAT64, esg_score FLOAT64,
  watch_terms ARRAY<STRING>,   
  PRIMARY KEY (supplier_id) NOT ENFORCED);

CREATE TABLE kg.n_part (part_id STRING NOT NULL, name STRING, category STRING, critical BOOL,
  unit_cost FLOAT64, spec_text STRING, spec_embedding ARRAY<FLOAT64>, PRIMARY KEY (part_id) NOT ENFORCED);

CREATE TABLE kg.e_supplies (supplier_id STRING, part_id STRING, lead_time_days INT64, share_pct FLOAT64,
  qualified BOOL, unit_price FLOAT64,
  FOREIGN KEY (supplier_id) REFERENCES kg.n_supplier(supplier_id) NOT ENFORCED,
  FOREIGN KEY (part_id) REFERENCES kg.n_part(part_id) NOT ENFORCED);

-- Remaining node/edge tables referenced by the property graph
CREATE TABLE kg.n_product (sku_id STRING NOT NULL, name STRING, family STRING, plant_id STRING,
  unit_price_usd FLOAT64, PRIMARY KEY (sku_id) NOT ENFORCED);

CREATE TABLE kg.n_customer (customer_id STRING NOT NULL, name STRING, country STRING,
  penalty_clause BOOL, watch_terms ARRAY<STRING>, PRIMARY KEY (customer_id) NOT ENFORCED);

CREATE TABLE kg.n_sales_order (so_id STRING NOT NULL, customer_id STRING, sku_id STRING, qty INT64,
  due_date DATE, value_usd FLOAT64, status STRING,   
  PRIMARY KEY (so_id) NOT ENFORCED);

CREATE TABLE kg.n_asset (asset_id STRING NOT NULL, plant_id STRING, line_id STRING, asset_type STRING,
  criticality STRING, PRIMARY KEY (asset_id) NOT ENFORCED);

CREATE TABLE kg.e_component_of (part_id STRING, sku_id STRING, qty_per FLOAT64);
CREATE TABLE kg.e_so_for (so_id STRING, sku_id STRING);
CREATE TABLE kg.e_orders (customer_id STRING, so_id STRING);

-- ai.decisions 
CREATE TABLE ai.decisions (
  decision_id STRING, recommendation_id STRING, option_id STRING,
  status STRING,                
  decided_by STRING, decided_at TIMESTAMP, comment STRING, modifications JSON, autonomy_level STRING,
  est_value_usd FLOAT64, realized_value_usd FLOAT64, plant_ids ARRAY<STRING>
);

-- ai.signals : external signals from Scout
CREATE TABLE ai.signals (
  signal_id STRING, ts TIMESTAMP, type STRING, geo GEOGRAPHY, entities JSON, severity INT64,
  probability FLOAT64, time_horizon_h INT64, sources ARRAY<STRING>, summary STRING,
  source_feed STRING,          
  plant_ids ARRAY<STRING>,
  retrieved_at TIMESTAMP, as_of TIMESTAMP, expires_at TIMESTAMP,
  is_scenario BOOL             
) PARTITION BY DATE(ts);

-- silver.telemetry_1m 
CREATE TABLE silver.telemetry_1m (
  ts_min TIMESTAMP,             
  sim_ts_min TIMESTAMP,         
  plant_id STRING, line_id STRING, asset_id STRING, metric STRING,
  avg_value FLOAT64, min_value FLOAT64, max_value FLOAT64, std_value FLOAT64, n INT64
) PARTITION BY DATE(ts_min) CLUSTER BY plant_id, asset_id, metric
  OPTIONS (partition_expiration_days = 90);

-- kg.n_port 
CREATE TABLE kg.n_port (port_id STRING NOT NULL, name STRING, country STRING, lat FLOAT64, lng FLOAT64,
  watch_terms ARRAY<STRING>, PRIMARY KEY (port_id) NOT ENFORCED);