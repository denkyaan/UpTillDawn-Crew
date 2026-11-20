create index if not exists shift_handovers_workplace_fk_idx
on upt_private.shift_handovers(workplace_id);

create index if not exists shift_handovers_outgoing_fk_idx
on upt_private.shift_handovers(outgoing_responsible_id);
