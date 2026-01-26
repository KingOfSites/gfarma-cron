/**
 * Módulo de Sincronização com Magento SOAP API
 * Conecta diretamente no Magento e salva no PostgreSQL via Prisma
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configurações do Magento
const MAGENTO_SOAP_URL = process.env.MAGENTO_API_URL || 'https://www.gfarma.com/api/v2_soap';
const MAGENTO_API_USER = process.env.MAGENTO_API_USER;
const MAGENTO_API_KEY = process.env.MAGENTO_API_KEY;
const LOOKBACK_HOURS = Math.max(1, Number(process.env.MAGENTO_LOOKBACK_HOURS || 24));
const WINDOW_HOURS = Math.max(1, Number(process.env.MAGENTO_WINDOW_HOURS || 6));

// Cookie de sessão
let MAGENTO_COOKIE: string | undefined;

/* ==================== TYPES ==================== */

export interface SalesOrderEntity {
  increment_id: string;
  parent_id?: string;
  store_id?: string;
  created_at: string;
  updated_at: string;
  is_active?: string;
  customer_id?: string;
  tax_amount?: string;
  shipping_amount?: string;
  discount_amount?: string;
  subtotal?: string;
  grand_total: string;
  total_paid?: string;
  total_refunded?: string;
  total_qty_ordered?: string;
  total_canceled?: string;
  total_invoiced?: string;
  total_online_refunded?: string;
  total_offline_refunded?: string;
  base_tax_amount?: string;
  base_shipping_amount?: string;
  base_discount_amount?: string;
  base_subtotal?: string;
  base_grand_total?: string;
  base_total_paid?: string;
  base_total_refunded?: string;
  base_total_qty_ordered?: string;
  base_total_canceled?: string;
  base_total_invoiced?: string;
  base_total_online_refunded?: string;
  base_total_offline_refunded?: string;
  billing_address_id?: string;
  billing_firstname?: string;
  billing_lastname?: string;
  shipping_address_id?: string;
  shipping_firstname?: string;
  shipping_lastname?: string;
  billing_name?: string;
  shipping_name?: string;
  store_to_base_rate?: string;
  store_to_order_rate?: string;
  base_to_global_rate?: string;
  base_to_order_rate?: string;
  weight?: string;
  store_name?: string;
  remote_ip?: string;
  status: string;
  state?: string;
  applied_rule_ids?: string;
  global_currency_code?: string;
  base_currency_code?: string;
  store_currency_code?: string;
  order_currency_code?: string;
  shipping_method?: string;
  shipping_description?: string;
  customer_email: string;
  customer_firstname: string;
  customer_lastname: string;
  quote_id?: string;
  is_virtual?: string;
  customer_group_id?: string;
  customer_note_notify?: string;
  customer_is_guest?: string;
  email_sent?: string;
  order_id?: string;
  gift_message_id?: string;
  gift_message?: string;
}

export interface OrderDetailInfo extends SalesOrderEntity {
  billing_city?: string;
  billing_country_id?: string;
  billing_postcode?: string;
  billing_region?: string;
  billing_street?: string;
  billing_telephone?: string;
  shipping_city?: string;
  shipping_country_id?: string;
  shipping_postcode?: string;
  shipping_region?: string;
  shipping_street?: string;
  shipping_telephone?: string;
  items?: OrderItemInfo[];
}

export interface OrderItemInfo {
  item_id?: string;
  product_id?: string;
  sku?: string;
  name: string;
  description?: string;
  weight?: string;
  qty?: string;
  price: string;
  base_price?: string;
  original_price?: string;
  tax_amount?: string;
  tax_percent?: string;
  discount_amount?: string;
  discount_percent?: string;
  row_total?: string;
  base_row_total?: string;
  product_type?: string;
  qty_ordered?: string;
  qty_shipped?: string;
  qty_invoiced?: string;
  qty_canceled?: string;
  qty_refunded?: string;
}

export interface SyncFilters {
  updated_at?: { from: string; to: string };
  created_at?: { from: string; to: string };
  [key: string]: any;
}

export interface SyncResult {
  success: boolean;
  ordersProcessed: number;
  ordersCreated: number;
  ordersUpdated: number;
  statusChanged: number;
  detailsFetched: number;
  errors: string[];
  summary: {
    totalOrders: number;
    processedOrders: number;
    newOrders: number;
    updatedOrders: number;
    statusChanges: number;
    detailsFetched: number;
    errorCount: number;
  };
}

