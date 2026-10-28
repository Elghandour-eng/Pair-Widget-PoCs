// Shared by the studio (replyParts) and the templates render SDK: no imports, no network.

/**
 * The agent put its own actions behind the card's buttons: {add_to_cart: "danah.add_to_cart"}, or
 * {add_to_cart: {id, data}} when the reply says what the action gets. Every button of that kind in the drawn card
 * takes the action's id; its data is the button's own (the product it belongs to) plus the reply's, where {{item.x}}
 * is read from that button's item (the product: {{item.id}}, {{item.price.current}}…).
 */
export function withEngineActions<T>(tpl: T, actions: unknown): T {
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) return tpl
  const map: Record<string, { id: string; data?: Record<string, unknown> }> = {}
  for (const [kind, v] of Object.entries(actions as Record<string, unknown>)) {
    if (typeof v === 'string' && v.startsWith('danah.')) map[kind] = { id: v }
    else if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' && (v as { id: string }).id.startsWith('danah.')) {
      const d = (v as { data?: unknown }).data
      map[kind] = { id: (v as { id: string }).id, data: d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : undefined }
    }
  }
  if (!Object.keys(map).length) return tpl
  const read = (item: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((cur, k) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined), item)
  const fill = (data: Record<string, unknown>, item: unknown): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data)) {
      // left empty: the button's own payload says it
      if (v === '' || v === null || v === undefined) continue
      if (typeof v !== 'string' || !v.includes('{{item.')) {
        out[k] = v
        continue
      }
      // exactly one {{item.x}} keeps the value as it is (a number stays a number)
      const whole = /^\{\{\s*item\.([\w.]+)\s*\}\}$/.exec(v.trim())
      out[k] = whole ? read(item, whole[1]) : v.replace(/\{\{\s*item\.([\w.]+)\s*\}\}/g, (_, p: string) => String(read(item, p) ?? ''))
    }
    return out
  }
  const walk = (v: unknown, item: unknown): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, item))
    if (!v || typeof v !== 'object') return v
    const o = v as Record<string, unknown>
    // an object with its own buttons (a product) is the item its buttons belong to
    const here = Array.isArray(o.actions) || (o.action && typeof o.action === 'object') ? o : item
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(o)) out[k] = walk(x, here)
    const m = typeof o.type === 'string' ? map[o.type] : undefined
    if (m && ('payload' in o || 'action_ulid' in o)) {
      out.id = m.id
      delete out.action_ulid
      if (m.data) out.payload = { ...((o.payload as Record<string, unknown>) ?? {}), ...fill(m.data, item) }
    }
    return out
  }
  return walk(tpl, undefined) as T
}
