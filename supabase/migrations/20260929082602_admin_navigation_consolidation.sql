update public.role_ui_rules set visible=false,enabled=false,condition_key='never'
where role='admin' and feature_key in('control-center','shifts','inventory','guestlist','briefings','knowledge','emergency','documents','exports','platform');

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
 ('admin','settings','Beheer','navigation',true,true,'always',110,'{}'::jsonb)
on conflict(role,feature_key) do update set
 label=excluded.label,group_key='navigation',visible=true,enabled=true,condition_key='always',sort_order=excluded.sort_order,settings=excluded.settings;

notify pgrst,'reload schema';