/* ==================== UTILS ==================== */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function fmt(dt: Date): string {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`;
}

function addHours(d: Date, hours: number): Date {
  const x = new Date(d);
  x.setTime(x.getTime() + hours * 60 * 60 * 1000);
  return x;
}

function escapeXml(v: any): string {
  const s = String(v ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractFault(xml: string): string | null {
  const m = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
  if (m) return m[1].trim();
  const m2 = xml.match(/<message[^>]*>([\s\S]*?)<\/message>/i);
  return m2 ? m2[1].trim() : null;
}

function normalizeFilters(raw: any): {
  simple: Record<string, any>;
  range: { field: 'updated_at' | 'created_at'; from: string; to: string };
} {
  const simple: Record<string, any> = {};
  let field: 'updated_at' | 'created_at' = 'updated_at';
  let fromStr: string | undefined;
  let toStr: string | undefined;

  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if ((k === 'updated_at' || k === 'created_at') && v && typeof v === 'object') {
        field = k as any;
        if ((v as any).from) fromStr = String((v as any).from);
        if ((v as any).to) toStr = String((v as any).to);
      } else {
        simple[k] = v;
      }
    }
  }

  const now = new Date();
  const toDate = toStr ? new Date(toStr) : now;
  const fromDate = fromStr ? new Date(fromStr) : addHours(now, -LOOKBACK_HOURS);

  const fromOk = isNaN(fromDate.getTime()) ? addHours(now, -LOOKBACK_HOURS) : fromDate;
  const toOk = isNaN(toDate.getTime()) ? now : toDate;
  const finalFrom = fromOk > toOk ? addHours(toOk, -LOOKBACK_HOURS) : fromOk;

  return {
    simple,
    range: { field, from: fmt(finalFrom), to: fmt(toOk) },
  };
}

function buildMagentoFiltersXml(
  simple: Record<string, any>,
  range: { field: string; from?: string; to?: string }
): string {
  const items: string[] = [];

  for (const [k, v] of Object.entries(simple)) {
    if (v !== undefined && v !== null && v !== '') {
      items.push(`<item>
          <key>${k}</key>
          <value>
            <key>eq</key>
            <value>${escapeXml(v)}</value>
          </value>
        </item>`);
    }
  }

  if (range.from) {
    items.push(`<item>
        <key>${range.field}</key>
        <value>
          <key>from</key>
          <value>${escapeXml(range.from)}</value>
        </value>
      </item>`);
  }
  if (range.to) {
    items.push(`<item>
        <key>${range.field}</key>
        <value>
          <key>to</key>
          <value>${escapeXml(range.to)}</value>
        </value>
      </item>`);
  }

  if (!items.length) return '<filters/>';
  return `<filters><complex_filter>${items.join('')}</complex_filter></filters>`;
}

function mapOrderStatus(status: string): any {
  const statusMap: Record<string, string> = {
    pending: 'PENDING',
    pending_payment: 'PENDING',
    processing: 'PROCESSING',
    shipped: 'SHIPPED',
    complete: 'COMPLETE',
    canceled: 'CANCELED',
    cancelled: 'CANCELED',
    closed: 'CLOSED',
    refunded: 'REFUNDED',
    holded: 'HOLDED',
    payment_review: 'PAYMENT_REVIEW',
    em_producao: 'EM_PRODUCAO',
  };

  const normalized = status?.toLowerCase?.() || '';
  return statusMap[normalized] || status.toUpperCase();
}

/* ==================== SOAP CALLS ==================== */

async function getMagentoSession(): Promise<string> {
  const loginSoapXml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <login xmlns="urn:Magento">
      <username>${MAGENTO_API_USER}</username>
      <apiKey>${MAGENTO_API_KEY}</apiKey>
    </login>
  </soap:Body>
</soap:Envelope>`;

  const resp = await fetch(MAGENTO_SOAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: 'urn:login',
      'User-Agent': 'galenica-cron/1.0',
      Accept: 'text/xml',
    },
    body: loginSoapXml,
  });

  const body = await resp.text();
  const setCookie = resp.headers.get('set-cookie') || '';
  const phpsessid = (setCookie.match(/PHPSESSID=[^;]+/i) || [])[0];
  if (phpsessid) MAGENTO_COOKIE = phpsessid;

  if (!resp.ok) {
    const fault = extractFault(body);
    throw new Error(`Login HTTP ${resp.status}${fault ? ` - ${fault}` : ''}`);
  }

  const m = body.match(/<loginReturn.*?>(.*?)<\/loginReturn>/);
  if (!m) throw new Error('Não foi possível extrair a sessão do Magento');
  return m[1];
}

async function getOrdersListWindowed(
  sessionId: string,
  rawFilters: any
): Promise<SalesOrderEntity[]> {
  const { simple, range } = normalizeFilters(rawFilters);

  if (!rawFilters?.created_at && !rawFilters?.updated_at) {
    console.log('⚠️ Sem filtro de data: buscando todos os pedidos!');
    const xmlFilters = buildMagentoFiltersXml(simple, { field: 'updated_at' });
    return getOrdersListOnce(sessionId, xmlFilters);
  }

  console.log('🗓️ Range efetivo:', range);

  const from = new Date(range.from);
  const to = new Date(range.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    console.warn('⚠️ Range inválido; retornando lista vazia.');
    return [];
  }

  const seen = new Set<string>();
  const out: SalesOrderEntity[] = [];

  let cursorStart = new Date(from);
  while (cursorStart <= to) {
    const cursorEndTs = Math.min(to.getTime(), cursorStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000 - 1);
    const cursorEnd = new Date(cursorEndTs);

    const sliceFrom = fmt(cursorStart);
    const sliceTo = fmt(cursorEnd);

    const xmlFilters = buildMagentoFiltersXml(simple, {
      field: range.field,
      from: sliceFrom,
      to: sliceTo,
    });

    const chunk = await getOrdersListOnce(sessionId, xmlFilters);

    for (const o of chunk) {
      if (!seen.has(o.increment_id)) {
        seen.add(o.increment_id);
        out.push(o);
      }
    }

    console.log(`🧩 Janela ${sliceFrom} → ${sliceTo}: ${chunk.length} pedidos`);
    cursorStart = new Date(cursorEndTs + 1);
  }

  return out;
}

