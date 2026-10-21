'use client'

import { useState, useTransition } from 'react'
import { changePortalRole } from '@/lib/actions/portal-roles'

type UserOption = { id: string; full_name: string | null }
const roles: Record<string, { value: string; label: string }[]> = {
  events: [{ value: 'event_staff', label: 'Eventmedewerker' }, { value: 'event_responsible', label: 'Eventverantwoordelijke' }],
  promotion: [{ value: 'promoter', label: 'Promotiemedewerker' }],
  administration: [{ value: 'administrative_staff', label: 'Administratief medewerker' }],
}

export function RoleManagementForm({ users }: { users: UserOption[] }) {
  const [portal, setPortal] = useState('events')
  const [result, setResult] = useState('')
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState('assign')
  const [role, setRole] = useState('event_staff')
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const matches = users.filter(user => (user.full_name ?? '').toLocaleLowerCase().includes(search.toLocaleLowerCase()) || user.id.includes(search)).slice(0, 100)

  function submit(formData: FormData) {
    setResult('')
    startTransition(async () => {
      try {
        await changePortalRole(formData)
        setResult('Rolwijziging opgeslagen.')
      } catch {
        setResult('Rolwijziging niet uitgevoerd.')
      }
    })
  }

  return <form action={submit} className="grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm">Medewerker zoeken<input value={search} onChange={e => setSearch(e.target.value)} className="rounded border bg-background p-2" /></label>
    <label className="grid gap-1 text-sm">Gebruiker<select required name="user_id" value={userId} onChange={e => setUserId(e.target.value)} className="rounded border bg-background p-2">{matches.map(user => <option key={user.id} value={user.id}>{user.full_name || user.id}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Portaal<select name="portal" value={portal} onChange={e => { setPortal(e.target.value); setRole(roles[e.target.value][0].value) }} className="rounded border bg-background p-2"><option value="events">Evenementen</option><option value="promotion">Promotie</option><option value="administration">Administratie</option></select></label>
    <label className="grid gap-1 text-sm">Rol<select name="role" value={role} onChange={e => setRole(e.target.value)} className="rounded border bg-background p-2">{roles[portal].map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Actie<select name="action" value={action} onChange={e => setAction(e.target.value)} className="rounded border bg-background p-2"><option value="assign">Toewijzen</option><option value="approve">Goedkeuren</option><option value="revoke">Intrekken</option></select></label>
    <button disabled={pending || !userId || !matches.some(user => user.id === userId)} type="submit" className="rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">{pending ? 'Bezig met opslaan...' : 'Rolwijziging uitvoeren'}</button>
    {result && <p role="status" aria-live="polite" className="sm:col-span-2">{result}</p>}
  </form>
}
