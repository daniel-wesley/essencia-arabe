-- ============================================================
-- SISTEMA ESSENCIA ARABE - PERFUMARIA DIGITAL
-- Script SQL (DDL) - PostgreSQL
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para busca textual com similaridade

-- ============================================================
-- TABELA: users
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(20) CHECK (gender IN ('M', 'F', 'O')),
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'manager')),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    loyalty_points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: addresses (endereços do usuário)
-- ============================================================
CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) DEFAULT 'Casa',
    street VARCHAR(255) NOT NULL,
    number VARCHAR(20) NOT NULL,
    complement VARCHAR(100),
    neighborhood VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state CHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: brands (marcas)
-- ============================================================
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    country VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: categories (categorias)
-- ============================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- TABELA: products (perfumes - modelo base)
-- ============================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    concentration VARCHAR(30) CHECK (concentration IN ('EdC', 'EdT', 'EdP', 'Parfum', 'Cologne')),
    gender VARCHAR(20) CHECK (gender IN ('M', 'F', 'Unissex')),
    olfactory_family VARCHAR(50) CHECK (olfactory_family IN (
        'Amadeirado', 'Floral', 'Oriental', 'Cítrico', 'Fougère',
        'Aromático', 'Aquático', 'Almíscar', 'Verde', 'Especiário'
    )),
    intensity VARCHAR(20) CHECK (intensity IN ('Suave', 'Moderada', 'Intensa')),
    occasions JSONB DEFAULT '[]'::jsonb,
    seasons JSONB DEFAULT '[]'::jsonb,
    main_image_url TEXT,
    video_360_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: product_images (imagens adicionais)
-- ============================================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text VARCHAR(255),
    sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- TABELA: olfactory_notes (notas olfativas)
-- ============================================================
CREATE TABLE olfactory_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) CHECK (type IN ('topo', 'coracao', 'fundo')),
    family VARCHAR(50),
    description TEXT,
    synonyms JSONB DEFAULT '[]'::jsonb
);

-- ============================================================
-- TABELA: product_olfactory_notes (relação perfume-notas)
-- ============================================================
CREATE TABLE product_olfactory_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES olfactory_notes(id),
    note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('topo', 'coracao', 'fundo')),
    UNIQUE(product_id, note_id)
);

-- ============================================================
-- TABELA: variants (variações de tamanho)
-- ============================================================
CREATE TABLE variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    size_ml INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    promotional_price DECIMAL(10,2),
    barcode VARCHAR(50),
    weight_grams INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: inventory (estoque)
-- ============================================================
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID UNIQUE NOT NULL REFERENCES variants(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    batch_number VARCHAR(50),
    fabrication_date DATE,
    expiration_date DATE,
    last_restock_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    CHECK (reserved <= quantity),
    CHECK (quantity >= 0)
);

-- ============================================================
-- TABELA: cart_items (carrinho -DB backup, Redis é fonte primária)
-- ============================================================
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    reserved_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, variant_id)
);

-- ============================================================
-- TABELA: coupons (cupons de desconto)
-- ============================================================
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_value DECIMAL(10,2) DEFAULT 0,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- TABELA: orders (pedidos)
-- ============================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'processing', 'separating',
        'shipped', 'delivered', 'cancelled', 'refunded'
    )),
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    coupon_id UUID REFERENCES coupons(id),
    shipping_address_id UUID REFERENCES addresses(id),
    payment_method VARCHAR(30) CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
    payment_id VARCHAR(255),
    payment_status VARCHAR(30) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'approved', 'rejected', 'refunded'
    )),
    tracking_code VARCHAR(50),
    shipping_provider VARCHAR(50),
    notes TEXT,
    loyalty_points_used INTEGER DEFAULT 0,
    loyalty_points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);

-- ============================================================
-- TABELA: order_items (itens do pedido)
-- ============================================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id),
    product_name VARCHAR(255) NOT NULL,
    variant_sku VARCHAR(50) NOT NULL,
    size_ml INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10,2) NOT NULL
);

-- ============================================================
-- TABELA: reviews (avaliações)
-- ============================================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    comment TEXT,
    longevity_rating INTEGER CHECK (longevity_rating BETWEEN 1 AND 5),
    sillage_rating INTEGER CHECK (sillage_rating BETWEEN 1 AND 5),
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

-- ============================================================
-- TABELA: recommendations_log (log de recomendações)
-- ============================================================
CREATE TABLE recommendations_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    recommendation_type VARCHAR(30) CHECK (recommendation_type IN (
        'profile', 'collaborative', 'complementary', 'trending', 'search'
    )),
    source_product_id UUID REFERENCES products(id),
    recommended_product_id UUID NOT NULL REFERENCES products(id),
    score DECIMAL(5,4),
    was_clicked BOOLEAN DEFAULT FALSE,
    was_purchased BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: user_preferences (preferências do usuário para recomendação)
-- ============================================================
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preferred_families JSONB DEFAULT '[]'::jsonb,
    preferred_occasions JSONB DEFAULT '[]'::jsonb,
    preferred_seasons JSONB DEFAULT '[]'::jsonb,
    preferred_concentrations JSONB DEFAULT '[]'::jsonb,
    disliked_ingredients JSONB DEFAULT '[]'::jsonb,
    preferred_brands JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABELA: favorites (favoritos)
-- ============================================================
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- ============================================================
-- TABELA: search_synonyms (sinônimos de busca)
-- ============================================================
CREATE TABLE search_synonyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term VARCHAR(100) NOT NULL,
    synonyms JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_olfactory_family ON products(olfactory_family);
CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_variants_product ON variants(product_id);
CREATE INDEX idx_variants_sku ON variants(sku);
CREATE INDEX idx_inventory_variant ON inventory(variant_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_recommendations_user ON recommendations_log(user_id);
CREATE INDEX idx_product_notes_product ON product_olfactory_notes(product_id);
CREATE INDEX idx_product_notes_note ON product_olfactory_notes(note_id);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_olfactory_notes_name ON olfactory_notes(name);