async function getOrdersListOnce(sessionId: string, filtersXml: string): Promise<SalesOrderEntity[]> {
  const soapXml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <salesOrderList xmlns="urn:Magento">
      <sessionId>${sessionId}</sessionId>
      ${filtersXml || '<filters/>'}
    </salesOrderList>
  </soap:Body>
</soap:Envelope>`;

  const headers: Record<string, string> = {
    'Content-Type': 'text/xml; charset=utf-8',
    SOAPAction: 'urn:salesOrderList',
    'User-Agent': 'galenica-cron/1.0',
    Accept: 'text/xml',
  };
  if (MAGENTO_COOKIE) headers['Cookie'] = MAGENTO_COOKIE;

  const resp = await fetch(MAGENTO_SOAP_URL, {
    method: 'POST',
    headers,
    body: soapXml,
  });
  const xml = await resp.text();

  console.log('🧾 salesOrderList status:', resp.status);
  if (!resp.ok) {
    const fault = extractFault(xml);
    throw new Error(`Erro HTTP na busca de pedidos: ${resp.status}${fault ? ` - ${fault}` : ''}`);
  }
  const fault = extractFault(xml);
  if (fault) throw new Error(`SOAP Fault: ${fault}`);

  return parseOrdersXml(xml);
}

async function getOrderInfo(sessionId: string, incrementId: string): Promise<OrderDetailInfo> {
  const soapXml = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <salesOrderInfo xmlns="urn:Magento">
      <sessionId>${sessionId}</sessionId>
      <orderIncrementId>${incrementId}</orderIncrementId>
    </salesOrderInfo>
  </soap:Body>
</soap:Envelope>`;

  const headers: Record<string, string> = {
    'Content-Type': 'text/xml; charset=utf-8',
    SOAPAction: 'urn:salesOrderInfo',
    'User-Agent': 'galenica-cron/1.0',
    Accept: 'text/xml',
  };
  if (MAGENTO_COOKIE) headers['Cookie'] = MAGENTO_COOKIE;

  const resp = await fetch(MAGENTO_SOAP_URL, {
    method: 'POST',
    headers,
    body: soapXml,
  });
  const xml = await resp.text();

  if (!resp.ok) {
    const fault = extractFault(xml);
    throw new Error(`Erro HTTP na busca de detalhes: ${resp.status}${fault ? ` - ${fault}` : ''}`);
  }
  const fault = extractFault(xml);
  if (fault) throw new Error(`SOAP Fault: ${fault}`);

  const parsed = parseOrderInfoXml(xml);
  if (!parsed.increment_id) parsed.increment_id = incrementId;

  return parsed;
}

/* ==================== PARSERS ==================== */

function parseOrdersXml(xml: string): SalesOrderEntity[] {
  const orders: SalesOrderEntity[] = [];
  let itemMatches =
    xml.match(/<item[^>]*>[\s\S]*?<\/item>/g) ||
    xml.match(/<ns1:item[^>]*>[\s\S]*?<\/ns1:item>/g) ||
    xml.match(/<salesOrderEntity[^>]*>[\s\S]*?<\/salesOrderEntity>/g);

  if (!itemMatches) return orders;

  for (const itemXml of itemMatches) {
    const order: any = {};
    const fieldMatches = itemXml.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/g);
    if (fieldMatches) {
      for (const fm of fieldMatches) {
        const m = fm.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/);
        if (m) {
          const [, fieldName, fieldValue] = m;
          const clean = fieldName.replace(/^ns\d+:/, '');
          order[clean] = fieldValue || null;
        }
      }
    }
    if (order.increment_id) orders.push(order as SalesOrderEntity);
  }
  return orders;
}

function parseOrderInfoXml(xml: string): OrderDetailInfo {
  const order: any = {};

  const billingMatch = xml.match(/<billing_address[^>]*>([\s\S]*?)<\/billing_address>/);
  if (billingMatch) {
    Object.assign(order, parseOrderAddressXml(billingMatch[1], 'billing'));
    xml = xml.replace(billingMatch[0], '');
  }

  const shippingMatch = xml.match(/<shipping_address[^>]*>([\s\S]*?)<\/shipping_address>/);
  if (shippingMatch) {
    Object.assign(order, parseOrderAddressXml(shippingMatch[1], 'shipping'));
    xml = xml.replace(shippingMatch[0], '');
  }

  const fieldMatches = xml.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/g);
  if (fieldMatches) {
    for (const fm of fieldMatches) {
      const m = fm.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/);
      if (m) {
        const [, fieldName, fieldValueRaw] = m;
        const fieldValue: string = fieldValueRaw || '';
        if (fieldName.startsWith('billing_shipping_')) {
          const key = fieldName.replace('billing_shipping_', '');
          order[`shipping_${key}`] = fieldValue;
        } else {
          // ✅ FIX: Não sobrescrever campos importantes se já existirem
          // Campos críticos como status, state, increment_id devem ser mantidos (primeiro valor encontrado)
          const criticalFields = ['status', 'state', 'increment_id', 'order_id'];
          if (criticalFields.includes(fieldName) && order[fieldName]) {
            // Já existe, não sobrescrever
            continue;
          }
          order[fieldName] = fieldValue;
        }
        
      }
    }
  }

  const itemsMatches = xml.match(/<items[^>]*>([\s\S]*?)<\/items>/g);
  if (itemsMatches) {
    order.items = itemsMatches.flatMap((block) => parseOrderItemsXml(block));
  }

  if (!order.shipping_city && order.billing_city) {
    order.shipping_city = order.billing_city;
    order.shipping_street = order.billing_street;
    order.shipping_region = order.billing_region;
    order.shipping_postcode = order.billing_postcode;
    order.shipping_country_id = order.billing_country_id;
    order.shipping_telephone = order.billing_telephone;
  }

  return order as OrderDetailInfo;
}

function parseOrderAddressXml(addressXml: string, prefix: 'billing' | 'shipping') {
  const out: any = {};
  const fieldMatches = addressXml.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/g);
  if (fieldMatches) {
    for (const fm of fieldMatches) {
      const m = fm.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/);
      if (m) {
        const [, fieldName, fieldValue] = m;
        out[`${prefix}_${fieldName}`] = fieldValue || null;
      }
    }
  }
  return out;
}

