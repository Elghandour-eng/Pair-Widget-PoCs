import { KeyRound, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Select } from '@/components/Select'
import { Loading, Modal, PageHead, Pagination, PasswordInput, RoleBadge, Spinner } from '@/components/ui'
import { api, type Role, type User, type Widget } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useFormatDate, useI18n, type MsgKey } from '@/lib/i18n'
import { useToast } from '@/lib/toast'

const ROLES: Role[] = ['admin', 'editor', 'viewer']

function useRoleOptions() {
  const { t } = useI18n()
  return ROLES.map((r) => ({ value: r, label: t(`role.${r}` as MsgKey), hint: t(`roleHelp.${r}` as MsgKey) }))
}

export function Users() {
  const { t } = useI18n()
  const fmt = useFormatDate()
  const toast = useToast()
  const { user: me } = useAuth()
  const roleOptions = useRoleOptions()
  const [users, setUsers] = useState<User[] | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(8)
  const [create, setCreate] = useState(false)
  const [reset, setReset] = useState<User | null>(null)
  const [access, setAccess] = useState<User | null>(null)
  const [del, setDel] = useState<User | null>(null)

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch((e) => toast.err(e.message))

  const pageCount = Math.max(1, Math.ceil((users?.length ?? 0) / perPage))
  const current = Math.min(page, pageCount)
  useEffect(() => { setPage(1) }, [perPage])
  useEffect(() => { if (page !== current) setPage(current) }, [page, current])
  const visible = (users ?? []).slice((current - 1) * perPage, current * perPage)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changeRole = async (u: User, role: Role) => {
    try {
      await api.updateUser(u.id, { role })
      toast.ok(t('users.roleChanged', { email: u.email, role: t(`role.${role}` as MsgKey) }))
      load()
    } catch (e) {
      toast.err((e as Error).message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <PageHead
        eyebrow={t('users.eyebrow')}
        title={t('users.title')}
        lede={t('users.lede')}
        action={<button className="btn-primary" onClick={() => setCreate(true)}><Plus className="size-4" />{t('users.new')}</button>}
      />

      <div className="stagger grid shrink-0 gap-3 sm:grid-cols-3">
        {ROLES.map((r, i) => (
          <div key={r} className="card lift px-4 py-3.5" style={{ '--d': i } as React.CSSProperties}>
            <RoleBadge role={r} />
            <p className="mt-2 text-[11.5px] leading-[1.55] text-muted">{t(`roleHelp.${r}` as MsgKey)}</p>
          </div>
        ))}
      </div>

      {users === null ? (
        <Loading />
      ) : (
        <>
          <div className="scroll-pane -mx-1 min-h-0 flex-1 px-1">
          {/* Desktop: table */}
          <div className="card anim-rise hidden overflow-hidden md:block">
            <table className="w-full text-[13px]">
              <thead className="border-b border-accent bg-surface/70">
                <tr>
                  <th className="th text-start">{t('users.col.user')}</th>
                  <th className="th text-start">{t('users.col.role')}</th>
                  <th className="th hidden text-start lg:table-cell">{t('users.col.lastLogin')}</th>
                  <th className="th text-end">{t('users.col.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {visible.map((u, i) => (
                  <tr key={u.id} className="row-in transition-colors duration-200 hover:bg-accent-50/50" style={{ '--d': i } as React.CSSProperties}>
                    <td className="td">
                      <p className="font-bold text-ink">
                        {u.name}
                        {u.id === me?.id && <span className="ms-2 text-[11px] font-normal text-faint">{t('common.you')}</span>}
                      </p>
                      <p className="mono text-[11px] text-faint">{u.email}</p>
                      {u.role !== 'admin' && (
                        <p className="mt-0.5 text-[11px] text-faint">
                          {t('users.access.label')}: {u.widgetIds ? t('users.access.count', { n: u.widgetIds.length }) : t('users.access.all')}
                        </p>
                      )}
                    </td>
                    <td className="td">
                      <div className="w-[9.5rem]">
                        <Select size="sm" label={t('users.col.role')} value={u.role} options={roleOptions} onChange={(v) => changeRole(u, v as Role)} />
                      </div>
                    </td>
                    <td className="td hidden text-muted lg:table-cell">{fmt(u.lastLoginAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        {u.role !== 'admin' && (
                          <button className="btn-ghost btn-sm" title={t('users.access.editTitle')} aria-label={t('users.access.editTitle')} onClick={() => setAccess(u)}><LayoutGrid className="size-4" /></button>
                        )}
                        <button className="btn-ghost btn-sm" title={t('users.resetTitle')} aria-label={t('users.resetTitle')} onClick={() => setReset(u)}><KeyRound className="size-4" /></button>
                        <button className="btn-danger btn-sm" title={t('common.delete')} aria-label={t('common.delete')} onClick={() => setDel(u)} disabled={u.id === me?.id}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="stagger grid gap-2.5 md:hidden">
            {visible.map((u, i) => (
              <div key={u.id} className="card px-4 py-3.5" style={{ '--d': i } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">
                      {u.name}
                      {u.id === me?.id && <span className="ms-2 text-[11px] font-normal text-faint">{t('common.you')}</span>}
                    </p>
                    <p className="mono truncate text-[10.5px] text-faint">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <p className="mt-2 text-[11px] text-faint">{t('users.col.lastLogin')}: {fmt(u.lastLoginAt)}</p>
                {u.role !== 'admin' && (
                  <p className="mt-1 text-[11px] text-faint">
                    {t('users.access.label')}: {u.widgetIds ? t('users.access.count', { n: u.widgetIds.length }) : t('users.access.all')}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="w-[9.5rem]">
                    <Select size="sm" label={t('users.col.role')} value={u.role} options={roleOptions} onChange={(v) => changeRole(u, v as Role)} />
                  </div>
                  {u.role !== 'admin' && (
                    <button className="btn-ghost btn-sm ms-auto" aria-label={t('users.access.editTitle')} onClick={() => setAccess(u)}><LayoutGrid className="size-4" /></button>
                  )}
                  <button className={`btn-ghost btn-sm ${u.role === 'admin' ? 'ms-auto' : ''}`} aria-label={t('users.resetTitle')} onClick={() => setReset(u)}><KeyRound className="size-4" /></button>
                  <button className="btn-danger btn-sm" aria-label={t('common.delete')} onClick={() => setDel(u)} disabled={u.id === me?.id}><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
          </div>

          <div className="shrink-0 border-t border-line pt-3">
          <Pagination
            page={current}
            pageCount={pageCount}
            total={users.length}
            from={(current - 1) * perPage + 1}
            to={Math.min(current * perPage, users.length)}
            perPage={perPage}
            onPerPage={setPerPage}
            onPage={setPage}
          />
          </div>
        </>
      )}

      {create && <UserForm onClose={() => setCreate(false)} onDone={() => { setCreate(false); load() }} />}
      {reset && <ResetForm user={reset} onClose={() => setReset(null)} />}
      {access && <AccessForm user={access} onClose={() => setAccess(null)} onDone={() => { setAccess(null); load() }} />}
      {del && (
        <Modal title={t('users.delete.title')} subtitle={t('users.delete.subtitle', { email: del.email })} onClose={() => setDel(null)}>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDel(null)}>{t('common.cancel')}</button>
            <button
              className="btn-danger"
              onClick={async () => {
                try { await api.deleteUser(del.id); toast.ok(t('users.deleted')); setDel(null); load() } catch (e) { toast.err((e as Error).message) }
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** "All widgets" vs a checkbox list of specific ones, shared by the create and edit forms. */
function AccessPicker({ restricted, setRestricted, sel, setSel }: {
  restricted: boolean
  setRestricted: (v: boolean) => void
  sel: Set<string>
  setSel: (s: Set<string>) => void
}) {
  const { t } = useI18n()
  const [widgets, setWidgets] = useState<Widget[] | null>(null)
  useEffect(() => { api.listWidgets().then((r) => setWidgets(r.widgets)).catch(() => setWidgets([])) }, [])

  const toggle = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSel(next)
  }
  const optionCls = (active: boolean) =>
    `rounded-lg border p-2.5 text-start text-[12.5px] font-bold transition-all duration-200 ${
      active ? 'border-2 border-accent bg-white text-accent-deep' : 'border-line bg-surface/60 text-ink hover:border-accent-300 hover:bg-white'
    }`

  return (
    <div>
      <span className="label">{t('users.access.label')}</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className={optionCls(!restricted)} aria-pressed={!restricted} onClick={() => setRestricted(false)}>
          {t('users.access.all')}
        </button>
        <button type="button" className={optionCls(restricted)} aria-pressed={restricted} onClick={() => setRestricted(true)}>
          {t('users.access.selected')}
        </button>
      </div>
      {restricted && (
        widgets === null ? (
          <div className="mt-2 flex justify-center py-3"><Spinner className="size-4" /></div>
        ) : widgets.length === 0 ? (
          <p className="fine mt-2">{t('users.access.empty')}</p>
        ) : (
          <>
            <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-line bg-surface/60 p-1.5">
              {widgets.map((w) => (
                <label key={w.widgetId} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent-50/60">
                  <input type="checkbox" className="size-3.5 shrink-0 accent-accent" checked={sel.has(w.widgetId)} onChange={() => toggle(w.widgetId)} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">{w.channelName}</span>
                  <code className="mono hidden truncate text-[10px] text-faint sm:block" dir="ltr">{w.widgetId}</code>
                </label>
              ))}
            </div>
            <p className="fine mt-1.5">{t('users.access.pickHint')}</p>
          </>
        )
      )}
    </div>
  )
}

function UserForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const roleOptions = useRoleOptions()
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'editor' as Role })
  const [restricted, setRestricted] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.createUser({ ...f, widgetIds: f.role !== 'admin' && restricted ? [...sel] : undefined })
      toast.ok(t('users.created', { email: f.email }))
      onDone()
    } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('users.form.title')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="u-name">{t('users.form.name')}</label>
          <input id="u-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="u-email">{t('users.form.email')}</label>
          <input id="u-email" className="input mono" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </div>
        <PasswordInput
          label={t('users.form.password')}
          value={f.password}
          onChange={(v) => setF({ ...f, password: v })}
          autoComplete="new-password"
          minLength={8}
          hint={t('users.form.passwordHint')}
        />
        <div>
          <span className="label">{t('users.form.role')}</span>
          <Select label={t('users.form.role')} value={f.role} options={roleOptions} onChange={(v) => setF({ ...f, role: v as Role })} />
          <p className="fine mt-1.5">{t(`roleHelp.${f.role}` as MsgKey)}</p>
        </div>
        {f.role === 'admin' ? (
          <p className="fine">{t('users.access.adminNote')}</p>
        ) : (
          <AccessPicker restricted={restricted} setRestricted={setRestricted} sel={sel} setSel={setSel} />
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : t('common.create')}</button>
        </div>
      </form>
    </Modal>
  )
}

function ResetForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await api.updateUser(user.id, { password }); toast.ok(t('users.passwordUpdated')); onClose() } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('users.resetTitle')} subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <PasswordInput
          label={t('users.newPassword')}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          hint={t('users.form.passwordHint')}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : t('common.update')}</button>
        </div>
      </form>
    </Modal>
  )
}

function AccessForm({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [restricted, setRestricted] = useState(!!user.widgetIds)
  const [sel, setSel] = useState<Set<string>>(new Set(user.widgetIds ?? []))
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateUser(user.id, { widgetIds: restricted ? [...sel] : null })
      toast.ok(t('users.access.updated', { email: user.email }))
      onDone()
    } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('users.access.title')} subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <AccessPicker restricted={restricted} setRestricted={setRestricted} sel={sel} setSel={setSel} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4 border-white/40 border-t-white" /> : t('common.update')}</button>
        </div>
      </form>
    </Modal>
  )
}
