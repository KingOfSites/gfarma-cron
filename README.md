# Galenica Cron - Sistema de Sincronização Automática

Sistema de agendamento de tarefas (cron jobs) para sincronização automática de pedidos do Magento com o banco de dados.

## 📋 Funcionalidades

- ✅ Sincronização automática de pedidos dos últimos 3 dias
- ✅ Configuração flexível via variáveis de ambiente
- ✅ Suporte a múltiplos jobs simultâneos
- ✅ Timeout configurável para requisições
- ✅ Timezone customizável
- ✅ Logs detalhados de execução

## 🚀 Como Usar

### 1. Configuração Inicial

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp .env.example .env
```

### 2. Configure o Dashboard URL

Edite o arquivo `.env` e ajuste a URL do seu dashboard na linha do JOB1:

```env
# Trocar localhost:3001 pela URL do seu dashboard se necessário
JOB1=0 8-18/2 * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days
```

### 3. Instalar Dependências

```bash
npm install
```

### 4. Executar

**Modo Desenvolvimento (com auto-reload):**
```bash
npm run dev
```

**Modo Produção:**
```bash
npm run build
npm start
```

## 📅 Configuração de Schedule (Cron)

O formato do cron é: `minuto hora dia mês dia-da-semana`

### Exemplos Práticos:

| Schedule | Descrição |
|----------|-----------|
| `*/5 * * * *` | A cada 5 minutos |
| `0 */2 * * *` | A cada 2 horas |
| `0 8-18/2 * * *` | A cada 2 horas das 8h às 18h |
| `*/30 10-16 * * *` | A cada 30 min das 10h às 16h |
| `0 0 * * *` | Todo dia à meia-noite |
| `0 9 * * 1-5` | Às 9h de segunda a sexta |

## 🔧 Jobs Disponíveis

### JOB1: Sincronização de Pedidos (3 dias)

Sincroniza pedidos dos últimos 3 dias automaticamente.

**Configuração padrão:**
- **Schedule:** `0 8-18/2 * * *` (a cada 2 horas das 8h às 18h)
- **Endpoint:** `/api/magento/orders/sync-3-days`
- **Método:** POST

### Como Adicionar Mais Jobs

Adicione novas linhas no `.env`:

```env
# Job personalizado - sincronizar pedidos a cada 30 minutos
JOB2=*/30 * * * *::POST::http://localhost:3001/api/magento/orders/sync-3-days

# Job diário - sincronizar última semana à meia-noite
JOB3=0 0 * * *::POST::http://localhost:3001/api/magento/orders/sync-7-days
```

## 🎯 Endpoints do Dashboard

Os seguintes endpoints devem estar disponíveis no dashboard-galenica:

- `POST /api/magento/orders/sync-3-days` - Sincroniza pedidos dos últimos 3 dias
- `POST /api/magento/orders/sync-7-days` - Sincroniza pedidos dos últimos 7 dias (opcional)

## ⚙️ Variáveis de Ambiente

### Configurações Globais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TIMEZONE` | Timezone IANA (ex: America/Sao_Paulo) | `UTC` |
| `RUN_ON_START` | Executar jobs ao iniciar? (true/false) | `false` |
| `REQUEST_TIMEOUT` | Timeout em ms (0 = sem timeout) | `60000` |

### Configuração de Jobs

Formato: `SCHEDULE::METHOD::URL::prop1=value1::prop2=value2`

**Componentes:**
1. **SCHEDULE**: Expressão cron (5 partes)
2. **METHOD**: HTTP method (GET, POST, PUT, DELETE, PATCH)
3. **URL**: URL completa do endpoint
4. **props** (opcional): Parâmetros adicionais no formato `key=value`

## 📊 Monitoramento

O cron exibe logs detalhados:

```
✅ Process for job 1 completed
Made POST request to: http://localhost:3001/api/magento/orders/sync-3-days
Response status: 200
Completed at: 2026-01-12 14:00
```

## 🐳 Deploy com Docker

Um Dockerfile está incluído para facilitar o deploy:

```bash
# Build
docker build -t galenica-cron .

# Run
docker run -d --name galenica-cron --env-file .env galenica-cron
```

## 🛠️ Desenvolvimento

### Scripts Disponíveis

```bash
npm run dev          # Modo desenvolvimento com watch
npm run build        # Build do TypeScript
npm start            # Executar versão compilada
npm run lint         # Verificar código
npm run lint:fix     # Corrigir problemas de lint
npm run typecheck    # Verificar tipos TypeScript
```

### Estrutura do Projeto

```
cron-env/
├── src/
│   ├── index.ts           # Entry point principal
│   ├── run.ts             # Utilitário de execução
│   └── lib/
│       ├── env.ts         # Parser de variáveis de ambiente
│       ├── types.ts       # Definições de tipos
│       ├── utils.ts       # Funções utilitárias
│       └── constants.ts   # Constantes
├── .env.example           # Template de configuração
├── package.json
└── README.md
```

## 📝 Notas Importantes

1. **Sempre configure o TIMEZONE correto** para garantir que os jobs rodem nos horários esperados
2. **Use REQUEST_TIMEOUT** adequado - sincronizações grandes podem demorar
3. **Monitore os logs** para identificar problemas de sincronização
4. **Evite sobrecarga** - não configure jobs muito frequentes
5. **Teste primeiro** com `RUN_ON_START=true` antes de colocar em produção

## 🔍 Troubleshooting

### Job não está executando

1. Verifique se o formato do cron está correto
2. Confirme o timezone configurado
3. Verifique se o dashboard está acessível

### Timeout de requisição

1. Aumente o `REQUEST_TIMEOUT` no `.env`
2. Verifique a performance do dashboard
3. Considere reduzir o `batchSize` no endpoint

### Dashboard não responde

1. Confirme que o dashboard está rodando
2. Verifique a URL configurada no job
3. Teste manualmente com curl:
   ```bash
   curl -X POST http://localhost:3001/api/magento/orders/sync-3-days
   ```

## 📄 Licença

MIT
