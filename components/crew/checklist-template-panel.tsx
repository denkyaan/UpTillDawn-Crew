import { applyOperationalChecklistTemplate } from '@/lib/actions/uptilldawn'

type WorkplaceOption={
  id:string
  eventId:string
  eventName:string
  name:string
  catalogWorkplaceId:string|null
}

type ChecklistTemplate={
  id:string
  catalogWorkplaceId:string|null
  kind:string
  title:string
}

export function ChecklistTemplatePanel({
  workplaces,
  templates,
}:{
  workplaces:WorkplaceOption[]
  templates:ChecklistTemplate[]
}){
  if(!workplaces.length||!templates.length)return null

  return <section className="space-y-3 rounded-2xl border border-violet-500/30 p-4">
    <div>
      <h2 className="text-xl font-black">Checklist-template toepassen</h2>
      <p className="text-sm text-muted-foreground">Kies per werkplek een standaard opening-, sluit- of safetychecklist.</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {workplaces.map(workplace=>{
        const choices=templates.filter(template=>
          template.catalogWorkplaceId===null||
          template.catalogWorkplaceId===workplace.catalogWorkplaceId
        )
        if(!choices.length)return null
        return <form key={workplace.id} action={applyOperationalChecklistTemplate} className="grid gap-2 rounded-xl border p-3">
          <input type="hidden" name="event_id" value={workplace.eventId}/>
          <input type="hidden" name="workplace_id" value={workplace.id}/>
          <b>{workplace.eventName} — {workplace.name}</b>
          <select name="template_id" required className="rounded-lg border bg-background p-3">
            <option value="">Template…</option>
            {choices.map(template=><option key={template.id} value={template.id}>{template.kind.toUpperCase()} · {template.title}</option>)}
          </select>
          <button className="rounded-xl border p-3 font-bold">TEMPLATE TOEPASSEN</button>
        </form>
      })}
    </div>
  </section>
}
