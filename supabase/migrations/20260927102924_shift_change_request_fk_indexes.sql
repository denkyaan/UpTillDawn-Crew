create index if not exists shift_change_requests_workplace_fk_idx
on upt_private.shift_change_requests(workplace_id);

create index if not exists shift_change_requests_requester_fk_idx
on upt_private.shift_change_requests(requester_id);

create index if not exists shift_change_requests_decided_by_fk_idx
on upt_private.shift_change_requests(decided_by)
where decided_by is not null;
