'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';

interface User {
  id: string;
  username: string;
  role: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandId: string | null;
  category: string;
  categoryId: string | null;
  family: string | null;
  concentration: string | null;
  gender: string | null;
  description: string | null;
  shortDescription: string | null;
  occasion: string | null;
  longevity: string | null;
  projection: string | null;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  images: string[];
  variants: Variant[];
  featured: number;
  active: number;
  viewCount: number;
  notes: { top: string[]; heart: string[]; base: string[] };
  created_at: string;
}

interface Variant {
  id?: string;
  sizeMl: number;
  price: number;
  promotionalPrice: number | null;
  stock: number;
  sku: string | null;
}

interface VariantRow {
  sizeMl: string;
  price: string;
  promotionalPrice: string;
  stock: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  description: string | null;
  logo_url: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  totalStock: number;
  productsOnPromotion: number;
  mostViewed: { id: string; name: string; brand: string; view_count: number; images: string[] }[];
}

interface NoteRow {
  type: 'top' | 'heart' | 'base';
  name: string;
}

const SIZE_OPTIONS = [30, 50, 100, 200];

const emptyForm = {
  name: '',
  brandId: '',
  categoryId: '',
  family: 'Oriental',
  concentration: 'EdP',
  gender: 'M',
  description: '',
  shortDescription: '',
  occasion: '',
  longevity: '',
  projection: '',
  featured: false,
  promotionalPrice: '',
  promotionStart: '',
  promotionEnd: '',
  variants: SIZE_OPTIONS.map((sizeMl) => ({ sizeMl: String(sizeMl), price: '', promotionalPrice: '', stock: '' })) as VariantRow[],
  images: [] as string[],
  notes: { top: [''], heart: [''], base: [''] } as Record<string, string[]>,
};

