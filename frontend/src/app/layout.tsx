import type { Metadata } from 'next';
import './globals.css';
import BackgroundSlider from './components/BackgroundSlider';

export const metadata: Metadata = {
  title: 'Essência Árabe | Perfumes Árabes Autênticos',
  description: 'Perfumes árabes autênticos das melhores marcas do Oriente Médio. Lattafa, Afnan, Armaf, Rasasi e mais. Catálogo completo com preços especiais.',
  keywords: 'perfumes árabes,香水, lattafa, afnan, armaf, rasasi, essência árabe, perfume oriental, oud',
  openGraph: {
    title: 'Essência Árabe | Perfumes Árabes Autênticos',
    description: 'Perfumes árabes autênticos das melhores marcas do Oriente Médio.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Essência Árabe',
  },
  robots: 'index, follow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <BackgroundSlider />
        <header className="header">
          <a href="/" className="header-logo-link" style={{ flexDirection: 'column', gap: '0.25rem' }}>
            <img
              src="/images/logo.png"
              alt="Essência Árabe Logo"
              className="header-logo-img"
            />
            <span className="header-logo-text">Essência Árabe</span>
          </a>
          <nav className="header-nav">
            <a href="/products">Catálogo</a>
            <a href="/products?category=masculino">Masculinos</a>
            <a href="/products?category=feminino">Femininos</a>
            <a href="/products?category=promocoes">Promoções</a>
          </nav>
          <div className="header-actions">
            <a
              href="https://wa.me/556198038416"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-link whatsapp"
            >
              <img src="/images/icons/whatsapp.gif" alt="WhatsApp" className="social-icon-img" />
              <span>WhatsApp</span>
            </a>
            <a
              href="https://www.instagram.com/essenciaarabebrasilia?utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon-link instagram"
            >
              <img src="/images/icons/instagram.gif" alt="Instagram" className="social-icon-img" />
              <span>Instagram</span>
            </a>
            <a href="/admin" className="btn-glow">Admin</a>
          </div>
        </header>

        <main>{children}</main>

        <footer className="footer">
          <div className="footer-grid">
            <div>
              <a href="/" className="header-logo-link" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
                <img src="/images/logo.png" alt="Essência Árabe Logo" className="footer-logo-img" />
                <span className="header-logo-text" style={{ fontSize: '1.5rem' }}>Essência Árabe</span>
              </a>
              <p className="footer-desc">
                Sua perfumaria digital especializada em fragrâncias árabes autênticas.
                Qualidade, originalidade e atendimento personalizado.
              </p>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Navegação</div>
              <a href="/products">Catálogo Completo</a>
              <a href="/products?category=masculino">Masculinos</a>
              <a href="/products?category=feminino">Femininos</a>
              <a href="/products?category=promocoes">Promoções</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Atendimento</div>
              <a href="https://wa.me/556198038416" target="_blank" rel="noopener noreferrer">
                <img src="/images/icons/whatsapp.gif" alt="" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 6 }} />WhatsApp
              </a>
              <a href="https://www.instagram.com/essenciaarabebrasilia?utm_source=qr" target="_blank" rel="noopener noreferrer">
                <img src="/images/icons/instagram.gif" alt="" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 6 }} />Instagram
              </a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Institucional</div>
              <a href="/admin">Painel Admin</a>
            </div>
          </div>
          <div className="footer-bottom">
            2026 Essência Árabe. Todos os direitos reservados.
          </div>
        </footer>
      </body>
    </html>
  );
}
