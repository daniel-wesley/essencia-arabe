# Arquitetura do Sistema Essência Árabe - Perfumaria Digital

## Visão Geral

Sistema de catálogo de perfumes árabes com painel administrativo completo.
Frontend Next.js com SQLite local, backend NestJS para expansão futura.

## Stack

- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend (futuro):** NestJS, TypeORM
- **Banco:** SQLite (via `node:sqlite` do Node.js)
- **Autenticação:** Sessão via token hash (SHA-256) + cookies HttpOnly

## Arquitetura Atual

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── layout.tsx            # Layout global + SEO
│   │   ├── globals.css           # Estilos globais
│   │   ├── products/
│   │   │   ├── page.tsx          # Listagem com filtros
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Detalhe do produto
│   │   ├── admin/
│   │   │   └── page.tsx          # Painel administrativo completo
│   │   └── api/
│   │       ├── auth/route.ts     # Login/logout/sessão
│   │       ├── products/route.ts # CRUD produtos
│   │       ├── products/[id]/route.ts
│   │       ├── brands/route.ts   # CRUD marcas
│   │       ├── brands/[id]/route.ts
│   │       ├── categories/route.ts
│   │       ├── dashboard/route.ts
│   │       ├── users/route.ts
│   │       ├── users/[id]/route.ts
│   │       ├── audit/route.ts
│   │       └── backup/route.ts
│   └── lib/
│       └── db.ts                 # Banco de dados + lógica de negócio
├── data/
│   ├── janilly.db                # Banco SQLite
│   └── backups/                  # Backups automáticos
└── public/
    └── images/                   # Imagens estáticas
```

## Modelo de Dados (SQLite)

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários com roles (admin/editor/viewer) |
| `sessions` | Sessões ativas com token hash |
| `brands` | Marcas de perfumes |
| `categories` | Categorias (gênero, promoção, etc.) |
| `products` | Produtos com metadados completos |
| `product_variants` | Variantes por tamanho (estoque individual) |
| `product_images` | Imagens dos produtos |
| `product_notes` | Notas olfativas estruturadas (top/heart/base) |
| `product_views` | Controle de visualizações |
| `audit_logs` | Log de auditoria administrativa |
| `login_attempts` | Controle de rate limiting |

## Segurança

- **Senhas:** Hash via `crypto.scryptSync` (salt + 64 bytes)
- **Sessões:** Token aleatório → SHA-256 hash armazenado no banco
- **Cookies:** HttpOnly, Secure (produção), SameSite=Lax, 24h expiry
- **Rate Limiting:** 5 tentativas → bloqueio de 15 minutos
- **RBAC:** Admin (tudo), Editor (produtos/marcas/categorias), Viewer (visualização)
- **Auditoria:** Todas as ações administrativas são logadas

## Funcionalidades

### Cliente (Público)
- Catálogo de perfumes árabes com filtros
- Detalhe do produto com notas olfativas
- Botão "Tenho Interesse" → WhatsApp
- Busca por nome/marca
- Filtros por categoria e marca

### Administrativo
- Dashboard com métricas (produtos, estoque, visualizações)
- Gestão de produtos (CRUD completo)
- Gestão de marcas e categorias
- Controle de usuários com níveis de acesso
- Log de auditoria
- Backup manual do banco

## Notas de Implementação

- O sistema opera como aplicação standalone com SQLite persistente
- Backups devem ser feitos regularmente para `data/backups/`
- O banco SQLite requer armazenamento persistente (não usar em filesystem efêmero)
- Para escalar, considerar migração para PostgreSQL
