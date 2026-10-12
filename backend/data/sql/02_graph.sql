CREATE OR REPLACE PROPERTY GRAPH kg.mfg_graph
  NODE TABLES (
    kg.n_supplier KEY (supplier_id) LABEL Supplier PROPERTIES ALL COLUMNS,
    kg.n_part     KEY (part_id)     LABEL Part     PROPERTIES ALL COLUMNS,
    kg.n_product  KEY (sku_id)      LABEL Product  PROPERTIES ALL COLUMNS,
    kg.n_customer KEY (customer_id) LABEL Customer PROPERTIES ALL COLUMNS,
    kg.n_sales_order KEY (so_id)    LABEL SalesOrder PROPERTIES ALL COLUMNS,
    kg.n_asset    KEY (asset_id)    LABEL Asset    PROPERTIES ALL COLUMNS
  )
  EDGE TABLES (
    kg.e_supplies KEY (supplier_id, part_id)
      SOURCE KEY (supplier_id) REFERENCES n_supplier (supplier_id)
      DESTINATION KEY (part_id) REFERENCES n_part (part_id) LABEL SUPPLIES PROPERTIES ALL COLUMNS,
    kg.e_component_of KEY (part_id, sku_id)
      SOURCE KEY (part_id) REFERENCES n_part (part_id)
      DESTINATION KEY (sku_id) REFERENCES n_product (sku_id) LABEL COMPONENT_OF PROPERTIES ALL COLUMNS,
    kg.e_so_for KEY (so_id, sku_id)
      SOURCE KEY (so_id) REFERENCES n_sales_order (so_id)
      DESTINATION KEY (sku_id) REFERENCES n_product (sku_id) LABEL FOR_PRODUCT PROPERTIES ALL COLUMNS,
    kg.e_orders KEY (customer_id, so_id)
      SOURCE KEY (customer_id) REFERENCES n_customer (customer_id)
      DESTINATION KEY (so_id) REFERENCES n_sales_order (so_id) LABEL ORDERS PROPERTIES ALL COLUMNS
  );