# API Endpoints - Sistema Essencia Arabe

## Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro de novo usuário |
| POST | `/api/auth/login` | Login e retorno do JWT |

## Usuários
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/users/me` | Obter perfil do usuário logado |
| PATCH | `/api/users/me` | Atualizar perfil do usuário |
| GET | `/api/users/me/addresses` | Listar endereços do usuário |
| POST | `/api/users/me/addresses` | Adicionar novo endereço |
| DELETE | `/api/users/me/addresses/:id` | Remover endereço |

## Produtos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/products` | Listar produtos com filtros e paginação |
| GET | `/api/products/:id` | Detalhes do produto por ID |
| GET | `/api/products/slug/:slug` | Detalhes do produto por slug |
| GET | `/api/products/brands` | Listar todas as marcas |
| GET | `/api/products/categories` | Listar categorias |
| GET | `/api/products/notes` | Listar notas olfativas disponíveis |

## Busca
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/search?q=amadeirado` | Busca textual com sinônimos e sugestões |

## Carrinho
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cart` | Obter carrinho do usuário |
| POST | `/api/cart/items` | Adicionar item ao carrinho |
| POST | `/api/cart/items/:variantId` | Atualizar quantidade do item |
| POST | `/api/cart/items/:variantId/remove` | Remover item do carrinho |
| POST | `/api/cart/clear` | Limpar carrinho |

## Pedidos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/orders` | Criar novo pedido (checkout) |
| GET | `/api/orders` | Listar pedidos do usuário |
| GET | `/api/orders/:id` | Detalhes de um pedido |
| POST | `/api/orders/:id/cancel` | Cancelar pedido |
| PATCH | `/api/orders/:id/status` | Atualizar status do pedido (admin) |

## Recomendações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/recommendations/personalized` | Recomendações personalizadas |
| GET | `/api/recommendations/complementary/:productId` | Produtos complementares |
| GET | `/api/recommendations/trending` | Produtos em alta |
| POST | `/api/recommendations/track` | Registrar interação com recomendação |

## Estoque
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/inventory/stock/:variantId` | Consultar estoque disponível |
| GET | `/api/inventory/stock/bulk?ids=id1,id2` | Consulta em lote |

## Pagamentos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/payments/process` | Processar pagamento (PIX, Cartão, Boleto) |
| GET | `/api/payments/:paymentId/status` | Consultar status do pagamento |

## Dashboard (Admin)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/dashboard/metrics` | Métricas gerais (vendas, ticket, conversão) |
| GET | `/api/dashboard/low-stock` | Produtos com estoque baixo |