type Tab = 'dashboard' | 'products' | 'brands' | 'categories' | 'users' | 'audit' | 'backup';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    fetch('/api/auth').then((res) => {
      if (res.ok) return res.json().then(d => setUser(d.user));
      setUser(null);
    }).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.error || 'Credenciais inválidas.');
      }
    } catch {
      setLoginError('Erro ao conectar ao servidor.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setUser(null);
    setLoginUser('');
    setLoginPass('');
  };

  if (checking) {
    return <div style={{ textAlign: 'center', padding: '6rem 2rem', color: '#c8b898' }}>Carregando...</div>;
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: '6rem auto', padding: '0 2rem' }}>
        <div style={{ background: 'rgba(24, 24, 27, 0.7)', border: '1px solid rgba(200, 168, 78, 0.15)', borderRadius: 16, padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#faf5eb', marginBottom: 4 }}>Acesso Restrito</h1>
            <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Entre com suas credenciais.</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Usuário</label>
              <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="admin" required autoFocus style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Senha</label>
              <input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••" required style={inputStyle} />
            </div>
            {loginError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: '0.85rem' }}>
                {loginError}
              </div>
            )}
            <button type="submit" disabled={loggingIn} style={{ ...btnPrimary, width: '100%', padding: '12px', opacity: loggingIn ? 0.6 : 1 }}>
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#faf5eb' }}>Painel Administrativo</h1>
          <p style={{ color: '#c8b898', fontSize: '0.85rem' }}>Logado como <strong style={{ color: '#d4b86a' }}>{user.username}</strong> ({user.role})</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/" style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-block' }}>Ver Loja</a>
          <button onClick={handleLogout} style={{ ...btnDanger, padding: '8px 16px', fontWeight: 600, fontSize: '0.8rem' }}>Sair</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '2rem', borderBottom: '1px solid rgba(200, 168, 78, 0.15)', paddingBottom: 8, flexWrap: 'wrap' as const }}>
        {(['dashboard', 'products', 'brands', 'categories', 'users', 'audit', 'backup'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            background: activeTab === tab ? 'rgba(200, 168, 78, 0.2)' : 'transparent',
            color: activeTab === tab ? '#d4b86a' : '#c8b898',
          }}>
            {tab === 'dashboard' ? 'Dashboard' : tab === 'products' ? 'Produtos' : tab === 'brands' ? 'Marcas' : tab === 'categories' ? 'Categorias' : tab === 'users' ? 'Usuários' : tab === 'audit' ? 'Auditoria' : 'Backup'}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'products' && <ProductsTab userRole={user.role} />}
      {activeTab === 'brands' && <BrandsTab userRole={user.role} />}
      {activeTab === 'categories' && <CategoriesTab userRole={user.role} />}
      {activeTab === 'users' && user.role === 'admin' && <UsersTab />}
      {activeTab === 'audit' && user.role === 'admin' && <AuditTab />}
      {activeTab === 'backup' && user.role === 'admin' && <BackupTab />}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(d => setStats(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  if (!stats) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Erro ao carregar.</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Produtos Ativos', value: stats.activeProducts, color: '#d4b86a' },
          { label: 'Estoque Total', value: stats.totalStock, color: '#22c55e' },
          { label: 'Estoque Baixo', value: stats.lowStock, color: '#fbbf24' },
          { label: 'Sem Estoque', value: stats.outOfStock, color: '#ef4444' },
          { label: 'Em Promoção', value: stats.productsOnPromotion, color: '#8b5cf6' },
          { label: 'Total de Produtos', value: stats.totalProducts, color: '#06b6d4' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#c8b898', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{stat.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {stats.mostViewed.length > 0 && (
        <div style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 12, padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#faf5eb', marginBottom: 16 }}>Mais Visualizados</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {stats.mostViewed.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(200, 168, 78, 0.05)' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#d4b86a', width: 24 }}>{i + 1}º</span>
                {p.images?.[0] ? <img src={p.images[0]} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' as const }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(200,168,78,0.15)' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#faf5eb', fontSize: '0.85rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#c8b898' }}>{p.brand}</div>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#c8b898' }}>{p.view_count} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────
function ProductsTab({ userRole }: { userRole: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const canEdit = ['admin', 'editor'].includes(userRole);

  const loadData = useCallback(async () => {
    const [pRes, bRes, cRes] = await Promise.all([
      fetch('/api/products'), fetch('/api/brands'), fetch('/api/categories'),
    ]);
    if (pRes.ok) setProducts(await pRes.json());
    if (bRes.ok) setBrands(await bRes.json());
    if (cRes.ok) setCategories(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [showForm]);

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false); };

  const handleEdit = (p: Product) => {
    setForm({
      name: p.name,
      brandId: p.brandId ?? '',
      categoryId: p.categoryId ?? '',
      family: p.family ?? 'Oriental',
      concentration: p.concentration ?? 'EdP',
      gender: p.gender ?? 'M',
      description: p.description ?? '',
      shortDescription: p.shortDescription ?? '',
      occasion: p.occasion ?? '',
      longevity: p.longevity ?? '',
      projection: p.projection ?? '',
      featured: !!p.featured,
      promotionalPrice: p.promotionalPrice?.toString() ?? '',
      promotionStart: '',
      promotionEnd: '',
      variants: (p.variants ?? []).map(v => ({
        sizeMl: String(v.sizeMl), price: String(v.price),
        promotionalPrice: v.promotionalPrice?.toString() ?? '', stock: String(v.stock),
      })),
      images: p.images ?? [],
      notes: {
        top: p.notes?.top?.length ? p.notes.top : [''],
        heart: p.notes?.heart?.length ? p.notes.heart : [''],
        base: p.notes?.base?.length ? p.notes.base : [''],
      },
    });
    setEditing(p);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const variants = form.variants
        .filter(v => v.sizeMl.trim() !== '' && v.price.trim() !== '')
        .map(v => ({
          sizeMl: parseInt(v.sizeMl, 10), price: parseFloat(v.price.replace(',', '.')),
          promotionalPrice: v.promotionalPrice ? parseFloat(v.promotionalPrice.replace(',', '.')) : undefined,
          stock: parseInt(v.stock, 10) || 0,
        }));

      const notes: NoteRow[] = [];
      for (const [type, arr] of Object.entries(form.notes)) {
        for (const name of arr) {
          if (name.trim()) notes.push({ type: type as 'top' | 'heart' | 'base', name: name.trim() });
        }
      }

      const payload = {
        name: form.name, brandId: form.brandId || undefined, categoryId: form.categoryId || undefined,
        family: form.family, concentration: form.concentration, gender: form.gender,
        description: form.description, shortDescription: form.shortDescription,
        occasion: form.occasion, longevity: form.longevity, projection: form.projection,
        featured: form.featured,
        promotionalPrice: form.promotionalPrice ? parseFloat(form.promotionalPrice) : undefined,
        promotionStart: form.promotionStart || undefined, promotionEnd: form.promotionEnd || undefined,
        variants, images: form.images.filter(Boolean).map(url => ({ url })), notes,
      };

      const res = editing
        ? await fetch(`/api/products/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      if (res.ok) { await loadData(); resetForm(); } else { const d = await res.json().catch(() => ({})); alert(d.error || 'Erro ao salvar.'); }
    } catch { alert('Erro ao salvar produto.'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) await loadData();
  };

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb' }}>Produtos ({products.length})</h2>
        {canEdit && <button onClick={() => { resetForm(); setShowForm(true); }} style={btnPrimary}>+ Novo Produto</button>}
      </div>

      {showForm && (
        <div ref={formRef} style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.15)', borderRadius: 16, padding: 24, marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#faf5eb', marginBottom: 16 }}>{editing ? 'Editar Produto' : 'Novo Produto'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Nome</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={inputStyle} /></div>
              <div><label style={labelStyle}>Marca</label><select value={form.brandId} onChange={e => setForm({ ...form, brandId: e.target.value })} style={inputStyle}><option value="">Selecione...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div><label style={labelStyle}>Categoria</label><select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} style={inputStyle}><option value="">Selecione...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={labelStyle}>Família</label><select value={form.family} onChange={e => setForm({ ...form, family: e.target.value })} style={inputStyle}>{['Oriental', 'Amadeirado', 'Floral', 'Citrico', 'Aquático', 'Fougère', 'Aromático'].map(f => <option key={f}>{f}</option>)}</select></div>
              <div><label style={labelStyle}>Concentração</label><select value={form.concentration} onChange={e => setForm({ ...form, concentration: e.target.value })} style={inputStyle}>{['EdC', 'EdT', 'EdP', 'Parfum', 'Cologne'].map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div><label style={labelStyle}>Gênero</label><select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} style={inputStyle}><option value="M">Masculino</option><option value="F">Feminino</option><option value="Unissex">Unissex</option></select></div>
              <div><label style={labelStyle}>Ocasião</label><input value={form.occasion} onChange={e => setForm({ ...form, occasion: e.target.value })} placeholder="Ex: Noite" style={inputStyle} /></div>
              <div><label style={labelStyle}>Longevidade</label><input value={form.longevity} onChange={e => setForm({ ...form, longevity: e.target.value })} placeholder="Ex: Longa" style={inputStyle} /></div>
              <div><label style={labelStyle}>Projeção</label><input value={form.projection} onChange={e => setForm({ ...form, projection: e.target.value })} placeholder="Ex: Forte" style={inputStyle} /></div>
              <div><label style={labelStyle}>Destaque</label><label style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} />Sim</label></div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Descrição</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Descrição Curta</label>
              <input value={form.shortDescription} onChange={e => setForm({ ...form, shortDescription: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Variants (Tamanho / Preço / Promoção / Estoque)</label>
              {form.variants.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input type="number" min="1" value={v.sizeMl} onChange={e => { const vs = [...form.variants]; vs[i] = { ...vs[i], sizeMl: e.target.value }; setForm({ ...form, variants: vs }); }} placeholder="ml" style={inputStyle} />
                  <input type="number" step="0.01" min="0" value={v.price} onChange={e => { const vs = [...form.variants]; vs[i] = { ...vs[i], price: e.target.value }; setForm({ ...form, variants: vs }); }} placeholder="Preço" style={inputStyle} />
                  <input type="number" step="0.01" min="0" value={v.promotionalPrice} onChange={e => { const vs = [...form.variants]; vs[i] = { ...vs[i], promotionalPrice: e.target.value }; setForm({ ...form, variants: vs }); }} placeholder="Promo (opc)" style={inputStyle} />
                  <input type="number" min="0" value={v.stock} onChange={e => { const vs = [...form.variants]; vs[i] = { ...vs[i], stock: e.target.value }; setForm({ ...form, variants: vs }); }} placeholder="Estoque" style={inputStyle} />
                  <button type="button" onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })} style={btnSmallDanger}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, variants: [...form.variants, { sizeMl: '', price: '', promotionalPrice: '', stock: '' }] })} style={{ ...btnSecondary, marginTop: 8, fontSize: '0.8rem' }}>+ Tamanho</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Notas Olfativas</label>
              {(['top', 'heart', 'base'] as const).map(type => (
                <div key={type} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.7rem', color: '#d4b86a', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 4 }}>{type === 'top' ? 'Topo' : type === 'heart' ? 'Coração' : 'Fundo'}</div>
                  {form.notes[type].map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input value={n} onChange={e => { const notes = { ...form.notes }; notes[type] = [...notes[type]]; notes[type][i] = e.target.value; setForm({ ...form, notes }); }} placeholder={`Nota ${type}`} style={inputStyle} />
                      <button type="button" onClick={() => { const notes = { ...form.notes }; notes[type] = notes[type].filter((_, j) => j !== i); setForm({ ...form, notes }); }} style={btnSmallDanger}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => { const notes = { ...form.notes }; notes[type] = [...notes[type], '']; setForm({ ...form, notes }); }} style={{ ...btnSecondary, marginTop: 4, fontSize: '0.75rem', padding: '4px 10px' }}>+ Nota</button>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Imagens (URLs)</label>
              {form.images.map((url, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input value={url} onChange={e => { const imgs = [...form.images]; imgs[i] = e.target.value; setForm({ ...form, images: imgs }); }} placeholder="https://..." style={inputStyle} />
                  <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} style={btnSmallDanger}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, images: [...form.images, ''] })} style={{ ...btnSecondary, marginTop: 4, fontSize: '0.8rem' }}>+ Imagem</button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}</button>
              <button type="button" onClick={resetForm} style={btnSecondary}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.1)' }}>
              {['Produto', 'Categoria', 'Preço', 'Estoque', 'Destaque', 'Views', 'Ações'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.05)' }}>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.images?.[0] ? <img src={p.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' as const }} /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(200,168,78,0.15)' }} />}
                    <div>
                      <div style={{ fontWeight: 600, color: '#faf5eb', fontSize: '0.85rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#c8b898' }}>{p.brand} {p.concentration ? `· ${p.concentration}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>{p.category ?? '-'}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {p.promotionalPrice ? (
                    <><span style={{ textDecoration: 'line-through', color: '#c8b898', fontSize: '0.8rem' }}>R$ {p.price.toFixed(2)}</span> <span style={{ color: '#ef4444' }}>R$ {p.promotionalPrice.toFixed(2)}</span></>
                  ) : `R$ ${p.price.toFixed(2)}`}
                </td>
                <td style={tdStyle}>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: p.stock === 0 ? 'rgba(239,68,68,0.15)' : p.stock <= 5 ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)', color: p.stock === 0 ? '#ef4444' : p.stock <= 5 ? '#fbbf24' : '#22c55e' }}>
                    {p.stock === 0 ? 'Esgotado' : p.stock}
                  </span>
                </td>
                <td style={tdStyle}>{p.featured ? '★' : '-'}</td>
                <td style={tdStyle}>{p.viewCount ?? 0}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {canEdit && <button onClick={() => handleEdit(p)} style={btnSmall}>Editar</button>}
                    {canEdit && <button onClick={() => handleDelete(p.id)} style={btnDanger}>Excluir</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Brands Tab ───────────────────────────────────────────────────────────────
function BrandsTab({ userRole }: { userRole: string }) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const canEdit = ['admin', 'editor'].includes(userRole);

  const load = useCallback(async () => {
    const res = await fetch('/api/brands');
    if (res.ok) setBrands(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), country: country.trim() || undefined }) });
    setName(''); setCountry(''); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta marca?')) return;
    await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb', marginBottom: '1rem' }}>Marcas ({brands.length})</h2>
      {canEdit && (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da marca" required style={{ ...inputStyle, flex: 2 }} />
          <input value={country} onChange={e => setCountry(e.target.value)} placeholder="País" style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={btnPrimary}>Adicionar</button>
        </form>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
        {brands.map(b => (
          <div key={b.id} style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, color: '#faf5eb', fontSize: '0.95rem' }}>{b.name}</div>
            {b.country && <div style={{ fontSize: '0.8rem', color: '#c8b898', marginTop: 2 }}>{b.country}</div>}
            {canEdit && <button onClick={() => handleDelete(b.id)} style={{ ...btnSmallDanger, marginTop: 8 }}>Remover</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ userRole }: { userRole: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const canEdit = ['admin', 'editor'].includes(userRole);

  const load = useCallback(async () => {
    const res = await fetch('/api/categories');
    if (res.ok) setCategories(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
    setName(''); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta categoria?')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb', marginBottom: '1rem' }}>Categorias ({categories.length})</h2>
      {canEdit && (
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da categoria" required style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={btnPrimary}>Adicionar</button>
        </form>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {categories.map(c => (
          <div key={c.id} style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#faf5eb', fontSize: '0.95rem' }}>{c.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#c8b898' }}>/{c.slug}</div>
            </div>
            {canEdit && <button onClick={() => handleDelete(c.id)} style={btnSmallDanger}>×</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<{ id: string; username: string; role: string; active: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  const load = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.trim() || !newPass.trim()) return;
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUser, password: newPass, role: newRole }) });
    setNewUser(''); setNewPass(''); setNewRole('viewer'); load();
  };

  const handleRoleChange = async (id: string, role: string) => {
    await fetch(`/api/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    load();
  };

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb', marginBottom: '1rem' }}>Usuários ({users.length})</h2>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' as const }}>
        <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="Usuário" required style={{ ...inputStyle, flex: 1 }} />
        <input value={newPass} onChange={e => setNewPass(e.target.value)} type="password" placeholder="Senha" required style={{ ...inputStyle, flex: 1 }} />
        <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" style={btnPrimary}>Criar</button>
      </form>
      <div style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.1)' }}>
              <th style={thStyle}>Usuário</th>
              <th style={thStyle}>Função</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.05)' }}>
                <td style={tdStyle}><span style={{ fontWeight: 600, color: '#faf5eb' }}>{u.username}</span></td>
                <td style={tdStyle}>
                  <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, background: u.active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: u.active ? '#22c55e' : '#ef4444' }}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleRoleChange(u.id, u.role)} style={{ ...btnSmall, opacity: 0.5 }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────
function AuditTab() {
  const [logs, setLogs] = useState<{ id: string; action: string; resource: string; resource_id: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit').then(r => r.ok ? r.json() : []).then(d => setLogs(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#c8b898', padding: '2rem', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb', marginBottom: '1rem' }}>Log de Auditoria</h2>
      <div style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 16, overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#c8b898' }}>Nenhum registro.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.1)' }}>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Ação</th>
                <th style={thStyle}>Recurso</th>
                <th style={thStyle}>ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(200, 168, 78, 0.05)' }}>
                  <td style={tdStyle}>{l.created_at}</td>
                  <td style={tdStyle}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(200,168,78,0.12)', color: '#d4b86a' }}>{l.action}</span></td>
                  <td style={tdStyle}>{l.resource}</td>
                  <td style={{ ...tdStyle, fontSize: '0.75rem', color: '#a1a1aa' }}>{l.resource_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Backup Tab ───────────────────────────────────────────────────────────────
function BackupTab() {
  const [info, setInfo] = useState<{ count: number; lastBackup: string | null } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/backup');
    if (res.ok) setInfo(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBackup = async () => {
    setCreating(true);
    await fetch('/api/backup', { method: 'POST' });
    await load();
    setCreating(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#faf5eb', marginBottom: '1rem' }}>Backup do Banco de Dados</h2>
      <div style={{ background: 'rgba(24, 24, 27, 0.5)', border: '1px solid rgba(200, 168, 78, 0.08)', borderRadius: 12, padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', color: '#c8b898' }}>Total de backups: <strong style={{ color: '#faf5eb' }}>{info?.count ?? 0}</strong></div>
          <div style={{ fontSize: '0.8rem', color: '#c8b898', marginTop: 4 }}>Último: <strong style={{ color: '#faf5eb' }}>{info?.lastBackup ?? 'Nenhum'}</strong></div>
        </div>
        <button onClick={handleBackup} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}>
          {creating ? 'Criando...' : 'Criar Backup Agora'}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid rgba(200, 168, 78, 0.2)', background: 'rgba(10, 10, 15, 0.6)',
  color: '#f5f0e6', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' as const,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#c8b898', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5,
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left' as const, fontSize: '0.7rem', fontWeight: 600, color: '#c8b898', textTransform: 'uppercase' as const, letterSpacing: 1,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: '0.85rem', color: '#c8b898',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg, #059669, #10b981)',
  color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
};

const btnSecondary: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 10,
  border: '1px solid rgba(200, 168, 78, 0.2)', background: 'transparent',
  color: '#c8b898', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
};

const btnSmall: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: 'none',
  background: 'rgba(200, 168, 78, 0.15)', color: '#d4b86a',
  fontWeight: 500, cursor: 'pointer', fontSize: '0.75rem',
};

const btnSmallDanger: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 6, border: 'none',
  background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444',
  fontWeight: 500, cursor: 'pointer', fontSize: '0.7rem',
};

const btnDanger: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: 'none',
  background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
  fontWeight: 500, cursor: 'pointer', fontSize: '0.75rem',
};