function parseOrderItemsXml(itemsXml: string): OrderItemInfo[] {
  const items: OrderItemInfo[] = [];
  const itemMatches = itemsXml.match(/<item[^>]*>[\s\S]*?<\/item>/g);
  if (itemMatches) {
    for (const itemXml of itemMatches) {
      const item: any = {};
      const fieldMatches = itemXml.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/g);
      if (fieldMatches) {
        for (const fm of fieldMatches) {
          const m = fm.match(/<([^>\s\/]+)[^>]*>([^<]*)<\/\1>/);
          if (m) {
            const [, fieldName, fieldValue] = m;
            item[fieldName] = fieldValue || null;
          }
        }
      }
      if (item.name) items.push(item as OrderItemInfo);
    }
  }
  return items;
}

/* ==================== DATABASE ==================== */

async function ensureCustomer(order: SalesOrderEntity): Promise<string | null> {
  const cid = (order.customer_id || '').trim();
  const email = (order.customer_email || '').trim();
  const firstname = order.customer_firstname || '';
  const lastname = order.customer_lastname || '';

  if (!cid || !email) return null;

  const byId = await prisma.customer.findUnique({ where: { customerId: cid } }).catch(() => null);
  if (byId) {
    try {
      await prisma.customer.update({
        where: { customerId: cid },
        data: { email, firstname, lastname },
      });
    } catch {}
    return cid;
  }

  const byEmail = await prisma.customer.findUnique({ where: { email } }).catch(() => null);
  if (byEmail) {
    if (byEmail.customerId !== cid) return null;
    try {
      await prisma.customer.update({
        where: { email },
        data: { firstname, lastname },
      });
    } catch {}
    return cid;
  }

  try {
    await prisma.customer.create({
      data: {
        customerId: cid,
        email,
        firstname,
        lastname,
        createdAt: new Date(),
      },
    });
    return cid;
  } catch {
    return null;
  }
}

async function saveOrderToDatabase(order: SalesOrderEntity) {
  const safeCustomerId = await ensureCustomer(order);
  const customerEmail = order.customer_email || 'nao-informado@magento.com';
  const customerFirstname = order.customer_firstname || 'Não informado';
  const customerLastname = order.customer_lastname || '';

  const orderData = {
    incrementId: order.increment_id,
    orderId: (order as any).order_id || null,
    parentId: order.parent_id || null,
    storeId: order.store_id || null,
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
    isActive: order.is_active || null,
    customerId: safeCustomerId,
    taxAmount: order.tax_amount ? parseFloat(order.tax_amount) : null,
    shippingAmount: order.shipping_amount ? parseFloat(order.shipping_amount) : null,
    discountAmount: order.discount_amount ? parseFloat(order.discount_amount) : null,
    subtotal: order.subtotal ? parseFloat(order.subtotal) : null,
    grandTotal: parseFloat(order.grand_total),
    totalPaid: order.total_paid ? parseFloat(order.total_paid) : null,
    totalRefunded: order.total_refunded ? parseFloat(order.total_refunded) : null,
    totalQtyOrdered: order.total_qty_ordered ? parseInt(order.total_qty_ordered) : null,
    totalCanceled: order.total_canceled ? parseFloat(order.total_canceled) : null,
    totalInvoiced: order.total_invoiced ? parseFloat(order.total_invoiced) : null,
    totalOnlineRefunded: order.total_online_refunded ? parseFloat(order.total_online_refunded) : null,
    totalOfflineRefunded: order.total_offline_refunded ? parseFloat(order.total_offline_refunded) : null,
    baseTaxAmount: order.base_tax_amount ? parseFloat(order.base_tax_amount) : null,
    baseShippingAmount: order.base_shipping_amount ? parseFloat(order.base_shipping_amount) : null,
    baseDiscountAmount: order.base_discount_amount ? parseFloat(order.base_discount_amount) : null,
    baseSubtotal: order.base_subtotal ? parseFloat(order.base_subtotal) : null,
    baseGrandTotal: order.base_grand_total ? parseFloat(order.base_grand_total) : null,
    baseTotalPaid: order.base_total_paid ? parseFloat(order.base_total_paid) : null,
    baseTotalRefunded: order.base_total_refunded ? parseFloat(order.base_total_refunded) : null,
    baseTotalQtyOrdered: order.base_total_qty_ordered ? parseFloat(order.base_total_qty_ordered) : null,
    baseTotalCanceled: order.base_total_canceled ? parseFloat(order.base_total_canceled) : null,
    baseTotalInvoiced: order.base_total_invoiced ? parseFloat(order.base_total_invoiced) : null,
    baseTotalOnlineRefunded: order.base_total_online_refunded
      ? parseFloat(order.base_total_online_refunded)
      : null,
    baseTotalOfflineRefunded: order.base_total_offline_refunded
      ? parseFloat(order.base_total_offline_refunded)
      : null,
    billingAddressId: order.billing_address_id || null,
    billingFirstname: order.billing_firstname || null,
    billingLastname: order.billing_lastname || null,
    shippingAddressId: order.shipping_address_id || null,
    shippingFirstname: order.shipping_firstname || null,
    shippingLastname: order.shipping_lastname || null,
    billingName: order.billing_name || null,
    shippingName: order.shipping_name || null,
    storeToBaseRate: order.store_to_base_rate ? parseFloat(order.store_to_base_rate) : null,
    storeToOrderRate: order.store_to_order_rate ? parseFloat(order.store_to_order_rate) : null,
    baseToGlobalRate: order.base_to_global_rate ? parseFloat(order.base_to_global_rate) : null,
    baseToOrderRate: order.base_to_order_rate ? parseFloat(order.base_to_order_rate) : null,
    weight: order.weight ? parseFloat(order.weight) : null,
    storeName: order.store_name || null,
    remoteIp: order.remote_ip || null,
    status: mapOrderStatus(order.status),
    state: order.state || null,
    appliedRuleIds: order.applied_rule_ids || null,
    globalCurrencyCode: order.global_currency_code || null,
    baseCurrencyCode: order.base_currency_code || null,
    storeCurrencyCode: order.store_currency_code || null,
    orderCurrencyCode: order.order_currency_code || null,
    shippingMethod: order.shipping_method || null,
    shippingDescription: order.shipping_description || null,
    customerEmail,
    customerFirstname,
    customerLastname,
    quoteId: order.quote_id || null,
    isVirtual: order.is_virtual || null,
    customerGroupId: order.customer_group_id || null,
    customerNoteNotify: order.customer_note_notify || null,
    customerIsGuest: order.customer_is_guest || null,
    emailSent: order.email_sent || null,
    giftMessageId: order.gift_message_id || null,
    giftMessage: order.gift_message || null,
    syncedAt: new Date(),
  };

  await prisma.order.upsert({
    where: { incrementId: order.increment_id },
    update: orderData,
    create: orderData,
  });
}

