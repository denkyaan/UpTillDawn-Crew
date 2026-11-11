-- Standard workposts requested for UpTillDawn: Lockers and Stage Managers.
-- Reuse the existing workplace catalog, event seeding, crew planning, briefing,
-- inventory, attendance and timesheet flows; no new role, module or navigation.
-- Idempotent under an already customized catalog or existing named workplace.

WITH defaults(name, description, sort_order) AS (
  VALUES
    ('Lockers'::text,
     'Uitgifte, beheer en teruggave van lockers; bezoekers helpen met toegang en incidenten.'::text,
     38),
    ('Stage Managers'::text,
     'Stage- en showcoördinatie: artiestenwissels, timing, backstage-afstemming en technische communicatie.'::text,
     43)
)
INSERT INTO public.workplace_catalog(
  name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff
)
SELECT d.name,d.description,d.sort_order,true,0,0,null::integer
FROM defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM public.workplace_catalog c
  WHERE lower(trim(c.name))=lower(d.name)
);

-- Keep an existing catalog item's custom description and staffing limits.
-- Reactivate the requested standard entries and place them among the current
-- Bar/Tokens/Backstage/Driver default workposts.
WITH defaults(name, description, sort_order) AS (
  VALUES
    ('Lockers'::text,
     'Uitgifte, beheer en teruggave van lockers; bezoekers helpen met toegang en incidenten.'::text,
     38),
    ('Stage Managers'::text,
     'Stage- en showcoördinatie: artiestenwissels, timing, backstage-afstemming en technische communicatie.'::text,
     43)
)
UPDATE public.workplace_catalog c
SET is_active=true,
    sort_order=d.sort_order,
    description=CASE
      WHEN nullif(trim(c.description),'') IS NULL THEN d.description
      ELSE c.description
    END
FROM defaults d
WHERE lower(trim(c.name))=lower(d.name);

-- An event can already have a custom, manually created workplace of exactly
-- this name. Link it to the standard catalog rather than creating a duplicate.
UPDATE public.workplaces w
SET catalog_workplace_id=c.id,
    description=coalesce(w.description,c.description),
    sort_order=c.sort_order
FROM public.workplace_catalog c
WHERE lower(trim(c.name)) IN ('lockers','stage managers')
  AND lower(trim(w.name))=lower(trim(c.name))
  AND w.catalog_workplace_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workplaces already_linked
    WHERE already_linked.event_id=w.event_id
      AND already_linked.catalog_workplace_id=c.id
      AND already_linked.id<>w.id
  );

-- Populate currently scheduled/upcoming events; historical events are not
-- rewritten. New events already inherit every active standard catalog item
-- through public.upt_seed_event().
INSERT INTO public.workplaces(
  event_id,name,description,sort_order,is_active,
  minimum_staff,target_staff,maximum_staff,catalog_workplace_id
)
SELECT
  e.id,c.name,c.description,c.sort_order,true,
  c.minimum_staff,c.target_staff,c.maximum_staff,c.id
FROM public.events e
JOIN public.workplace_catalog c
  ON lower(trim(c.name)) IN ('lockers','stage managers') AND c.is_active=true
WHERE e.status<>'archived'
  AND e.end_at>=now()
  AND NOT EXISTS (
    SELECT 1 FROM public.workplaces w
    WHERE w.event_id=e.id
      AND (w.catalog_workplace_id=c.id OR lower(trim(w.name))=lower(trim(c.name)))
  )
ON CONFLICT(event_id,name) DO NOTHING;
