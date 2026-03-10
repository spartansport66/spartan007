import { supabase } from '@/integrations/supabase/client';

// Helpers to normalize and aggregate extracted/uploaded order rows into staging rows
export interface RawRow {
  platform_order_number: string;
  customer_name?: string;
  shipping_address?: string;
  item: string;
  amount?: number | string;
  bill_no?: string;
}

const parseNumber = (v: any) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^0-9.\-]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// Normalize a name for grouping
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Try to extract quantity from an item string, e.g. 'Product Name x2' or 'Qty: 2' or '(2 pcs)'
export const parseItemWithQty = (item: string): { name: string; qty: number } => {
  if (!item) return { name: '', qty: 1 };
  let name = item.trim();
  let qty = 1;

  // common patterns
  const patterns = [
    /(?:qty|quantity)[:\s]*([0-9]+)/i,
    /\b([0-9]+)\s*(?:pcs|pc|pieces)\b/i,
    /\b[xX]\s*([0-9]+)\b/, // x2
    /\(([0-9]+)\s*(?:pcs|pc|pieces)\)/i,
    /\b\*\s*([0-9]+)\b/
  ];

  for (const re of patterns) {
    const m = name.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) {
        qty = n;
        name = name.replace(re, '').trim();
        break;
      }
    }
  }

  // trailing multipliers like 'Product Name x2' or 'Product Name - 2 pcs'
  const trailing = name.match(/\b[xX]\s*([0-9]+)\b$/);
  if (trailing && trailing[1]) {
    const n = parseInt(trailing[1], 10);
    if (!isNaN(n) && n > 0) {
      qty = n;
      name = name.replace(/\b[xX]\s*[0-9]+\b$/, '').trim();
    }
  }

  return { name: name.replace(/\s+\u2022\s+/g, ' ').trim(), qty };
};

// try to extract a SKU-like token from the item name (e.g., CBL217M, SSCHB604)
export const extractSkuToken = (s: string) => {
  if (!s) return undefined;
  const m = s.match(/([A-Z0-9]{4,})/g);
  if (!m) return undefined;
  // prefer tokens with letters+digits
  const mixed = m.find(t => /[A-Z]/.test(t) && /[0-9]/.test(t));
  return mixed || m[0];
};

