insert into public.role_ui_rules(role,feature_key,label,group_key,visible,enabled,condition_key,sort_order,settings)
values
 ('admin','overview','Overzicht','navigation',true,true,'always',10,'{}'::jsonb),
 ('admin','events','Evenementen','navigation',true,true,'always',20,'{}'::jsonb),
 ('admin','workplaces','Werkplaatsen & shifts','navigation',true,true,'always',30,'{}'::jsonb),
 ('admin','operations','Werkuren','navigation',true,true,'always',40,'{}'::jsonb),
 ('admin','tasks','Taken','navigation',true,true,'always',50,'{}'::jsonb),
 ('admin','sales','Sales','navigation',true,true,'always',60,'{}'::jsonb),
 ('admin','personnel','Goedkeuringen','navigation',true,true,'always',70,'{}'::jsonb),
 ('admin','crew','Personeel','navigation',true,true,'always',80,'{}'::jsonb),
 ('admin','chat','Chats','navigation',true,true,'always',90,'{}'::jsonb),
 ('admin','incidents','Help','navigation',true,true,'always',100,'{}'::jsonb),
 ('admin','settings','Beheer','navigation',true,true,'always',110,'{}'::jsonb),
 ('admin','shifts','Shift''s','navigation',false,false,'never',45,'{}'::jsonb),
 ('admin','inventory','Inventaris','navigation',false,false,'never',65,'{}'::jsonb),
 ('admin','guestlist','Inkom & Guestlist','navigation',false,false,'never',68,'{}'::jsonb),
 ('admin','briefings','Briefing','navigation',false,false,'never',70,'{}'::jsonb),
 ('admin','knowledge','Kennisbank','navigation',false,false,'never',72,'{}'::jsonb),
 ('admin','emergency','Noodinformatie','navigation',false,false,'never',115,'{}'::jsonb),
 ('admin','documents','Documenten','navigation',false,false,'never',118,'{}'::jsonb),
 ('admin','exports','Excel','navigation',false,false,'never',120,'{}'::jsonb),
 ('admin','platform','Platformbeheer','navigation',false,false,'never',125,'{}'::jsonb),
 ('admin','control-center','Command Center','navigation',false,false,'never',25,'{}'::jsonb)
on conflict(role,feature_key) do update set
 label=excluded.label,
 group_key=excluded.group_key,
 visible=excluded.visible,
 enabled=excluded.enabled,
 condition_key=excluded.condition_key,
 sort_order=excluded.sort_order,
 settings=excluded.settings;

notify pgrst,'reload schema';
