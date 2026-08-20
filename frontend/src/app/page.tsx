'use client';

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  images: string[];
  description: string | null;
  featured: number;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  logo_url: string | null;
}

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    fetch('/api/products?featured=1')
      .then(r => r.ok ? r.json() : [])
      .then((data: Product[]) => setFeaturedProducts(data.slice(0, 6)))
      .catch(() => {});
    fetch('/api/brands')
      .then(r => r.ok ? r.json() : [])
      .then(setBrands)
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* HERO */}
      <section style={{
        minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(24, 24, 27, 0.9))',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 50%, rgba(200, 168, 78, 0.08), transparent 60%)',
        }} />
        <div style={{ position: 'relative', textAlign: 'center', padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem)', maxWidth: 800 }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 20,
            border: '1px solid rgba(200, 168, 78, 0.25)', fontSize: '0.75rem',
            color: '#d4b86a', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 24,
          }}>
            Essência Árabe
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, color: '#faf5eb',
            lineHeight: 1.1, marginBottom: 16,
          }}>
            Descubra Fragrâncias
            <br />
            <span style={{ background: 'linear-gradient(135deg, #d4b86a, #c8a84e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Únicas do Oriente
            </span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#a1a1aa', marginBottom: 32, lineHeight: 1.6, maxWidth: 550, margin: '0 auto 32px' }}>
            Perfumes árabes autênticos selecionados com excelência. Cada fragrância carrega a tradição milenar do Oriente.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const }}>
            <a href="/products" style={{
              padding: '14px 32px', borderRadius: 12, background: 'linear-gradient(135deg, #059669, #10b981)',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
            }}>
              Ver Catálogo
            </a>
            <a href="https://wa.me/556198038416?text=Olá! Gostaria de saber mais sobre os perfumes árabes." target="_blank" rel="noopener noreferrer" style={{
              padding: '14px 32px', borderRadius: 12, border: '1px solid rgba(37, 211, 102, 0.4)',
              background: 'rgba(37, 211, 102, 0.08)', color: '#25d366', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              <img src="/images/icons/whatsapp.gif" alt="" style={{ width: 22, height: 22 }} />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* CATEGORIAS POR GÊNERO */}
      <section style={{ padding: 'clamp(3rem, 5vw, 5rem) clamp(1rem, 3vw, 2rem)', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '0.7rem', color: '#d4b86a', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 8 }}>Coleções</div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#faf5eb' }}>Explore por Estilo</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 24 }}>
          {[
            { name: 'Masculinos', slug: 'masculino', desc: 'Fragrâncias intensas e marcantes', icon: '🕌' },
            { name: 'Femininos', slug: 'feminino', desc: 'Elegância e sofisticação', icon: '🌙' },
            { name: 'Unissex', slug: 'unissex', desc: 'Para todos os estilos', icon: '✨' },
          ].map(cat => (
            <a key={cat.slug} href={`/products?category=${cat.slug}`} style={{
              display: 'block', padding: '2.5rem 2rem', borderRadius: 16,
              background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.1)',
              textDecoration: 'none', textAlign: 'center', transition: 'border-color 0.3s',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{cat.icon}</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#faf5eb', marginBottom: 8 }}>{cat.name}</h3>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>{cat.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      {featuredProducts.length > 0 && (
        <section style={{ padding: 'clamp(3rem, 5vw, 5rem) clamp(1rem, 3vw, 2rem)', background: 'rgba(24, 24, 27, 0.3)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: '0.7rem', color: '#d4b86a', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 8 }}>Selecionados</div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#faf5eb' }}>Produtos em Destaque</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
              {featuredProducts.map(p => (
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
                    <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: 12 }}>{p.concentration} {p.family ? `· ${p.family}` : ''}</div>
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
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MARCAS */}
      {brands.length > 0 && (
        <section style={{ padding: 'clamp(3rem, 5vw, 5rem) clamp(1rem, 3vw, 2rem)', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: '0.7rem', color: '#d4b86a', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 8 }}>Parceiros</div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#faf5eb' }}>Nossas Marcas</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 24, justifyContent: 'center' }}>
            {brands.map(b => (
              <a key={b.id} href={`/products?brand=${b.id}`} style={{
                padding: '1.5rem 2rem', borderRadius: 12, border: '1px solid rgba(200, 168, 78, 0.1)',
                background: 'rgba(24, 24, 27, 0.4)', textDecoration: 'none', textAlign: 'center', minWidth: 140,
              }}>
                <div style={{ fontWeight: 700, color: '#faf5eb', fontSize: '0.95rem' }}>{b.name}</div>
                {b.country && <div style={{ fontSize: '0.75rem', color: '#c8b898', marginTop: 4 }}>{b.country}</div>}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* SOBRE */}
      <section style={{ padding: 'clamp(3rem, 5vw, 5rem) clamp(1rem, 3vw, 2rem)', background: 'rgba(24, 24, 27, 0.3)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#d4b86a', letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 16 }}>Sobre Nós</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#faf5eb', marginBottom: 16 }}>Essência Árabe</h2>
          <p style={{ fontSize: '1rem', color: '#a1a1aa', lineHeight: 1.7, marginBottom: 32 }}>
            Somos especialistas em perfumes árabes autênticos. Cada fragrância é cuidadosamente selecionada das melhores marcas do Oriente Médio,
            trazendo para o Brasil a tradição milenar da perfumaria árabe. Qualidade, originalidade e atendimento personalizado.
          </p>
          <a href="https://wa.me/556198038416?text=Olá! Quero conhecer os perfumes da Essência Árabe." target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12,
            background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.3)',
            color: '#25d366', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none',
          }}>
            <img src="/images/icons/whatsapp.gif" alt="" style={{ width: 22, height: 22 }} />
            Fale Conosco no WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}
