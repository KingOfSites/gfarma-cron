# 🔄 Sistema Independente de Sincronização de Pedidos

**Arquitetura Completamente Independente - Sem timeout da Vercel!**

---

## 🎯 O que Mudou?

### ❌ Antes (com Timeout)
```
CRON → HTTP POST → Dashboard (Vercel) → Magento + DB
                    └─ Timeout 10-60s ⚠️
```

### ✅ Agora (Sem Timeout!)
```
CRON → Magento (SOAP direto) + PostgreSQL/MySQL
└─ Sem limites de tempo! 🎉
```

**Dashboard (Vercel) apenas visualiza os dados!**

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────┐
│  MAGENTO (SOAP API)                     │
│  https://www.gfarma.com/api/v2_soap     │
└────────────────┬────────────────────────┘
                 │
                 │ SOAP direto
                 │
                 ▼
┌─────────────────────────────────────────┐
│  GALENICA-CRON (independente)           │
│  ├─ Prisma Client                       │
│  ├─ Funções de sincronização            │
│  └─ Jobs agendados (node-cron)          │
└────────────────┬────────────────────────┘
                 │
                 │ salva direto
                 │
                 ▼
┌─────────────────────────────────────────┐
│  MYSQL / POSTGRESQL                     │
│  (Orders, OrderItems, Customers)        │
└────────────────┬────────────────────────┘
                 ▲
                 │ apenas lê
                 │
┌─────────────────────────────────────────┐
│  DASHBOARD (Vercel/qualquer host)       │
│  └─ Apenas UI para visualização         │
└─────────────────────────────────────────┘
```

---

## ✨ Benefícios

### 1. Sem Timeout
- ✅ Roda quanto tempo precisar
- ✅ Sincroniza milhares de pedidos sem problema
- ✅ Dashboard pode ficar na Vercel tranquilamente

### 2. Mais Robusto
- ✅ Menos pontos de falha
- ✅ Sem dependência de HTTP
- ✅ Retry automático no próprio cron

### 3. Mais Rápido
- ✅ Conexão direta com Magento
- ✅ Sem overhead de HTTP
- ✅ Prisma otimizado

### 4. Mais Simples
- ✅ Menos configuração
- ✅ Sem endpoints HTTP para manter
- ✅ Tudo em um lugar

---

## 🚀 Setup

### 1. Instalar Dependências

```bash
cd galenica-cron/cron-env
npm install
```

### 2. Configurar Variáveis

Copie e edite o `.env`:

```bash
cp env.example .env
nano .env  # ou use seu editor preferido
```

**Variáveis essenciais:**

```env
# Timezone
TIMEZONE=America/Sao_Paulo

# Magento API
MAGENTO_API_URL=https://www.gfarma.com/api/v2_soap
MAGENTO_API_USER=seu_usuario
MAGENTO_API_KEY=sua_chave

# Database (mesmo do dashboard!)
DATABASE_URL=mysql://user:password@localhost:3306/galenica

# Executar ao iniciar (para testes)
RUN_ON_START=false
```

### 3. Gerar Prisma Client

```bash
npm run prisma:generate
```

### 4. Testar Conexões

```bash
# Testar conexão com o banco
npm run prisma:push  # Atualiza schema (se necessário)
```

### 5. Executar

#### Desenvolvimento (com logs)
```bash
npm run dev
```

#### Produção
```bash
npm run build
npm start
```

---

## 📅 Jobs Configurados

### JOB1 - Sincronização Completa (2x/dia)

**Schedule:** `0 5,12 * * *`  
**Horários:** 5:00 AM e 12:00 PM  
**Função:** `sync3Days()`

**O que faz:**
- Sincroniza TODOS os pedidos dos últimos 3 dias
- Atualiza status, pagamentos, endereços
- Busca detalhes completos de cada pedido
- Ideal para: mudanças de status, pagamentos aprovados

**Duração típica:** 1-5 minutos (dependendo da quantidade)

### JOB2 - Sincronização Rápida (22x/dia)

**Schedule:** `0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *`  
**Horários:** Toda hora, EXCETO 5h e meio-dia  
**Função:** `syncLast50()`

**O que faz:**
- Busca o pedido mais recente no banco
- Sincroniza ~50 pedidos a partir dele
- Processamento rápido (um por vez)
- Ideal para: capturar novos pedidos rapidamente

**Duração típica:** 30-60 segundos

---

## 🔧 Como Funciona Internamente

### Sync 3 Dias (JOB1)

```typescript
// Calcula período
const now = new Date();
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

// Conecta no Magento
const sessionId = await getMagentoSession();

// Busca pedidos (com fatiamento em janelas)
const orders = await getOrdersListWindowed(sessionId, {
  updated_at: {
    from: threeDaysAgo,
    to: now
  }
});

