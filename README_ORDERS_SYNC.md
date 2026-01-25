# 🔄 Sincronização Automática de Pedidos - Galenica Cron

Sistema automatizado para sincronizar pedidos do Magento com o Dashboard Galenica usando jobs de cron.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Jobs Disponíveis](#jobs-disponíveis)
- [Como Funciona](#como-funciona)
- [Monitoramento](#monitoramento)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema possui **dois jobs principais** que trabalham em conjunto para manter os pedidos sempre atualizados:

### 1️⃣ Sincronização dos Últimos 3 Dias (JOB1)
- **Quando:** Às 5h da manhã e ao meio-dia (12h)
- **O que faz:** Sincroniza TODOS os pedidos dos últimos 3 dias
- **Propósito:** Capturar mudanças de status, pagamentos aprovados, cancelamentos, etc.
- **Endpoint:** `/api/magento/orders/sync-3-days`

### 2️⃣ Sincronização dos Últimos 50 Pedidos (JOB2)
- **Quando:** A cada hora (exceto às 5h e meio-dia)
- **O que faz:** Sincroniza os últimos ~50 pedidos mais recentes
- **Propósito:** Manter os pedidos mais novos sempre atualizados em tempo quase real
- **Endpoint:** `/api/magento/orders/sync-last-50`

---

## ⚙️ Configuração

### 1. Configurar Variáveis de Ambiente

Edite o arquivo `.env` (ou copie de `env.example`):

```bash
# Copiar exemplo
cp env.example .env

# Editar configurações
nano .env
```

### 2. Configurar a URL do Dashboard

No arquivo `.env`, ajuste a URL do seu dashboard:

```env
# Para ambiente local
JOB1=0 5,12 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *::POST::http://localhost:3001/api/magento/orders/sync-last-50

# Para ambiente de produção
# JOB1=0 5,12 * * *::POST::https://dashboard.galenica.com.br/api/magento/orders/sync-3-days
# JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *::POST::https://dashboard.galenica.com.br/api/magento/orders/sync-last-50
```

### 3. Configurar Timezone

```env
TIMEZONE=America/Sao_Paulo
```

### 4. Configurar Timeout (Opcional)

```env
# Timeout em milissegundos (padrão: 300000 = 5 minutos)
REQUEST_TIMEOUT=300000
```

---

## 📅 Jobs Disponíveis

### JOB1: Sincronização dos Últimos 3 Dias

**Schedule:** `0 5,12 * * *`

- Roda às **5:00 AM** e às **12:00 PM** todos os dias
- Sincroniza pedidos dos últimos 3 dias completos
- Atualiza status, pagamentos, endereços, itens
- **Importante:** Detecta mudanças de status automaticamente

**Exemplo de configuração:**
```env
JOB1=0 5,12 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### JOB2: Sincronização dos Últimos 50 Pedidos

**Schedule:** `0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *`

- Roda **a cada hora** (exceto às 5h e meio-dia)
- Sincroniza os ~50 pedidos mais recentes
- Busca automaticamente a partir do pedido mais recente no banco
- Perfeito para capturar novos pedidos rapidamente

**Exemplo de configuração:**
```env
JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *::POST::http://localhost:3001/api/magento/orders/sync-last-50
```

**Por que excluir 5h e meio-dia?**
- Para evitar execução simultânea dos dois jobs
- O JOB1 já faz uma sincronização completa nesses horários
- Economia de recursos e melhor performance

---

## 🔧 Como Funciona

### Fluxo de Sincronização

```
┌─────────────────────────────────────────────────────────┐
│                    CRON SCHEDULER                        │
│  (galenica-cron/cron-env)                               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ HTTP POST Request
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│              DASHBOARD GALENICA API                      │
│  /api/magento/orders/sync-3-days                        │
│  /api/magento/orders/sync-last-50                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Chama internamente
                  │
                  ↓
┌─────────────────────────────────────────────────────────┐
│          SYNC NORMAL (Motor Principal)                   │
│  /api/magento/orders/sync-normal                        │
│  - Conecta com Magento SOAP API                         │
│  - Busca pedidos com filtros                            │
│  - Detecta mudanças de status                           │
│  - Atualiza banco de dados                              │
└─────────────────────────────────────────────────────────┘
```

### O que cada job faz:

#### 🌅 JOB1 - 5h da manhã
1. Busca todos os pedidos dos últimos 3 dias
2. Verifica mudanças de status de cada um
3. Atualiza banco de dados
4. **Cenário:** Captura pagamentos aprovados durante a noite, cancelamentos, etc.

#### 🌞 JOB1 - Meio-dia
1. Busca todos os pedidos dos últimos 3 dias
2. Atualiza status de pedidos da manhã
3. **Cenário:** Captura mudanças do período da manhã

#### ⏰ JOB2 - A cada hora
1. Busca o pedido mais recente no banco
2. Sincroniza os últimos ~50 pedidos a partir dele
3. Atualiza apenas o que mudou
4. **Cenário:** Captura novos pedidos e mudanças recentes rapidamente

---

## 🚀 Iniciando o Cron

### Desenvolvimento (com logs visíveis)

```bash
cd galenica-cron/cron-env
npm run dev
```

### Produção

```bash
cd galenica-cron/cron-env
npm run build
npm start
```

### Com Docker (Recomendado para Produção)

```bash
cd galenica-cron/cron-env
docker build -t galenica-cron .
docker run -d --name galenica-cron --env-file .env galenica-cron
```

---

## 📊 Monitoramento

### Logs em Tempo Real

O cron exibe logs detalhados de cada execução:

```
=============================================================
🚀 Iniciando Job 1 - 2026-01-25 05:00:00
=============================================================
📡 POST http://localhost:3001/api/magento/orders/sync-3-days
=============================================================

🔄 Iniciando sincronização de pedidos dos últimos 3 dias...
📅 Período: 2026-01-22 05:00:00 até 2026-01-25 05:00:00
✅ Sessão Magento obtida
✅ 127 pedidos encontrados

📊 Processando pedidos...
✅ [1.2%] 100066550 - NOVO pedido importado | Status: PENDING
🔄 [2.4%] 100066551 - Status atualizado: PENDING → PROCESSING
⏭️  [3.6%] 100066552 - Já existe (sem mudanças) | Status: COMPLETE
...

=============================================================
✅ Job 1 FINALIZADO
=============================================================
📊 Status HTTP: 200
⏱️  Tempo de execução: 45.32s
🕐 Completado em: 2026-01-25 05:00:45

📈 RESUMO DA SINCRONIZAÇÃO:
   • Total de pedidos: 127
   • Novos pedidos: 23
   • Pedidos atualizados: 104
   • Mudanças de status: 18
   • Detalhes buscados: 127
   • Erros: 0

⚡ Tempo de sincronização: 45.32s
=============================================================
```

### Verificar Status dos Jobs

```bash
# Ver jobs agendados
npm run get

# Ver logs em tempo real
tail -f nohup.out  # Se rodando em background
docker logs -f galenica-cron  # Se usando Docker
```

---

## 🛠️ Troubleshooting

### Job não está executando

1. **Verificar se o cron está rodando:**
```bash
ps aux | grep "tsx.*index.ts"
# ou
docker ps | grep galenica-cron
```

2. **Verificar timezone:**
```bash
# No arquivo .env
TIMEZONE=America/Sao_Paulo
```

3. **Testar endpoint manualmente:**
```bash
curl -X POST http://localhost:3001/api/magento/orders/sync-3-days
```

### Erros de conexão

1. **Dashboard não está rodando:**
```bash
# Verificar se o dashboard está ativo
curl http://localhost:3001/api/docs
```

2. **URL incorreta no .env:**
```env
# Verificar se a URL está correta
JOB1=0 5,12 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
#                        ^^^^^^^^^^^^^^^^^ URL correta?
```

### Timeout nos jobs

1. **Aumentar timeout no .env:**
```env
# Aumentar para 10 minutos (600000ms)
REQUEST_TIMEOUT=600000
```

2. **Verificar se o Magento está lento:**
```bash
# Testar manualmente o tempo de resposta
time curl -X POST http://localhost:3001/api/magento/orders/sync-last-50
```

### Jobs executando simultaneamente

Se os dois jobs executarem ao mesmo tempo:

1. **Verificar schedule no .env:**
```env
# JOB1 deve ser: 0 5,12 * * *
# JOB2 deve ser: 0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *
#                   ^^^ Não incluir 5 nem 12!
```

---

## 📝 Personalizações

### Executar mais vezes por dia

Para sincronizar os últimos 3 dias mais vezes:

```env
# A cada 4 horas (0h, 4h, 8h, 12h, 16h, 20h)
JOB1=0 0,4,8,12,16,20 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Ajustar JOB2 para excluir esses horários
JOB2=0 1,2,3,5,6,7,9,10,11,13,14,15,17,18,19,21,22,23 * * *::POST::http://localhost:3001/api/magento/orders/sync-last-50
```

### Executar apenas em dias úteis

```env
# Apenas de segunda a sexta (1-5)
JOB1=0 5,12 * * 1-5::POST::http://localhost:3001/api/magento/orders/sync-3-days
JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * 1-5::POST::http://localhost:3001/api/magento/orders/sync-last-50
```

### Sincronizar período maior

Para sincronizar 7 dias:

```env
JOB1=0 5,12 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

---

## 🎯 Próximos Passos

Após configurar o cron:

1. ✅ Testar manualmente cada endpoint
2. ✅ Iniciar o cron em modo dev para ver os logs
3. ✅ Verificar a primeira execução
4. ✅ Monitorar por alguns dias
5. ✅ Ajustar schedules conforme necessidade
6. ✅ Migrar para produção (Docker)

---

## 📚 Recursos Adicionais

- [Documentação do node-cron](https://github.com/node-cron/node-cron)
- [Crontab Guru - Editor de schedules](https://crontab.guru/)
- [README Principal do Cron](./README.md)
- [Documentação da API de Pedidos](../../dashboard-galenica/README-orders-sync.md)

---

## 💡 Dicas

1. **Sempre teste manualmente antes de agendar**
2. **Monitore os logs nas primeiras execuções**
3. **Ajuste os horários de acordo com seu pico de vendas**
4. **Use o JOB2 para capturar pedidos rapidamente**
5. **Use o JOB1 para garantir consistência dos dados**

---

**Desenvolvido para Galenica** 🏥
