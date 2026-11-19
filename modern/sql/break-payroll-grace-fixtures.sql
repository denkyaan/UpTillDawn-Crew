-- SQL fixture checks for use ONLY in an isolated QA transaction after staging.
-- Expected result: zero rows. No persistent user or payroll data is needed.
with examples(name,prior,used,total,expected) as (values
 ('0',0::numeric,0::numeric,0::numeric,0::numeric),
 ('60:00',0,3600,3600,0),('69:00',0,4140,4140,0),
 ('70:00',0,4200,4200,0),('70:01',0,4201,4201,601),
 ('65+6 first',0,3900,4260,300),('65+6 second',3900,360,4260,360),
 ('90:00',0,5400,5400,1800),('later',4200,180,4380,180),
 ('exact split first',0,3900,4200,0),('exact split last',3900,300,4200,0)
)
select name,prior,used,total,expected,
 upt_private.break_deduction_seconds(prior,used,total) as actual
from examples
where upt_private.break_deduction_seconds(prior,used,total)<>expected;
