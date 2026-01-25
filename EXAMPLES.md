# 📝 Exemplos de Configuração - Cron Jobs

Exemplos práticos de configuração para diferentes cenários.

## 🎯 Cenários Comuns

### 1. E-commerce Pequeno/Médio

**Características:**
- Poucos pedidos por dia (< 50)
- Horário comercial bem definido
- Não precisa de alta frequência

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=180000
RUN_ON_START=false

# Sincroniza 3x por dia
JOB1=0 9,14,18 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### 2. E-commerce Grande

**Características:**
- Muitos pedidos por dia (> 200)
- Vendas 24/7
- Necessita alta frequência

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=300000
RUN_ON_START=false

# Sincroniza a cada 2 horas durante o dia
JOB1=0 8-20/2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Sincronização completa à noite
JOB2=0 2 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

### 3. Alta Frequência (Horário de Pico)

**Características:**
- Muitas vendas em horários específicos
- Precisa de atualização quase em tempo real
- Horário de pico: 10h às 16h

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=300000
RUN_ON_START=false

# A cada 15 minutos no horário de pico
JOB1=*/15 10-16 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# A cada hora fora do pico
JOB2=0 8-9,17-20 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Sincronização completa à noite
JOB3=0 3 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

### 4. Apenas Dias Úteis

**Características:**
- Sem operação fim de semana
- Economia de recursos

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=180000
RUN_ON_START=false

# A cada 2 horas, segunda a sexta
JOB1=0 8-18/2 * * 1-5::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Sincronização segunda de manhã (dados do fim de semana)
JOB2=0 8 * * 1::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

### 5. Modo Econômico (Servidor Limitado)

**Características:**
- Recursos de servidor limitados
- Poucos pedidos
- Quer minimizar carga

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=120000
RUN_ON_START=false

# Apenas 2x por dia
JOB1=0 10,16 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### 6. Desenvolvimento/Teste

**Características:**
- Ambiente de testes
- Quer rodar imediatamente ao iniciar

**Configuração recomendada:**

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=180000
RUN_ON_START=true  # Roda ao iniciar!

# A cada 5 minutos (apenas para testes!)
JOB1=*/5 * * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

## 📅 Guia de Schedules Cron

### Formato

```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 7) (0 e 7 = domingo)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Exemplos Detalhados

#### Frequência Fixa

```env
# A cada minuto (não recomendado!)
*/1 * * * *

# A cada 5 minutos
*/5 * * * *

# A cada 15 minutos
*/15 * * * *

# A cada 30 minutos
*/30 * * * *

# A cada hora (no minuto 0)
0 * * * *

# A cada 2 horas
0 */2 * * *

# A cada 3 horas
0 */3 * * *

# A cada 6 horas
0 */6 * * *
```

#### Horários Específicos

```env
# Às 9h da manhã
0 9 * * *

# Às 9h e 18h
0 9,18 * * *

# Às 9h, 12h, 15h e 18h
0 9,12,15,18 * * *

# De hora em hora das 8h às 18h
0 8-18 * * *

# A cada 2 horas das 8h às 18h
0 8-18/2 * * *

# A cada 3 horas das 9h às 21h
0 9-21/3 * * *
```

#### Dias da Semana

```env
# Segunda a sexta às 9h
0 9 * * 1-5

# Apenas segunda às 9h
0 9 * * 1

# Apenas sábado e domingo às 10h
0 10 * * 0,6

# Todo dia às 8h, exceto fim de semana
0 8 * * 1-5
```

#### Dias do Mês

```env
# Primeiro dia de cada mês às 2h
0 2 1 * *

# Último dia do mês às 23h (aproximado - dia 28)
0 23 28 * *

# Dias 1 e 15 às 9h
0 9 1,15 * *

# Todo dia 10 às 14h
0 14 10 * *
```

#### Combinações Avançadas

```env
# A cada 30 min das 10h às 16h, segunda a sexta
*/30 10-16 * * 1-5

# Às 9h, 12h e 15h, apenas segunda a sexta
0 9,12,15 * * 1-5

# A cada 2 horas das 8h às 20h, todo dia
0 8-20/2 * * *

# Às 23h do último dia útil (sexta)
0 23 * * 5