async function saveOrderDetailsToDatabase(orderDetails: OrderDetailInfo) {
  const inc = orderDetails.increment_id?.trim();
  let keyIncrement: string | null = inc || null;

  if (!keyIncrement) {
    if (orderDetails.order_id && orderDetails.customer_email) {
      const found = await prisma.order.findFirst({
        where: {
          orderId: String(orderDetails.order_id),
          customerEmail: orderDetails.customer_email,
        },
        select: { incrementId: true },
      });
      if (found) keyIncrement = found.incrementId;
    }
    if (!keyIncrement) {
      console.warn('⚠️ Sem increment_id para atualizar detalhes; ignorando.');
      return false;
    }
  }

  const updateData: any = {
    billingCity: orderDetails.billing_city || null,
    billingCountryId: orderDetails.billing_country_id || null,
    billingPostcode: orderDetails.billing_postcode || null,
    billingRegion: orderDetails.billing_region || null,
    billingStreet: orderDetails.billing_street || null,
    billingTelephone: orderDetails.billing_telephone || null,
    shippingCity: orderDetails.shipping_city || null,
    shippingCountryId: orderDetails.shipping_country_id || null,
    shippingPostcode: orderDetails.shipping_postcode || null,
    shippingRegion: orderDetails.shipping_region || null,
    shippingStreet: orderDetails.shipping_street || null,
    shippingTelephone: orderDetails.shipping_telephone || null,
    detailsFetched: true,
    detailsFetchedAt: new Date(),
  };

  await prisma.order.update({
    where: { incrementId: keyIncrement },
    data: updateData,
  });

  if (orderDetails.items && orderDetails.items.length > 0) {
    for (const item of orderDetails.items) {
      const itemData = {
        orderId: keyIncrement,
        itemId: item.item_id || null,
        productId: item.product_id || null,
        sku: item.sku || null,
        name: item.name,
        description: item.description || null,
        weight: item.weight ? parseFloat(item.weight) : null,
        qty: parseFloat(item.qty || '0'),
        price: parseFloat(item.price),
        basePrice: item.base_price ? parseFloat(item.base_price) : null,
        originalPrice: item.original_price ? parseFloat(item.original_price) : null,
        taxAmount: item.tax_amount ? parseFloat(item.tax_amount) : null,
        taxPercent: item.tax_percent ? parseFloat(item.tax_percent) : null,
        discountAmount: item.discount_amount ? parseFloat(item.discount_amount) : null,
        discountPercent: item.discount_percent ? parseFloat(item.discount_percent) : null,
        rowTotal: item.row_total ? parseFloat(item.row_total) : null,
        baseRowTotal: item.base_row_total ? parseFloat(item.base_row_total) : null,
        productType: item.product_type || null,
        qtyOrdered: item.qty_ordered ? parseFloat(item.qty_ordered) : null,
        qtyShipped: item.qty_shipped ? parseFloat(item.qty_shipped) : null,
        qtyInvoiced: item.qty_invoiced ? parseFloat(item.qty_invoiced) : null,
        qtyCanceled: item.qty_canceled ? parseFloat(item.qty_canceled) : null,
        qtyRefunded: item.qty_refunded ? parseFloat(item.qty_refunded) : null,
      };

      await prisma.orderItem.upsert({
        where: {
          orderId_itemId: {
            orderId: keyIncrement,
            itemId: item.item_id || `${keyIncrement}-${item.sku || Math.random()}`,
          },
        },
        update: itemData,
        create: {
          ...itemData,
          itemId: item.item_id || `${keyIncrement}-${item.sku || Math.random()}`,
        },
      });
    }
  }

  return true;
}

/* ==================== MAIN SYNC FUNCTION ==================== */

