# Fluxo de Compra Completo - Sistema Essencia Arabe

## Passo a Passo do Fluxo de Compra

### 1. Usuario Navega e Seleciona Produto

```
Frontend (Next.js) -> GET /api/products/slug/:slug
Backend: ProductsService.findBySlug()
  -> Retorna produto com variantes, notas olfativas, estoque
Frontend: Renderiza pagina do produto com opcoes de tamanho
```

### 2. Usuario Adiciona ao Carrinho

```
Frontend: Clica "Adicionar ao Carrinho"
POST /api/cart/items { variantId, quantity }

Backend: CartService.addItem()
  1. Valida existencia da variante (ProductsService.getVariantById)
  2. Verifica estoque disponivel (InventoryService.getAvailableStock)
  3. Chama InventoryService.reserveStock():
     a. Adquire lock distribuido no Redis (SETNX com TTL 5s)
     b. Abre transacao SQL com SELECT FOR UPDATE
     c. Verifica: quantity - reserved >= quantity_solicitada
     d. Incrementa: inventory.reserved += quantity
     e. Confirma transacao SQL
     f. Cria reserva no Redis com TTL 15min:
        reservation:{userId}:{variantId} = { quantity, reservedUntil }
     g. Libera lock Redis
  4. Cria item no Redis: cart:{userId}:{variantId} = CartItem (TTL 15min)
  5. Retorna carrinho atualizado

Resposta: { items: [...], subtotal, itemCount }
```

### 3. Carrinho Abandonado (Liberacao Automatica)

```
A cada 5 minutos, Cron Job roda:
  InventoryService.releaseExpiredReservations()
    1. Busca chaves reservation:ttl:*:* no Redis
    2. Para cada chave com TTL <= 0:
       a. Le dados da reserva: reservation:{userId}:{variantId}
       b. Chama releaseReservation():
          - Adquire lock distribuido
          - Transacao SQL: inventory.reserved = GREATEST(reserved - quantity, 0)
          - Remove chaves Redis
          - Libera lock

Resultado: Estoque e liberado automaticamente apos 15 min sem finalizar compra
```

### 4. Usuario Finaliza Compra

```
Frontend: Pagina de Checkout (3 steps)

Step 1 - Endereco:
  GET /api/users/me/addresses -> Lista enderecos cadastrados
  Usuario seleciona endereco de entrega

Step 2 - Pagamento:
  Usuario escolhe: PIX | Cartao de Credito | Boleto
  Se cartao: informa dados do cartao (tokenizados pelo gateway)

Step 3 - Confirmar:
  Exibe resumo: itens, endereco, pagamento, total
  Usuario clica "Confirmar Pedido"
```

### 5. Processamento do Pedido (Transacao Principal)

```
POST /api/orders
Backend: OrdersService.createOrder()

Dentro de uma UNICA transacao SQL:

  1. VALIDACOES:
     - Carrinho nao esta vazio
     - Cupom valido (se fornecido): data, limite de usos, valor minimo
     - Estoque reservado ainda e valido

  2. CALCULOS:
     - subtotal = soma(item.unitPrice * item.quantity)
     - discount = cupom + pontos_fidelidade
     - shippingCost = frete calculado
     - total = subtotal - discount + shippingCost
     - loyaltyPointsEarned = total * 0.1 (10% em pontos)

  3. CRIAR PEDIDO:
     INSERT INTO orders (userId, status, subtotal, discount, shippingCost, 
       total, couponId, shippingAddressId, paymentMethod, loyaltyPointsUsed,
       loyaltyPointsEarned)
     VALUES (...)

  4. CRIAR ITENS DO PEDIDO:
     Para cada item do carrinho:
       INSERT INTO order_items (orderId, variantId, productName, variantSku, 
         sizeMl, unitPrice, quantity, totalPrice)
       
  5. CONFIRMAR ESTOQUE (decrementar real):
     InventoryService.confirmReservation(variantId, quantity, userId)
       - Adquire lock distribuido
       - Transacao SQL: 
           inventory.quantity -= quantity
           inventory.reserved -= quantity
       - Remove chaves Redis de reserva
       - Libera lock

  6. ATUALIZAR CUPOM:
     UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?

  7. ATUALIZAR PONTOS DE FIDELIDADE:
     UPDATE users SET loyalty_points = loyalty_points - used + earned

  8. LIMPAR CARRINHO:
     CartService.clearCart()
       - Remove todas as chaves cart:{userId}:* do Redis

  9. RETORNAR PEDIDO CRIADO

```