# Todo primeiro dia útil do mês às 8h (segunda)
0 8 1-7 * 1
```

## 🎨 Templates Prontos

### Template: Loja Online Padrão

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=300000
RUN_ON_START=false

# Sincronização a cada 2 horas (horário comercial)
JOB1=0 8-20/2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Sincronização completa à noite
JOB2=0 2 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

### Template: Black Friday / Promoções

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=300000
RUN_ON_START=false

# Sincronização a cada 10 minutos!
JOB1=*/10 * * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### Template: Economia de Recursos

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=180000
RUN_ON_START=false

# Apenas 1x por dia
JOB1=0 9 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### Template: Desenvolvimento

```env
TIMEZONE=America/Sao_Paulo
REQUEST_TIMEOUT=120000
RUN_ON_START=true

# A cada 5 minutos (só para testes!)
JOB1=*/5 * * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

## 🔄 Migração de Configurações

### De Script Manual para Cron

Se você estava usando o script manual `pull-orders-range-advanced.ts`:

**Antes:**
```bash
# Rodar manualmente todo dia
npx tsx scripts/pull-orders-range-advanced.ts
```

**Depois:**
```env
# Roda automaticamente todo dia às 9h
JOB1=0 9 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### De Cron Linux para Node Cron

Se você tinha um crontab Linux:

**Antes (crontab):**
```cron
0 */2 * * * cd /path/to/project && npx tsx scripts/pull-orders-range-advanced.ts
```

**Depois (.env):**
```env
JOB1=0 */2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

## 🧪 Testes de Configuração

### Testar Imediatamente

```env
# Força execução ao iniciar
RUN_ON_START=true

# Schedule normal
JOB1=0 */2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

Inicie o cron e ele vai rodar imediatamente:
```bash
npm run dev
```

### Testar Frequência Alta

```env
# Testar a cada 2 minutos
RUN_ON_START=false
JOB1=*/2 * * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

Depois de validar, ajuste para frequência normal.

## 📊 Calculadora de Frequência

### Quantas vezes por dia?

```
Schedule                  | Vezes/dia | Total/mês
--------------------------|-----------|----------
*/5 * * * *              | 288       | ~8,640
*/15 * * * *             | 96        | ~2,880
*/30 * * * *             | 48        | ~1,440
0 * * * *                | 24        | ~720
0 */2 * * *              | 12        | ~360
0 */3 * * *              | 8         | ~240
0 */6 * * *              | 4         | ~120
0 8-20/2 * * *           | 7         | ~210
0 9,12,15,18 * * *       | 4         | ~120
0 9 * * *                | 1         | ~30
```

### Cálculo de Carga

```
Média de tempo por sincronização: 45 segundos
Vezes por dia: 12 (a cada 2 horas)

Tempo total de sincronização por dia:
12 × 45s = 540s = 9 minutos

Percentual do dia:
9min / 1440min = 0.625% do tempo
```

## 🎯 Recomendações por Volume

| Pedidos/dia | Frequência Recomendada | Schedule |
|-------------|------------------------|----------|
| < 10 | 1x por dia | `0 9 * * *` |
| 10-50 | 2-3x por dia | `0 9,15 * * *` |
| 50-100 | A cada 3-4 horas | `0 8-20/3 * * *` |
| 100-200 | A cada 2 horas | `0 8-20/2 * * *` |
| 200-500 | A cada hora | `0 8-20 * * *` |
| > 500 | A cada 30min | `*/30 8-20 * * *` |

## 💡 Dicas

1. **Comece conservador**: Use frequência baixa e aumente se necessário
2. **Evite horários de pico**: Não sincronize quando o Magento está sob carga alta
3. **Use sincronização noturna**: Job completo (7 dias) à noite
4. **Monitore logs**: Ajuste baseado em erros e performance
5. **Teste antes**: Use `RUN_ON_START=true` para validar

## 🚨 Anti-Patterns (Evite!)

```env
# ❌ A cada minuto - sobrecarga!
*/1 * * * *

# ❌ Múltiplos jobs no mesmo horário
JOB1=0 9 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
JOB2=0 9 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days

# ❌ Timeout muito baixo para muitos pedidos
REQUEST_TIMEOUT=10000  # Apenas 10 segundos!

# ❌ Sync 7 dias a cada 30 minutos - desnecessário!
*/30 * * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

## ✅ Best Practices

```env
# ✅ Frequência adequada
0 8-18/2 * * *

# ✅ Jobs em horários diferentes
JOB1=0 8-18/2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
JOB2=0 2 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days

# ✅ Timeout generoso
REQUEST_TIMEOUT=300000  # 5 minutos

# ✅ Sync 3 dias frequente, 7 dias ocasional
JOB1=0 */2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
JOB2=0 2 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

---

**Dúvidas?** Consulte o [README completo](./README.md) ou teste suas configurações!