export async function syncOrders(filters: SyncFilters, fetchDetails = true, batchSize = 50): Promise<SyncResult> {
  try {
    console.log('=== Iniciando sincronização de pedidos ===');
    console.log('Parâmetros:', { fetchDetails, filters, batchSize });

    if (!MAGENTO_API_USER || !MAGENTO_API_KEY) {
      throw new Error('Credenciais da API Magento não configuradas');
    }

    const sessionId = await getMagentoSession();
    console.log('✅ Sessão Magento obtida');

    const orders = await getOrdersListWindowed(sessionId, filters);
    console.log(`✅ ${orders.length} pedidos encontrados`);

    let ordersProcessed = 0;
    let ordersCreated = 0;
    let ordersUpdated = 0;
    let statusChanged = 0;
    let detailsFetched = 0;
    const errors: string[] = [];

    orders.sort((a, b) => {
      const idA = parseInt(a.increment_id) || 0;
      const idB = parseInt(b.increment_id) || 0;
      return idA - idB;
    });

    console.log(`📊 Processando ${orders.length} pedidos...\n`);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);

      for (const order of batch) {
        const orderIndex = i + batch.indexOf(order) + 1;
        const progress = ((orderIndex / orders.length) * 100).toFixed(1);

        try {
          const existingOrder = await prisma.order.findUnique({
            where: { incrementId: order.increment_id },
            select: { status: true, state: true, detailsFetched: true },
          });

          const isNew = !existingOrder;
          const previousStatus = existingOrder?.status;
          const previousState = existingOrder?.state;

          const missingEssentialData =
            !order.customer_email ||
            !order.customer_firstname ||
            order.customer_email === 'undefined' ||
            order.customer_firstname === 'undefined';

          if (missingEssentialData) {
            console.log(`   ⚠️  Faltam dados em ${order.increment_id}, buscando detalhes...`);
            try {
              const fullOrderDetails = await getOrderInfo(sessionId, order.increment_id);
              if (fullOrderDetails.customer_email) order.customer_email = fullOrderDetails.customer_email;
              if (fullOrderDetails.customer_firstname)
                order.customer_firstname = fullOrderDetails.customer_firstname;
              if (fullOrderDetails.customer_lastname) order.customer_lastname = fullOrderDetails.customer_lastname;
              console.log(`   ✅ Dados completos obtidos`);
            } catch (detailError: any) {
              console.log(`   ⚠️  Erro ao obter dados: ${detailError.message}`);
            }
          }

          await saveOrderToDatabase(order);
          ordersProcessed++;

          const currentStatus = mapOrderStatus(order.status);
          const currentState = order.state || null;
          const hasStatusChanged =
            existingOrder && (previousStatus !== currentStatus || previousState !== currentState);

          if (isNew) {
            ordersCreated++;
            console.log(`✅ [${progress}%] ${order.increment_id} - NOVO | Status: ${currentStatus}`);
          } else if (hasStatusChanged) {
            ordersUpdated++;
            statusChanged++;
            console.log(
              `🔄 [${progress}%] ${order.increment_id} - Status: ${previousStatus} → ${currentStatus}${previousState !== currentState ? ` | State: ${previousState} → ${currentState}` : ''}`
            );
          } else {
            ordersUpdated++;
            console.log(`⏭️  [${progress}%] ${order.increment_id} - Sem mudanças | Status: ${currentStatus}`);
          }

          if (fetchDetails) {
            try {
              const orderDetails = await getOrderInfo(sessionId, order.increment_id);
              const ok = await saveOrderDetailsToDatabase(orderDetails);
              if (ok) {
                detailsFetched++;
                if (!existingOrder?.detailsFetched) {
                  console.log(`   📋 Detalhes salvos`);
                }
              }
            } catch (detailError: any) {
              console.error(`   ❌ Erro ao buscar detalhes ${order.increment_id}:`, detailError.message);
              errors.push(`Detalhes ${order.increment_id}: ${detailError.message}`);
            }
          }
        } catch (orderError: any) {
          console.error(`❌ [${progress}%] Erro ${order.increment_id}:`, orderError.message);
          errors.push(`Pedido ${order.increment_id}: ${orderError.message}`);
        }
      }

      if (i + batchSize < orders.length) {
        const delay = batchSize === 1 ? 1000 : 1500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA SINCRONIZAÇÃO');
    console.log('='.repeat(50));
    console.log(`✅ Total processado: ${ordersProcessed}`);
    console.log(`   ➕ Novos pedidos: ${ordersCreated}`);
    console.log(`   🔄 Atualizados: ${ordersUpdated}`);
    console.log(`   📝 Mudanças de status: ${statusChanged}`);
    console.log(`   📋 Detalhes buscados: ${detailsFetched}`);
    console.log(`   ❌ Erros: ${errors.length}`);
    console.log('='.repeat(50) + '\n');

    return {
      success: true,
      ordersProcessed,
      ordersCreated,
      ordersUpdated,
      statusChanged,
      detailsFetched,
      errors,
      summary: {
        totalOrders: orders.length,
        processedOrders: ordersProcessed,
        newOrders: ordersCreated,
        updatedOrders: ordersUpdated,
        statusChanges: statusChanged,
        detailsFetched,
        errorCount: errors.length,
      },
    };
  } catch (error: any) {
    console.error('💥 Erro fatal na sincronização:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/* ==================== HELPER FUNCTIONS ==================== */

export async function sync3Days(): Promise<SyncResult> {
  try {
    console.log('=== Sincronizando últimos 3 dias (sequencial) ===');

    if (!MAGENTO_API_USER || !MAGENTO_API_KEY) {
      throw new Error('Credenciais da API Magento não configuradas');
    }

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Primeiro, buscar qual é o range de pedidos dos últimos 3 dias
    const sessionId = await getMagentoSession();
    console.log('✅ Sessão Magento obtida');

    // Buscar lista de pedidos dos últimos 3 dias para determinar o range
    const ordersList = await getOrdersListWindowed(sessionId, {
      updated_at: {
        from: fmt(threeDaysAgo),
        to: fmt(now),
      },
    });

    if (ordersList.length === 0) {
      console.log('📊 Nenhum pedido encontrado nos últimos 3 dias');
      return {
        success: true,
        ordersProcessed: 0,
        ordersCreated: 0,
        ordersUpdated: 0,
        statusChanged: 0,
        detailsFetched: 0,
        errors: [],
        summary: {
          totalOrders: 0,
          processedOrders: 0,
          newOrders: 0,
          updatedOrders: 0,
          statusChanges: 0,
          detailsFetched: 0,
          errorCount: 0,
        },
      };
    }

    // Determinar o range: menor e maior incrementId
    const incrementIds = ordersList.map((o) => parseInt(o.increment_id)).filter((id) => !isNaN(id));
    const minId = Math.min(...incrementIds);
    const maxId = Math.max(...incrementIds);

    console.log(`📊 Range de pedidos: ${minId} até ${maxId} (${maxId - minId + 1} pedidos)`);
    console.log(`🔢 Buscando sequencialmente...\n`);

    let ordersProcessed = 0;
    let ordersCreated = 0;
    let ordersUpdated = 0;
    let statusChanged = 0;
    let detailsFetched = 0;
    const errors: string[] = [];

    const totalOrders = maxId - minId + 1;

    // Buscar cada pedido sequencialmente
    for (let currentId = minId; currentId <= maxId; currentId++) {
      const currentIncrementId = currentId.toString();
      const progress = (((currentId - minId + 1) / totalOrders) * 100).toFixed(1);

      try {
        // Verificar se já existe no banco ANTES de buscar no Magento
        const existingOrder = await prisma.order.findUnique({
          where: { incrementId: currentIncrementId },
          select: { status: true, state: true, detailsFetched: true },
        });

        // Buscar pedido diretamente pelo incrementId
        let orderDetails: OrderDetailInfo;
        try {
          orderDetails = await getOrderInfo(sessionId, currentIncrementId);
        } catch (magentoError: any) {
          // Pedido não existe no Magento (foi deletado)
          if (magentoError.message.includes('does not exist') || magentoError.message.includes('não encontrado')) {
            // Se o pedido existe no banco, marcar como CANCELED
            if (existingOrder) {
              const previousStatus = existingOrder.status;
              await prisma.order.update({
                where: { incrementId: currentIncrementId },
                data: {
                  status: 'CANCELED',
                  state: 'canceled',
                  syncedAt: new Date(),
                },
              });
              console.log(`🗑️  [${progress}%] ${currentIncrementId} - Deletado no Magento | ${previousStatus} → CANCELED`);
              ordersUpdated++;
              if (previousStatus !== 'CANCELED') {
                statusChanged++;
              }
            } else {
              console.log(`⏭️  [${progress}%] ${currentIncrementId} - Não existe no Magento (nunca importado)`);
            }
            continue;
          }
          throw magentoError; // Re-throw se for outro tipo de erro
        }

        if (!orderDetails || !orderDetails.increment_id) {
          console.log(`⏭️  [${progress}%] ${currentIncrementId} - Resposta vazia do Magento`);
          continue;
        }

        const isNew = !existingOrder;
        const previousStatus = existingOrder?.status;
        const previousState = existingOrder?.state;

        // Salvar pedido básico
        await saveOrderToDatabase(orderDetails);
        ordersProcessed++;

        const currentStatus = mapOrderStatus(orderDetails.status);
        const currentState = orderDetails.state || null;
        const hasStatusChanged =
          existingOrder && (previousStatus !== currentStatus || previousState !== currentState);

        if (isNew) {
          ordersCreated++;
          console.log(`✅ [${progress}%] ${currentIncrementId} - NOVO | Status: ${currentStatus}`);
        } else if (hasStatusChanged) {
          ordersUpdated++;
          statusChanged++;
          console.log(
            `🔄 [${progress}%] ${currentIncrementId} - Status: ${previousStatus} → ${currentStatus}${previousState !== currentState ? ` | State: ${previousState} → ${currentState}` : ''}`
          );
        } else {
          ordersUpdated++;
          console.log(`⏭️  [${progress}%] ${currentIncrementId} - Sem mudanças | Status: ${currentStatus}`);
        }

        // Salvar detalhes completos
        const ok = await saveOrderDetailsToDatabase(orderDetails);
        if (ok) {
          detailsFetched++;
          if (!existingOrder?.detailsFetched) {
            console.log(`   📋 Detalhes salvos`);
          }
        }

        // Delay entre requisições (menor que JOB2 pois processa mais pedidos)
        await new Promise((r) => setTimeout(r, 300));
      } catch (error: any) {
        console.error(`❌ [${progress}%] ${currentIncrementId} - Erro:`, error.message);
        errors.push(`Pedido ${currentIncrementId}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA SINCRONIZAÇÃO DE 3 DIAS');
    console.log('='.repeat(50));
    console.log(`✅ Total processado: ${ordersProcessed}`);
    console.log(`   ➕ Novos pedidos: ${ordersCreated}`);
    console.log(`   🔄 Atualizados: ${ordersUpdated}`);
    console.log(`   📝 Mudanças de status: ${statusChanged}`);
    console.log(`   📋 Detalhes buscados: ${detailsFetched}`);
    console.log(`   ❌ Erros: ${errors.length}`);
    console.log('='.repeat(50) + '\n');

    return {
      success: true,
      ordersProcessed,
      ordersCreated,
      ordersUpdated,
      statusChanged,
      detailsFetched,
      errors,
      summary: {
        totalOrders,
        processedOrders: ordersProcessed,
        newOrders: ordersCreated,
        updatedOrders: ordersUpdated,
        statusChanges: statusChanged,
        detailsFetched,
        errorCount: errors.length,
      },
    };
  } catch (error: any) {
    console.error('💥 Erro fatal na sincronização de 3 dias:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function syncLast50(): Promise<SyncResult> {
  try {
    console.log('=== Sincronizando últimos 50 pedidos do Magento ===');

    if (!MAGENTO_API_USER || !MAGENTO_API_KEY) {
      throw new Error('Credenciais da API Magento não configuradas');
    }

    const sessionId = await getMagentoSession();
    console.log('✅ Sessão Magento obtida');

    // Buscar lista de pedidos das últimas 48h para determinar os últimos 50
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    console.log('📊 Buscando pedidos das últimas 48h do Magento para identificar os últimos 50...');
    const ordersList = await getOrdersListWindowed(sessionId, {
      updated_at: {
        from: fmt(twoDaysAgo),
        to: fmt(now),
      },
    });

    if (ordersList.length === 0) {
      console.log('📊 Nenhum pedido encontrado nas últimas 48h');
      return {
        success: true,
        ordersProcessed: 0,
        ordersCreated: 0,
        ordersUpdated: 0,
        statusChanged: 0,
        detailsFetched: 0,
        errors: [],
        summary: {
          totalOrders: 0,
          processedOrders: 0,
          newOrders: 0,
          updatedOrders: 0,
          statusChanges: 0,
          detailsFetched: 0,
          errorCount: 0,
        },
      };
    }

    // Ordenar por incrementId decrescente e pegar os últimos 50
    const sortedOrderIds = ordersList
      .map((o) => parseInt(o.increment_id))
      .filter((id) => !isNaN(id))
      .sort((a, b) => b - a) // Decrescente (maior primeiro)
      .slice(0, 50); // Pegar apenas os 50 maiores

    const maxId = sortedOrderIds[0];
    const minId = sortedOrderIds[sortedOrderIds.length - 1];

    console.log(`📊 Últimos 50 pedidos do Magento: ${minId} até ${maxId}`);
    console.log(`🔢 Total a sincronizar: ${sortedOrderIds.length} pedidos\n`);

    let ordersProcessed = 0;
    let ordersCreated = 0;
    let ordersUpdated = 0;
    let statusChanged = 0;
    let detailsFetched = 0;
    const errors: string[] = [];

    // Buscar cada pedido sequencialmente
    for (let i = 0; i < sortedOrderIds.length; i++) {
      const currentIncrementId = sortedOrderIds[i].toString();
      const progress = (((i + 1) / sortedOrderIds.length) * 100).toFixed(1);

      try {
        // Verificar se já existe no banco ANTES de buscar no Magento
        const existingOrder = await prisma.order.findUnique({
          where: { incrementId: currentIncrementId },
          select: { status: true, state: true, detailsFetched: true },
        });

        // Buscar pedido diretamente pelo incrementId
        let orderDetails: OrderDetailInfo;
        try {
          orderDetails = await getOrderInfo(sessionId, currentIncrementId);
        } catch (magentoError: any) {
          // Pedido não existe no Magento (foi deletado)
          if (magentoError.message.includes('does not exist') || magentoError.message.includes('não encontrado')) {
            // Se o pedido existe no banco, marcar como CANCELED
            if (existingOrder) {
              const previousStatus = existingOrder.status;
              await prisma.order.update({
                where: { incrementId: currentIncrementId },
                data: {
                  status: 'CANCELED',
                  state: 'canceled',
                  syncedAt: new Date(),
                },
              });
              console.log(`🗑️  [${progress}%] ${currentIncrementId} - Deletado no Magento | ${previousStatus} → CANCELED`);
              ordersUpdated++;
              if (previousStatus !== 'CANCELED') {
                statusChanged++;
              }
            } else {
              console.log(`⏭️  [${progress}%] ${currentIncrementId} - Não existe no Magento (nunca importado)`);
            }
            continue;
          }
          throw magentoError; // Re-throw se for outro tipo de erro
        }

        if (!orderDetails || !orderDetails.increment_id) {
          console.log(`⏭️  [${progress}%] ${currentIncrementId} - Resposta vazia do Magento`);
          continue;
        }

        const isNew = !existingOrder;
        const previousStatus = existingOrder?.status;
        const previousState = existingOrder?.state;

        // Salvar pedido básico
        await saveOrderToDatabase(orderDetails);
        ordersProcessed++;

        const currentStatus = mapOrderStatus(orderDetails.status);
        const currentState = orderDetails.state || null;
        const hasStatusChanged =
          existingOrder && (previousStatus !== currentStatus || previousState !== currentState);

        if (isNew) {
          ordersCreated++;
          console.log(`✅ [${progress}%] ${currentIncrementId} - NOVO | Status: ${currentStatus}`);
        } else if (hasStatusChanged) {
          ordersUpdated++;
          statusChanged++;
          console.log(
            `🔄 [${progress}%] ${currentIncrementId} - Status: ${previousStatus} → ${currentStatus}${previousState !== currentState ? ` | State: ${previousState} → ${currentState}` : ''}`
          );
        } else {
          ordersUpdated++;
          console.log(`⏭️  [${progress}%] ${currentIncrementId} - Sem mudanças | Status: ${currentStatus}`);
        }

        // Salvar detalhes completos
        const ok = await saveOrderDetailsToDatabase(orderDetails);
        if (ok) {
          detailsFetched++;
          if (!existingOrder?.detailsFetched) {
            console.log(`   📋 Detalhes salvos`);
          }
        }

        // Delay entre requisições
        await new Promise((r) => setTimeout(r, 500));
      } catch (error: any) {
        console.error(`❌ [${progress}%] ${currentIncrementId} - Erro:`, error.message);
        errors.push(`Pedido ${currentIncrementId}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DA SINCRONIZAÇÃO DOS ÚLTIMOS 50');
    console.log('='.repeat(50));
    console.log(`✅ Total processado: ${ordersProcessed}`);
    console.log(`   ➕ Novos pedidos: ${ordersCreated}`);
    console.log(`   🔄 Atualizados: ${ordersUpdated}`);
    console.log(`   📝 Mudanças de status: ${statusChanged}`);
    console.log(`   📋 Detalhes buscados: ${detailsFetched}`);
    console.log(`   ❌ Erros: ${errors.length}`);
    console.log('='.repeat(50) + '\n');

    return {
      success: true,
      ordersProcessed,
      ordersCreated,
      ordersUpdated,
      statusChanged,
      detailsFetched,
      errors,
      summary: {
        totalOrders: sortedOrderIds.length,
        processedOrders: ordersProcessed,
        newOrders: ordersCreated,
        updatedOrders: ordersUpdated,
        statusChanges: statusChanged,
        detailsFetched,
        errorCount: errors.length,
      },
    };
  } catch (error: any) {
    console.error('💥 Erro fatal na sincronização:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
