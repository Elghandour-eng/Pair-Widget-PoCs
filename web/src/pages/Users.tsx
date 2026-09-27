import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Modal, RoleBadge, Spinner } from '@/components/ui'
import { api, fmtDate, type Role, type User } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

const ROLES: Role[] = ['admin', 'editor', 'viewer']
const ROLE_HELP: Record<Role, string> = { admin: 'Everything, including users and deleting widgets', editor: 'Register widgets, edit and save designs, switch sources', viewer: 'Read-only access to widgets and previews' }

export function Users() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [create, setCreate] = useState(false)
  const [reset, setReset] = useState<User | null>(null)
  const [del, setDel] = useState<User | null>(null)

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch((e) => toast.err(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changeRole = async (u: User, role: Role) => {
    try { await api.updateUser(u.id, { role }); toast.ok(`${u.email} is now ${role}`); load() } catch (e) { toast.err((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Access</p><h1 className="text-2xl font-extrabold md:text-3xl">Users</h1><p className="mt-1 text-sm text-ink-500">Who can sign in to the studio and what they can do.</p></div>
        <button className="btn-primary" onClick={() => setCreate(true)}><Plus className="size-4" />New user</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">{ROLES.map((r) => <div key={r} className="card px-4 py-3"><RoleBadge role={r} /><p className="mt-2 text-xs text-ink-500">{ROLE_HELP[r]}</p></div>)}</div>
      {users === null ? <div className="flex justify-center py-20"><Spinner /></div> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-[11px] font-bold uppercase tracking-wider text-ink-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="hidden px-5 py-3 md:table-cell">Last login</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3.5"><p className="font-semibold">{u.name}{u.id === me?.id && <span className="ml-2 text-xs font-normal text-ink-300">(you)</span>}</p><p className="text-xs text-ink-500">{u.email}</p></td>
                  <td className="px-5 py-3.5"><select className="input w-auto py-1.5" value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                  <td className="hidden px-5 py-3.5 text-ink-500 md:table-cell">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button className="btn-ghost px-2.5 py-1.5" title="Reset password" onClick={() => setReset(u)}><KeyRound className="size-4" /></button><button className="btn-danger px-2.5 py-1.5" title="Delete" onClick={() => setDel(u)} disabled={u.id === me?.id}><Trash2 className="size-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {create && <UserForm onClose={() => setCreate(false)} onDone={() => { setCreate(false); load() }} />}
      {reset && <ResetForm user={reset} onClose={() => setReset(null)} />}
      {del && (
        <Modal title="Delete user?" subtitle={`${del.email} will lose access immediately.`} onClose={() => setDel(null)}>
          <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn-danger" onClick={async () => { try { await api.deleteUser(del.id); toast.ok('User deleted'); setDel(null); load() } catch (e) { toast.err((e as Error).message) } }}>Delete</button></div>
        </Modal>
      )}
    </div>
  )
}

function UserForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'editor' as Role })
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await api.createUser(f); toast.ok(`${f.email} created`); onDone() } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="New user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><label className="label">Password</label><input className="input" type="password" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /><p className="mt-1 text-xs text-ink-500">At least 8 characters.</p></div>
        <div><label className="label">Role</label><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select><p className="mt-1 text-xs text-ink-500">{ROLE_HELP[f.role]}</p></div>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4" /> : 'Create'}</button></div>
      </form>
    </Modal>
  )
}

function ResetForm({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true)
    try { await api.updateUser(user.id, { password }); toast.ok('Password updated'); onClose() } catch (err) { toast.err((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title="Reset password" subtitle={user.email} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">New password</label><input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /></div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? <Spinner className="size-4" /> : 'Update'}</button></div>
      </form>
    </Modal>
  )
}
