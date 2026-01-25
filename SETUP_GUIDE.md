# 🎯 Guia de Setup - Sincronização Automática de Pedidos

Este guia mostra exatamente o que você precisa fazer para ter a sincronização funcionando.

---

## 📋 Checklist de Setup

- [ ] Dashboard Galenica rodando
- [ ] Configurar arquivo `.env`
- [ ] Instalar dependências
- [ ] Testar endpoints manualmente
- [ ] Iniciar o cron
- [ ] Verificar primeira execução

---

## 🚀 Passo a Passo

### 1️⃣ Certifique-se que o Dashboard está rodando

```bash
# Ir para o dashboard
cd ../../dashboard-galenica

# Iniciar o dashboard (se não estiver rodando)
npm run dev
```

Aguarde até ver:
```
✓ Ready in X.XXs
○ Local: http://localhost:3001
```

### 2️⃣ Configurar o Cron

Volte para o diretório do cron:

```bash
cd ../galenica-cron/cron-env
```

Copie o arquivo de exemplo:

```bash
cp env.example .env
```

### 3️⃣ Editar Configurações

Abra o arquivo `.env` e configure:

```env
# ===================================
# CONFIGURAÇÕES GERAIS
# ===================================
TIMEZONE=America/Sao_Paulo
RUN_ON_START=false
REQUEST_TIMEOUT=300000

# ===================================
# JOBS DE SINCRONIZAÇÃO
# ===================================

# JOB 1: Sincronização dos Últimos 3 Dias (às 5h e ao meio-dia)
JOB1=0 5,12 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# JOB 2: Sincronização dos Últimos 50 Pedidos (a cada hora, exceto 5h e meio-dia)
JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *::POST::http://localhost:3001/api/magento/orders/sync-last-50
```

**⚠️ IMPORTANTE:** Se seu dashboard está em outra URL, altere `http://localhost:3001` para a URL correta!

### 4️⃣ Instalar Dependências

```bash
npm install
```

### 5️⃣ Testar Endpoints Manualmente

Antes de iniciar o cron, teste os endpoints manualmente:

```bash
# Testar endpoint de 3 dias
curl -X POST http://localhost:3001/api/magento/orders/sync-3-days

# Testar endpoint dos últimos 50
curl -X POST http://localhost:3001/api/magento/orders/sync-last-50
```

Você deve ver uma resposta JSON com `"success": true`.

### 6️⃣ Testar Conexão

Use o script de teste:

```bash
npm run test:connection
```

Resultado esperado:
```
✅ Dashboard respondendo!
✅ Tudo pronto para iniciar o cron!
```

### 7️⃣ Iniciar o Cron

#### Para desenvolvimento (com logs visíveis):

```bash
npm run dev
```

Você verá algo assim:

```
Using timezone: America/Sao_Paulo
Using request timeout: 300000ms
Found 2 jobs to schedule.

Job 1:
  Schedule "0 5,12 * * *"
  POST "http://localhost:3001/api/magento/orders/sync-3-days"
Job 2:
  Schedule "0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *"
  POST "http://localhost:3001/api/magento/orders/sync-last-50"

Scheduling Job 1 with cron: 0 5,12 * * *
Scheduling Job 2 with cron: 0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *

All jobs scheduled successfully. Waiting for cron schedules to trigger...
```

#### Para testar imediatamente (sem esperar o horário):

Edite o `.env` e mude:

```env
RUN_ON_START=true
```

Depois inicie:

```bash
npm run dev
```

Os jobs vão executar imediatamente ao iniciar!

### 8️⃣ Verificar Primeira Execução

Quando um job executar, você verá logs como:

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
...
```

---

## 🎨 Entendendo os Schedules

### JOB1: `0 5,12 * * *`

```
0    5,12   *    *    *
│     │     │    │    │
│     │     │    │    └─── dia da semana (0-6, domingo = 0)
│     │     │    └──────── mês (1-12)
│     │     └───────────── dia do mês (1-31)
│     └─────────────────── hora (0-23)
└───────────────────────── minuto (0-59)

Tradução: "No minuto 0 das horas 5 e 12, todos os dias"
Resultado: Às 5:00 AM e às 12:00 PM todos os dias
```

### JOB2: `0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *`

```
Tradução: "No minuto 0 de todas as horas EXCETO 5 e 12"
Resultado: Todo início de hora, menos às 5h e meio-dia
```

---

## 📊 Cronograma de Execução

Aqui está um exemplo de como os jobs vão executar em um dia típico:

| Horário | Job Executado | O que faz |
|---------|---------------|-----------|
| 00:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 01:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 02:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 03:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 04:00 | JOB2 | Sincroniza últimos 50 pedidos |
| **05:00** | **JOB1** | **Sincroniza últimos 3 dias (COMPLETO)** |
| 06:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 07:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 08:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 09:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 10:00 | JOB2 | Sincroniza últimos 50 pedidos |
| 11:00 | JOB2 | Sincroniza últimos 50 pedidos |
| **12:00** | **JOB1** | **Sincroniza últimos 3 dias (COMPLETO)** |
| 13:00 | JOB2 | Sincroniza últimos 50 pedidos |
| ... | ... | ... |
| 23:00 | JOB2 | Sincroniza últimos 50 pedidos |

**Total:** 2 sincronizações completas + 22 sincronizações rápidas por dia!

---

## 🔍 Monitoramento

### Ver lista de jobs agendados:

```bash
npm run get
```

### Parar o cron:

```bash
# Se estiver rodando com npm run dev:
Ctrl + C

# Se estiver rodando em background:
pkill -f "tsx.*index.ts"

# Se estiver usando Docker:
docker stop galenica-cron
```

### Ver logs em tempo real (Docker):

```bash
docker logs -f galenica-cron
```

---

## 🎯 Próximos Passos

Agora que o sistema está funcionando:

1. ✅ **Monitore** os logs das primeiras execuções
2. ✅ **Verifique** no dashboard se os pedidos estão sendo sincronizados
3. ✅ **Ajuste** os horários conforme sua necessidade
4. ✅ **Documente** qualquer configuração específica do seu ambiente

---

## 🆘 Problemas Comuns

### Cron não executa no horário esperado

**Problema:** Configurei para rodar às 10h mas não executou

**Solução:**
1. Verifique o timezone no `.env`
2. Confirme o schedule (use https://crontab.guru/)
3. Verifique se o cron está rodando

### Erro 404 ao chamar endpoint

**Problema:** `Error: 404 Not Found`

**Solução:**
1. Verifique se o dashboard está rodando
2. Teste o endpoint manualmente com curl
3. Verifique a URL no `.env`

### Timeout nas sincronizações

**Problema:** `Request timed out after 300000ms`

**Solução:**
1. Aumente o timeout no `.env`:
   ```env
   REQUEST_TIMEOUT=600000
   ```
2. Verifique se o Magento está respondendo lentamente

### Jobs executando simultaneamente

**Problema:** JOB1 e JOB2 executam ao mesmo tempo

**Solução:**
1. Verifique o schedule do JOB2 - deve excluir os horários do JOB1
2. Exemplo correto:
   ```env
   JOB1=0 5,12 * * *::POST::...
   JOB2=0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *::POST::...
   ```

---

## 📚 Recursos

- [README_ORDERS_SYNC.md](./README_ORDERS_SYNC.md) - Documentação completa
- [Crontab Guru](https://crontab.guru/) - Editor de schedules online
- [README.md](./README.md) - Documentação do cron

---

**Setup completo! 🎉** Seu sistema de sincronização automática está pronto para uso!
