#!/bin/bash

# Script para testar a conexão com o dashboard antes de iniciar o cron

echo "🧪 Testando conexão com o Dashboard Galenica..."
echo "================================================"
echo ""

# Carregar variáveis do .env
if [ -f .env ]; then
    source .env
    echo "✅ Arquivo .env encontrado"
else
    echo "❌ Arquivo .env não encontrado!"
    echo "   Execute: cp env.example .env"
    exit 1
fi

# Extrair URL do JOB1
if [ -z "$JOB1" ]; then
    echo "❌ JOB1 não configurado no .env!"
    exit 1
fi

# Extrair a URL do formato SCHEDULE::METHOD::URL
URL=$(echo $JOB1 | cut -d':' -f3- | cut -d':' -f1)
echo "🔗 URL do Dashboard: $URL"
echo ""

# Testar endpoint GET (info)
echo "📡 Testando endpoint (GET)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Erro ao conectar com o dashboard"
    echo "   Verifique se o dashboard está rodando em: $URL"
    echo ""
    echo "💡 Dica: Na pasta dashboard-galenica, execute:"
    echo "   npm run dev"
    exit 1
fi

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Dashboard respondendo! (HTTP $HTTP_CODE)"
    echo ""
    
    # Buscar informações do endpoint
    echo "📋 Informações do endpoint:"
    curl -s "${URL}" | grep -E '(description|period|method)' | head -5
    echo ""
    
    # Testar POST (sincronização real)
    echo "🔄 Deseja testar uma sincronização real agora? (s/N)"
    read -r response
    
    if [[ "$response" =~ ^([sS][iI][mM]|[sS])$ ]]; then
        echo ""
        echo "🚀 Iniciando teste de sincronização..."
        echo "   (Isso pode demorar alguns minutos)"
        echo ""
        
        START_TIME=$(date +%s)
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${URL}")
        HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
        BODY=$(echo "$RESPONSE" | sed '$d')
        END_TIME=$(date +%s)
        ELAPSED=$((END_TIME - START_TIME))
        
        echo ""
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "✅ Sincronização concluída com sucesso! (${ELAPSED}s)"
            echo ""
            echo "📊 Resultado:"
            echo "$BODY" | grep -E '(success|message|ordersProcessed|executionTime)' | head -10
        else
            echo "❌ Erro na sincronização (HTTP $HTTP_CODE)"
            echo "$BODY"
        fi
    else
        echo "⏭️  Teste de POST cancelado"
    fi
    
    echo ""
    echo "================================================"
    echo "✅ Tudo pronto para iniciar o cron!"
    echo ""
    echo "Execute:"
    echo "  npm run dev     # Modo desenvolvimento"
    echo "  npm run build && npm start  # Produção"
    echo ""
    
elif [ "$HTTP_CODE" -eq 404 ]; then
    echo "❌ Endpoint não encontrado (HTTP 404)"
    echo "   Verifique se o arquivo route.ts foi criado em:"
    echo "   dashboard-galenica/app/api/magento/orders/sync-3-days/"
    exit 1
else
    echo "⚠️  Dashboard respondeu com HTTP $HTTP_CODE"
    echo "   Verifique os logs do dashboard para mais detalhes"
    exit 1
fi
