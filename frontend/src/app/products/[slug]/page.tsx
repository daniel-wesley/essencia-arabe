'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandSlug: string;
  category: string;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  images: string[];
  variants: Variant[];
  description: string | null;
  shortDescription: string | null;
  occasion: string | null;
  longevity: string | null;
  projection: string | null;
  notes: { top: string[]; heart: string[]; base: string[] };
  viewCount: number;
}

interface Variant {
  id?: string;
  sizeMl: number;
  price: number;
  promotionalPrice: number | null;
  stock: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const slugOrId = params.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slugOrId) return;
    setLoading(true);
    fetch(`/api/products/${slugOrId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setProduct)
      .finally(() => setLoading(false));
  }, [slugOrId]);

  useEffect(() => {
    setCurrentImage(0);
    const idx = product?.variants?.findIndex(v => v.stock > 0) ?? -1;
    setSelectedIdx(idx >= 0 ? idx : 0);
  }, [product?.id]);

  useEffect(() => {
    const images = product?.images ?? [];
    if (images.length < 2) return;
    const timer = setInterval(() => setCurrentImage(prev => (prev + 1) % images.length), 4000);
    return () => clearInterval(timer);
  }, [product?.id, product?.images?.length]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#c8b898' }}>Carregando...</div>;
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#c8b898' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#faf5eb', marginBottom: '0.5rem' }}>Produto não encontrado</h1>
        <a href="/products" style={{ color: '#d4b86a' }}>Voltar ao catálogo</a>
      </div>
    );
  }

  const selected = product.variants[selectedIdx] ?? { sizeMl: 50, price: product.price, promotionalPrice: product.promotionalPrice, stock: product.stock };
  const hasDiscount = selected.promotionalPrice != null && selected.promotionalPrice < selected.price;
  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no perfume ${product.name}, na versão de ${selected.sizeMl}ml. Poderia informar a disponibilidade?`
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, fontSize: '0.8rem', color: '#a1a1aa' }}>
        <a href="/" style={{ color: '#d4b86a', textDecoration: 'none' }}>Início</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <a href="/products" style={{ color: '#d4b86a', textDecoration: 'none' }}>Catálogo</a>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: '#c8b898' }}>{product.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: 'clamp(1.5rem, 4vw, 3rem)' }}>
        {/* Imagem */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(200, 168, 78, 0.08), rgba(5, 150, 105, 0.05))',
          borderRadius: 20, aspectRatio: '1', overflow: 'hidden',
          border: '1px solid rgba(200, 168, 78, 0.15)', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {product.images?.length ? (
            <img
              key={currentImage}
              src={product.images[currentImage]}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.5s ease' }}
            />
          ) : <span style={{ fontSize: '8rem' }}>🧴</span>}

          {product.images?.length > 1 && (
            <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8 }}>
              {product.images.map((_, i) => (
                <button key={i} onClick={() => setCurrentImage(i)} style={{
                  width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: i === currentImage ? '#d4b86a' : 'rgba(255,255,255,0.4)',
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#d4b86a', marginBottom: 8 }}>
            {product.brand}
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.2rem)', fontWeight: 800, color: '#faf5eb', marginBottom: 8 }}>{product.name}</h1>
          <p style={{ color: '#a1a1aa', marginBottom: 20, fontSize: '0.9rem' }}>
            {product.concentration ?? ''} {product.family ? `· ${product.family}` : ''} {product.gender ? `· ${product.gender === 'M' ? 'Masculino' : product.gender === 'F' ? 'Feminino' : 'Unissex'}` : ''}
          </p>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
            {product.occasion && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', background: 'rgba(200,168,78,0.1)', color: '#d4b86a' }}>{product.occasion}</span>}
            {product.longevity && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', background: 'rgba(200,168,78,0.1)', color: '#d4b86a' }}>{product.longevity}</span>}
            {product.projection && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', background: 'rgba(200,168,78,0.1)', color: '#d4b86a' }}>{product.projection}</span>}
          </div>

          {/* Notas Olfativas */}
          {product.notes && (product.notes.top.length > 0 || product.notes.heart.length > 0 || product.notes.base.length > 0) && (
            <div style={{
              background: 'rgba(200, 168, 78, 0.08)', border: '1px solid rgba(200, 168, 78, 0.15)',
              borderRadius: 12, padding: '16px 20px', marginBottom: 24,
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#d4b86a', marginBottom: 12 }}>
                Notas Olfativas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 16 }}>
                {[
                  { label: 'Topo', notes: product.notes.top, icon: '🌿' },
                  { label: 'Coração', notes: product.notes.heart, icon: '💛' },
                  { label: 'Fundo', notes: product.notes.base, icon: '🪵' },
                ].map(section => section.notes.length > 0 && (
                  <div key={section.label}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#c8b898', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                      {section.icon} {section.label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#f5f0e6', lineHeight: 1.6 }}>
                      {section.notes.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Descrição */}
          {product.description && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#d4b86a', marginBottom: 8 }}>Descrição</div>
              <p style={{ color: '#a1a1aa', fontSize: '0.9rem', lineHeight: 1.7 }}>{product.description}</p>
            </div>
          )}

          {/* Variantes */}
          {product.variants?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#d4b86a', marginBottom: 10 }}>
                Escolha o Tamanho
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                {product.variants.map((v, i) => {
                  const selected = i === selectedIdx;
                  const out = v.stock <= 0;
                  const hasPromo = v.promotionalPrice != null && v.promotionalPrice < v.price;
                  return (
                    <button key={i} disabled={out} onClick={() => setSelectedIdx(i)} style={{
                      minWidth: 100, padding: '12px 16px', borderRadius: 10, cursor: out ? 'not-allowed' : 'pointer',
                      border: selected ? '2px solid #d4b86a' : '1px solid rgba(200,168,78,0.25)',
                      background: selected ? 'rgba(200,168,78,0.15)' : 'rgba(24,24,27,0.5)',
                      opacity: out ? 0.5 : 1,
                    }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: selected ? '#faf5eb' : '#c8b898' }}>{v.sizeMl} ml</div>
                      {hasPromo ? (
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#c8b898', textDecoration: 'line-through' }}>R$ {v.price.toFixed(2)}</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>R$ {v.promotionalPrice!.toFixed(2)}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: selected ? '#faf5eb' : '#c8b898' }}>R$ {v.price.toFixed(2)}</div>
                      )}
                      {out && <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#ef4444', marginTop: 2 }}>Esgotado</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preço */}
          <div style={{ marginBottom: 16 }}>
            {hasDiscount ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: '1rem', color: '#c8b898', textDecoration: 'line-through' }}>R$ {selected.price.toFixed(2)}</span>
                <span style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', fontWeight: 800, color: '#ef4444' }}>R$ {selected.promotionalPrice!.toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', fontWeight: 800, color: '#059669' }}>R$ {selected.price.toFixed(2)}</div>
            )}
          </div>

          {/* Estoque */}
          <div style={{ marginBottom: 24 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
              background: selected.stock > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: selected.stock > 0 ? '#22c55e' : '#ef4444',
            }}>
              {selected.stock > 0 ? `Estoque: ${selected.stock} unidades` : 'Fora de Estoque'}
            </span>
          </div>

          {/* Botão WhatsApp */}
          <a
            href={`https://wa.me/556198038416?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #25d366, #128c7e)',
              color: '#fff', fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
              opacity: selected.stock > 0 ? 1 : 0.7,
            }}
          >
            <img src="/images/icons/whatsapp.gif" alt="" style={{ width: 24, height: 24 }} />
            Tenho Interesse
          </a>

          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: 12, textAlign: 'center' }}>
            Resposta rápida via WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}