// Processa cada pedido
for (const order of orders) {
  // Salva no banco (upsert)
  await saveOrderToDatabase(order);
  
  // Busca e salva detalhes
  const details = await getOrderInfo(sessionId, order.increment_id);
  await saveOrderDetailsToDatabase(details);
}
```

### Sync Últimos 50 (JOB2)

```typescript
// Busca pedido mais recente no banco
const mostRecent = await prisma.order.findFirst({
  orderBy: { incrementId: 'desc' }
});

// Define período (2 dias a partir do mais recente)
const fromDate = new Date(mostRecent.updatedAt.getTime() - 2 * 24 * 60 * 60 * 1000);

// Busca e processa (igual ao JOB1, mas com menos pedidos)
```

---

## 📊 Logs

Os logs são detalhados e mostram o progresso:

```
=============================================================
🚀 Iniciando JOB1 - 2026-01-25 05:00:00
Sincronização dos últimos 3 dias
=============================================================

=== Iniciando sincronização de pedidos ===
✅ Sessão Magento obtida
🗓️ Range efetivo: { from: '2026-01-22 05:00:00', to: '2026-01-25 05:00:00' }
🧩 Janela 2026-01-22 05:00:00 → 2026-01-22 11:00:00: 45 pedidos
🧩 Janela 2026-01-22 11:00:01 → 2026-01-22 17:00:00: 52 pedidos
...
✅ 127 pedidos encontrados
📊 Processando 127 pedidos...

✅ [1.2%] 100066550 - NOVO | Status: PENDING
   📋 Detalhes salvos
🔄 [2.4%] 100066551 - Status: PENDING → PROCESSING
⏭️  [3.6%] 100066552 - Sem mudanças | Status: COMPLETE
...

==================================================
📊 RESUMO DA SINCRONIZAÇÃO
==================================================
✅ Total processado: 127
   ➕ Novos pedidos: 23
   🔄 Atualizados: 104
   📝 Mudanças de status: 18
   📋 Detalhes buscados: 127
   ❌ Erros: 0
==================================================

=============================================================
✅ JOB1 FINALIZADO
=============================================================
⏱️  Tempo de execução: 145.32s
🕐 Completado em: 2026-01-25 05:02:25

📈 RESUMO DA SINCRONIZAÇÃO:
   • Total de pedidos: 127
   • Novos pedidos: 23
   • Pedidos atualizados: 104
   • Mudanças de status: 18
   • Detalhes buscados: 127
   • Erros: 0
=============================================================
```

---

## 🐳 Deploy com Docker

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  galenica-cron:
    build: .
    env_file: .env
    restart: unless-stopped
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: senha
      MYSQL_DATABASE: galenica
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
```

### Rodar

```bash
docker-compose up -d
docker-compose logs -f galenica-cron
```

---

## 🆘 Troubleshooting

### Erro: "Credenciais não configuradas"

Verifique o `.env`:
```bash
grep MAGENTO .env
```

Deve ter:
```env
MAGENTO_API_USER=seu_usuario
MAGENTO_API_KEY=sua_chave
```

### Erro: Prisma Client não gerado

```bash
npm run prisma:generate
```

### Erro: Conexão com banco

```bash
# Testar conexão
npm run prisma:push

# Ver schema atual
npx prisma studio
```

### Jobs não executam

1. Verificar timezone:
```env
TIMEZONE=America/Sao_Paulo
```

2. Testar imediatamente:
```env
RUN_ON_START=true
```

3. Ver logs:
```bash
npm run dev  # Modo desenvolvimento com logs
```

---

## 📚 Arquivos Importantes

```
galenica-cron/cron-env/
├── prisma/
│   └── schema.prisma           # Schema do banco (Order, OrderItem, Customer)
├── src/
│   ├── index.ts                # Entry point - agenda os jobs
│   └── lib/
│       ├── magento-sync.ts     # Lógica completa de sincronização
│       ├── env.ts              # Parser de .env
│       ├── types.ts            # Types
│       ├── utils.ts            # Utilidades
│       └── constants.ts        # Constantes
├── .env                        # Configuração (não comitar!)
├── env.example                 # Template de configuração
└── package.json                # Dependências
```

---

## 🎉 Pronto!

Agora você tem um sistema:
- ✅ **Independente** - Não depende do dashboard
- ✅ **Robusto** - Sem timeout, sem limites
- ✅ **Rápido** - Conexão direta com Magento
- ✅ **Escalável** - Aguenta milhares de pedidos
- ✅ **Vercel-friendly** - Dashboard pode ficar na Vercel

**O dashboard só visualiza. O cron faz todo o trabalho pesado!**

---

**Desenvolvido para Galenica** 🏥
