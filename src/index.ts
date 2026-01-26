import * as cron from 'node-cron';
import { env } from './lib/env';
import { formatDate } from './lib/utils';
import { sync3Days, syncLast50 } from './lib/magento-sync';

// Log timezone configuration
if (env.timezone) {
  console.log(`Using timezone: ${env.timezone}`);
}

console.log('\n🚀 GALENICA CRON - Sistema de Sincronização Independente');
console.log('='.repeat(60));
console.log('Conecta diretamente no Magento e PostgreSQL');
console.log('Sem dependência do dashboard!');
console.log('='.repeat(60) + '\n');

// Função para executar JOB1 (sync 3 dias)
async function performJob1() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Iniciando JOB1 - ${formatDate(new Date(), 'YYYY-MM-DD HH:MM')}`);
    console.log('Sincronização dos últimos 3 dias');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();
    const result = await sync3Days();
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ JOB1 FINALIZADO`);
    console.log('='.repeat(60));
    console.log(`⏱️  Tempo de execução: ${elapsedTime}s`);
    console.log(`🕐 Completado em: ${formatDate(new Date(), 'YYYY-MM-DD HH:MM')}`);

    if (result.summary) {
      console.log('\n📈 RESUMO DA SINCRONIZAÇÃO:');
      console.log(`   • Total de pedidos: ${result.summary.totalOrders || 0}`);
      console.log(`   • Novos pedidos: ${result.summary.newOrders || 0}`);
      console.log(`   • Pedidos atualizados: ${result.summary.updatedOrders || 0}`);
      console.log(`   • Mudanças de status: ${result.summary.statusChanges || 0}`);
      console.log(`   • Detalhes buscados: ${result.summary.detailsFetched || 0}`);
      console.log(`   • Erros: ${result.summary.errorCount || 0}`);
    }

    console.log('='.repeat(60) + '\n');
  } catch (error: unknown) {
    console.error(`\n❌ Erro durante JOB1:`, error);
    console.log('');
  }
}

// Função para executar JOB2 (sync últimos 50)
async function performJob2() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Iniciando JOB2 - ${formatDate(new Date(), 'YYYY-MM-DD HH:MM')}`);
    console.log('Sincronização dos últimos 50 pedidos');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();
    const result = await syncLast50();
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ JOB2 FINALIZADO`);
    console.log('='.repeat(60));
    console.log(`⏱️  Tempo de execução: ${elapsedTime}s`);
    console.log(`🕐 Completado em: ${formatDate(new Date(), 'YYYY-MM-DD HH:MM')}`);

    if (result.summary) {
      console.log('\n📈 RESUMO DA SINCRONIZAÇÃO:');
      console.log(`   • Total de pedidos: ${result.summary.totalOrders || 0}`);
      console.log(`   • Novos pedidos: ${result.summary.newOrders || 0}`);
      console.log(`   • Pedidos atualizados: ${result.summary.updatedOrders || 0}`);
      console.log(`   • Mudanças de status: ${result.summary.statusChanges || 0}`);
      console.log(`   • Detalhes buscados: ${result.summary.detailsFetched || 0}`);
      console.log(`   • Erros: ${result.summary.errorCount || 0}`);
    }

    console.log('='.repeat(60) + '\n');
  } catch (error: unknown) {
    console.error(`\n❌ Erro durante JOB2:`, error);
    console.log('');
  }
}

// Configuração dos jobs
const JOB1_SCHEDULE = '0 5,12 * * *'; // 5h e meio-dia
const JOB2_SCHEDULE = '0 0,1,2,3,4,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23 * * *'; // Toda hora exceto 5h e meio-dia

console.log('📅 Configuração dos Jobs:');
console.log(`   JOB1: ${JOB1_SCHEDULE} - Sincroniza últimos 3 dias (5h e meio-dia)`);
console.log(`   JOB2: ${JOB2_SCHEDULE} - Sincroniza últimos 50 pedidos (toda hora)`);
console.log('');

// Validar schedules
if (!cron.validate(JOB1_SCHEDULE)) {
  console.error(`❌ Schedule inválido para JOB1: ${JOB1_SCHEDULE}`);
  process.exit(1);
}

if (!cron.validate(JOB2_SCHEDULE)) {
  console.error(`❌ Schedule inválido para JOB2: ${JOB2_SCHEDULE}`);
  process.exit(1);
}

// Agendar JOB1 (sync 3 dias)
console.log(`✅ Agendando JOB1...`);
cron.schedule(
  JOB1_SCHEDULE,
  () => {
    performJob1().catch((error) => {
      console.error('Falha ao executar JOB1:', error);
    });
  },
  {
    scheduled: true,
    timezone: env.timezone,
  }
);

// Agendar JOB2 (sync últimos 50)
console.log(`✅ Agendando JOB2...`);
cron.schedule(
  JOB2_SCHEDULE,
  () => {
    performJob2().catch((error) => {
      console.error('Falha ao executar JOB2:', error);
    });
  },
  {
    scheduled: true,
    timezone: env.timezone,
  }
);

// Executar na inicialização se configurado
if (env.runOnStart) {
  console.log('\n🏁 RUN_ON_START=true - Executando jobs imediatamente...\n');

  performJob2()
    .then(() => {
      console.log('✅ JOB1 inicial concluído');
      return new Promise((r) => setTimeout(r, 5000)); // Aguardar 5s entre jobs
    })
    .then(() => performJob2())
    .then(() => {
      console.log('✅ JOB2 inicial concluído');
    })
    .catch((error) => {
      console.error('❌ Erro ao executar jobs iniciais:', error);
    });
}

console.log('\n✅ Todos os jobs agendados com sucesso!');
console.log('⏳ Aguardando horários programados...\n');
console.log('💡 Dica: Use Ctrl+C para parar o cron\n');
