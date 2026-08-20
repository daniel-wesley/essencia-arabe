'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandId: string | null;
  category: string;
  categorySlug: string | null;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  images: string[];
  viewCount: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#c8b898' }}>Carregando...</div>}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialCategorySlug = searchParams.get('category') ?? '';
  const initialBrand = searchParams.get('brand') ?? '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState(initialBrand);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then((cats: Category[]) => {
      setCategories(cats);
      if (initialCategorySlug) {
        const match = cats.find(c => c.slug === initialCategorySlug || c.id === initialCategorySlug);
        if (match) setFilterCategory(match.id);
      }
    }).catch(() => {});
    fetch('/api/brands').then(r => r.ok ? r.json() : []).then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterCategory) params.set('categoryId', filterCategory);
    if (filterBrand) params.set('brandId', filterBrand);
    params.set('limit', '100');

    fetch(`/api/products?${params.toString()}`)
      .then(r => r.ok ? r.json() : [])
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch, filterCategory, filterBrand]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#faf5eb', marginBottom: 8 }}>Catálogo de Perfumes</h1>
        <p style={{ color: '#a1a1aa' }}>Explore nossa coleção de perfumes árabes autênticos</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' as const }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou marca..."
          style={{
            flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10,
            border: '1px solid rgba(200,168,78,0.2)', background: 'rgba(10,10,15,0.6)',
            color: '#f5f0e6', fontSize: '0.9rem', outline: 'none',
          }}
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{
          padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(200,168,78,0.2)',
          background: 'rgba(10,10,15,0.6)', color: '#f5f0e6', fontSize: '0.9rem',
        }}>
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{
          padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(200,168,78,0.2)',
          background: 'rgba(10,10,15,0.6)', color: '#f5f0e6', fontSize: '0.9rem',
        }}>
          <option value="">Todas as marcas</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {(filterCategory || filterBrand || search) && (
          <button onClick={() => { setFilterCategory(''); setFilterBrand(''); setSearch(''); }} style={{
            padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
            background: 'transparent', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer',
          }}>
            Limpar
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#c8b898' }}>Carregando produtos...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#c8b898' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: '1.2rem', color: '#faf5eb', marginBottom: 8 }}>Nenhum produto encontrado</h2>
          <p>Tente ajustar os filtros.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
          {products.map(p => (
            <a key={p.id} href={`/products/${p.slug || p.id}`} style={{
              display: 'block', borderRadius: 16, overflow: 'hidden',
              background: 'rgba(24, 24, 27, 0.7)', border: '1px solid rgba(200, 168, 78, 0.08)',
              textDecoration: 'none', transition: 'border-color 0.3s',
            }}>
              <div style={{
                aspectRatio: '1', background: 'rgba(200, 168, 78, 0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <span style={{ fontSize: '4rem' }}>🧴</span>}
              </div>
              <div style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.7rem', color: '#d4b86a', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 }}>{p.brand}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#faf5eb', marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 12 }}>
                  {p.concentration} {p.family ? `· ${p.family}` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.promotionalPrice ? (
                    <>
                      <span style={{ fontSize: '0.85rem', color: '#c8b898', textDecoration: 'line-through' }}>R$ {p.price.toFixed(2)}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>R$ {p.promotionalPrice.toFixed(2)}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>R$ {p.price.toFixed(2)}</span>
                  )}
                </div>
                {p.stock <= 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4, fontWeight: 600 }}>Esgotado</div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
