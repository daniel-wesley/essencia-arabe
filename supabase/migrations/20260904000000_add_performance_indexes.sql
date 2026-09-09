-- Migration: Adicionar índices para performance
-- Data: 2026-09-04

-- Índice para ordenação de pedidos (dashboard/relatórios)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Índice composto para consultas de pedidos por usuário + status (muito comum)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- Índice para joins com inventory (via variant_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);

-- Índice para listagem de reviews (produto + data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC);

-- Índice para filtrar variantes ativas de um produto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variants_product_active ON variants(product_id, is_active);

-- Índice para busca de cupons por código
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupons_code_active ON coupons(code, is_active);

-- Índice para inventory por variant_id (já existe mas garantindo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_variant_id ON inventory(variant_id);

-- Índice para product_images por product_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- Índice para favorites por user_id e product_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_favorites_user_product ON favorites(user_id, product_id);

-- Índice para recommendations_log por user_id e created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_user_created ON recommendations_log(user_id, created_at DESC);