// Convert arbitrary raw rows into staging rows, grouping by order no and item name
export const buildStagingFromRows = (rows: RawRow[], userId: string) => {
  const out: any[] = [];
  // Map of orderNo -> map of groupKey -> item
  const byOrder: Record<string, Record<string, { name: string; qty: number; amount: number; customer_name?: string; shipping_address?: string; bill_no?: string; sku?: string }>> = {};

  console.log('🔷 buildStagingFromRows called with', rows.length, 'rows');

  for (const r of rows) {
    if (!r.platform_order_number) continue;
    const amt = parseNumber(r.amount);
    const { name, qty } = parseItemWithQty(r.item || '');

    // Filter out noisy labels or selection summaries that are not real items
    const noisePatterns = [
      /select\s*product/i,
      /select\s*items/i,
      /view\s*details/i,
      /\btotal\b/i,
      /\bsubtotal\b/i,
      /\bitems\b/i,
      /sku\s*id/i,
      /handling\s*fee/i,
      /total\s*qty/i,
      /total\s*price/i,
      /tax\s*invoice/i,
      /imei/i,
    ];
    const nameTrimmed = (name || r.item || '').trim();
    let isNoise = false;
    let noisyPattern = '';
    for (const re of noisePatterns) {
      if (re.test(nameTrimmed)) {
        isNoise = true;
        noisyPattern = re.toString();
        break;
      }
    }
    if (isNoise) {
      console.log(`⚠️  Filtered out as noise - Pattern: ${noisyPattern} | Name: "${nameTrimmed}" | Item: "${r.item}"`);
      continue;
    }

    console.log(`✅ Keeping item - Name: "${name}" | Qty: ${qty} | Amount: ${amt}`);

    const key = r.platform_order_number;
    if (!byOrder[key]) byOrder[key] = {};

    const sku = extractSkuToken(r.item || name || '');
    const groupKey = sku ? sku.toLowerCase() : norm(nameTrimmed || '');

    // If the extracted line is likely just an SKU/token (short, uppercase/digits),
    // try to merge it into an existing item for the same order instead of creating
    // a separate row. If there's no existing entry, skip the SKU-only line.
    const possibleSkuOnly = /^([A-Z0-9\-]{2,20})$/i.test(nameTrimmed) && nameTrimmed.length <= 20;
    if (possibleSkuOnly) {
      const token = nameTrimmed;
      const tokenLower = token.toLowerCase();
      const existing = byOrder[key][tokenLower] || Object.values(byOrder[key]).find(e => ((e.sku || '').toLowerCase() === tokenLower) || (e.name || '').toLowerCase().includes(tokenLower));
      if (existing) {
        if (!existing.sku) existing.sku = token;
        if (!(existing.name || '').toLowerCase().includes(tokenLower)) existing.name = `${existing.name} ${token}`.trim();
        if (!existing.bill_no && r.bill_no) existing.bill_no = r.bill_no;
      }
      continue; // skip adding a new row for SKU-only
    }

    // Now merge/add using the computed groupKey
    if (groupKey && byOrder[key][groupKey]) {
      const existing = byOrder[key][groupKey];
      existing.qty += qty;
      existing.amount += amt;
      if (!existing.bill_no && r.bill_no) existing.bill_no = r.bill_no;
    } else {
      // create new grouped entry
      const entryKey = groupKey || `${Object.keys(byOrder[key]).length}_${Math.random()}`;
      byOrder[key][entryKey] = { name: name || r.item, qty, amount: amt, customer_name: r.customer_name, shipping_address: r.shipping_address, bill_no: r.bill_no, sku };
    }
  }

  for (const orderNo of Object.keys(byOrder)) {
    const itemsMap = byOrder[orderNo];
    for (const it of Object.values(itemsMap)) {
      out.push({
        platform_order_number: orderNo,
        customer_name: it.customer_name || null,
        shipping_address: it.shipping_address || null,
        flipkart_item_name: it.name,
        amount: it.amount,
        quantity: it.qty,
        bill_no: it.bill_no || '',
        created_by: userId,
        status: 'pending'
      });
    }
  }

  return out;
};

// Safe upsert for staging rows: if the DB schema hasn't been migrated (no `quantity`),
// retry without the `quantity` field. Always returns `{ data, error }` to match supabase.
export const upsertStaging = async (rows: any[], onConflict: string | string[] = 'platform_order_number,flipkart_item_name') => {
  const oc = Array.isArray(onConflict) ? onConflict.join(',') : onConflict;
  if (!rows || rows.length === 0) return { data: [], error: null };
  try {
    let res = await supabase.from('online_order_staging').upsert(rows, { onConflict: oc });
    if (res.error) {
      const msg = (res.error.message || '').toLowerCase();
      if (msg.includes('quantity') || msg.includes("could not find the 'quantity' column") || msg.includes('column "quantity" does not exist')) {
        const stripped = rows.map(r => {
          const { quantity, ...rest } = r;
          return rest;
        });
        res = await supabase.from('online_order_staging').upsert(stripped, { onConflict: oc });
        return res;
      }
      return res;
    }
    return res;
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('quantity') || msg.includes('column "quantity" does not exist') || msg.includes("could not find the 'quantity' column")) {
      const stripped = rows.map(r => {
        const { quantity, ...rest } = r;
        return rest;
      });
      return await supabase.from('online_order_staging').upsert(stripped, { onConflict: oc });
    }
    throw e;
  }
};

export default { parseItemWithQty, buildStagingFromRows, upsertStaging, extractSkuToken };