### 6. Processamento do Pagamento

```
POST /api/payments/process
Backend: PaymentsService.processPayment()

Se PIX:
  1. Chama API do Mercado Pago para criar pagamento PIX
  2. Retorna: qrCode (imagem) + pixCopyPaste (copia e cola)
  3. Frontend exibe QR Code para o usuario escanear
  4. Webhook do gateway notifica quando pagamento for aprovado

Se Cartao de Credito:
  1. Tokeniza cartao via SDK do gateway (frontend)
  2. Envia dados tokenizados para backend
  3. Backend cria pagamento no gateway
  4. Gateway processa e retorna status
  5. Se aprovado: status = 'approved'

Se Boleto:
  1. Gera boleto via API do gateway
  2. Retorna URL do boleto para download
  3. Webhook notifica quando pagamento for compensado (1-3 dias)
```

### 7. Apos Confirmacao do Pagamento

```
Gateway envia webhook/notificacao para:
  POST /api/webhooks/payment

Backend processa:
  1. Valida assinatura do webhook
  2. Atualiza status do pagamento: paymentStatus = 'approved'
  3. Atualiza data de pagamento: paidAt = NOW()
  4. Envia email de confirmacao (BullMQ -> SendGrid):
     NotificationsService.sendOrderConfirmation()
  5. Gera nota fiscal (BullMQ):
     NotificationsService.generateInvoice()

Status do pedido: pending -> approved
```

### 8. Logistica e Envio

```
Admin atualiza status via Painel:

  approved -> processing (preparando)
  processing -> separando (separacao do estoque fisico)
  separando -> shipped (enviado)

Ao mudar para shipped:
  1. Gera codigo de rastreio via API dos Correios/transportadora
  2. Atualiza: trackingCode, shippingProvider, shippedAt
  3. Envia email com codigo de rastreio

  shipped -> delivered (entregue)
  Ao confirmar entrega:
    - Atualiza deliveredAt
    - Libera pontos de fidelidade se ainda nao liberados
```

### 9. Resumo dos Servicos Envolvidos

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  API Gateway │────▶│   Backend    │
│   (Next.js)  │     │   (Nginx)    │     │   (NestJS)   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌────────────────────────────┼────────────┐
                    │                            │            │
              ┌─────▼─────┐  ┌──────────┐  ┌────▼────┐  ┌───▼────┐
              │ PostgreSQL │  │  Redis   │  │ BullMQ  │  │ Externo│
              │  (dados)   │  │ (cache)  │  │ (filas) │  │ APIs   │
              └───────────┘  └──────────┘  └─────────┘  └────────┘
                                                     │
                                            ┌────────┼────────┐
                                            │        │        │
                                       ┌────▼──┐ ┌──▼───┐ ┌──▼─────┐
                                       │Mercado│ │Corre-│ │SendGrid│
                                       │ Pago  │ │ ios  │ │ (email)│
                                       └───────┘ └──────┘ └────────┘
```

### 10. Cenarios de Erro e Tratamento

```
ERRO: Estoque insuficiente ao adicionar ao carrinho
  -> 400 Bad Request: "Estoque insuficiente. Disponivel: X"

ERRO: Concorrencia (outro usuario comprou o ultimo item)
  -> 409 Conflict: "Estoque sendo processado. Tente novamente."

ERRO: Reserva expirada durante checkout
  -> 400 Bad Request: "Item nao esta mais reservado no carrinho."
  -> Frontend atualiza carrinho automaticamente

ERRO: Pagamento rejeitado
  -> 402 Payment Required: "Pagamento nao aprovado."
  -> Pedido fica com status 'pending', estoque continua reservado
  -> Timeout de 30 minutos: libera estoque automaticamente

ERRO: Cupom invalido
  -> 400 Bad Request: "Cupom invalido / expirado / atingiu limite"
```
