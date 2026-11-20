-- ============================================================
-- StaffPortal — Migration 004: Seed Data
-- Essential reference data only. No mock users.
-- ============================================================

-- ============================================================
-- DEFAULT DEPARTMENTS
-- ============================================================

INSERT INTO departments (name, description) VALUES
  ('Engineering',      'Software development and infrastructure'),
  ('Design',           'UI/UX and product design'),
  ('Marketing',        'Brand, content, and growth'),
  ('Sales',            'Account management and business development'),
  ('Human Resources',  'People operations and talent'),
  ('Finance',          'Accounts, payroll and financial operations'),
  ('IT',               'Systems, support and security'),
  ('Facilities',       'Office management and reception'),
  ('Operations',       'Process, logistics and administration')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- DEFAULT LOCATIONS
-- ============================================================

INSERT INTO locations (name, address, city, postcode, capacity) VALUES
  ('London HQ',   '1 Canary Wharf',      'London',     'E14 5AB', 250),
  ('Manchester',  '100 Deansgate',        'Manchester', 'M3 2GP',   80),
  ('Birmingham',  'One Snowhill',         'Birmingham', 'B4 6GH',   50),
  ('Edinburgh',   '1 Baxter Place',       'Edinburgh',  'EH1 3AF',  30),
  ('Remote',      'N/A',                  'N/A',        'N/A',       0)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- DEFAULT EMAIL TEMPLATES
-- Variables use {{double_braces}} format, replaced at send time
-- ============================================================

INSERT INTO email_templates (name, subject, category, variables, html_body, text_body) VALUES

(
  'leave_submitted',
  'Leave Request Submitted — {{leave_type}} ({{start_date}} to {{end_date}})',
  'leave',
  ARRAY['employee_name','leave_type','start_date','end_date','days_count','reason','approver_name','leave_balance_remaining'],
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Leave Submitted</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#1a1a1a;">Leave Request Submitted</h2>
    <p>Hi {{employee_name}},</p>
    <p>Your leave request has been submitted and is awaiting approval from <strong>{{approver_name}}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;color:#666;width:40%;">Leave Type</td><td style="padding:8px;font-weight:bold;">{{leave_type}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Start Date</td><td style="padding:8px;">{{start_date}}</td></tr>
      <tr><td style="padding:8px;color:#666;">End Date</td><td style="padding:8px;">{{end_date}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Days</td><td style="padding:8px;">{{days_count}}</td></tr>
      <tr><td style="padding:8px;color:#666;">Reason</td><td style="padding:8px;">{{reason}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Remaining Balance</td><td style="padding:8px;">{{leave_balance_remaining}} days</td></tr>
    </table>
    <p style="color:#666;font-size:13px;">You will receive an email once your request has been reviewed.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">StaffPortal &bull; Internal Office System &bull; <a href="https://sarmalinux.com" style="color:#999;">Designed &amp; Developed by Sarma Linux</a></p>
  </div>
</body>
</html>',
  'Hi {{employee_name}}, your {{leave_type}} leave request from {{start_date}} to {{end_date}} ({{days_count}} days) has been submitted. Approver: {{approver_name}}. Reason: {{reason}}. Remaining balance: {{leave_balance_remaining}} days. — StaffPortal'
),

(
  'leave_approved',
  'Leave Approved — {{leave_type}} ({{start_date}} to {{end_date}})',
  'leave',
  ARRAY['employee_name','leave_type','start_date','end_date','days_count','approver_name','leave_balance_remaining'],
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Leave Approved</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#16a34a;">✓ Leave Approved</h2>
    <p>Hi {{employee_name}},</p>
    <p>Your leave request has been <strong style="color:#16a34a;">approved</strong> by {{approver_name}}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;color:#666;width:40%;">Leave Type</td><td style="padding:8px;font-weight:bold;">{{leave_type}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Start Date</td><td style="padding:8px;">{{start_date}}</td></tr>
      <tr><td style="padding:8px;color:#666;">End Date</td><td style="padding:8px;">{{end_date}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Days</td><td style="padding:8px;">{{days_count}}</td></tr>
      <tr><td style="padding:8px;color:#666;">Updated Balance</td><td style="padding:8px;color:#16a34a;font-weight:bold;">{{leave_balance_remaining}} days remaining</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">StaffPortal &bull; Internal Office System &bull; <a href="https://sarmalinux.com" style="color:#999;">Designed &amp; Developed by Sarma Linux</a></p>
  </div>
</body>
</html>',
  'Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} ({{days_count}} days) has been APPROVED by {{approver_name}}. Updated balance: {{leave_balance_remaining}} days. — StaffPortal'
),

(
  'leave_rejected',
  'Leave Request Declined — {{leave_type}} ({{start_date}} to {{end_date}})',
  'leave',
  ARRAY['employee_name','leave_type','start_date','end_date','days_count','approver_name','rejection_reason','leave_balance_remaining'],
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Leave Declined</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#dc2626;">✕ Leave Declined</h2>
    <p>Hi {{employee_name}},</p>
    <p>Unfortunately your leave request has been <strong style="color:#dc2626;">declined</strong> by {{approver_name}}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;color:#666;width:40%;">Leave Type</td><td style="padding:8px;font-weight:bold;">{{leave_type}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Start Date</td><td style="padding:8px;">{{start_date}}</td></tr>
      <tr><td style="padding:8px;color:#666;">End Date</td><td style="padding:8px;">{{end_date}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Reason for Decline</td><td style="padding:8px;color:#dc2626;">{{rejection_reason}}</td></tr>
      <tr><td style="padding:8px;color:#666;">Current Balance</td><td style="padding:8px;">{{leave_balance_remaining}} days remaining</td></tr>
    </table>
    <p style="color:#666;font-size:13px;">If you have questions, please speak with your approver directly.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">StaffPortal &bull; Internal Office System &bull; <a href="https://sarmalinux.com" style="color:#999;">Designed &amp; Developed by Sarma Linux</a></p>
  </div>
</body>
</html>',
  'Hi {{employee_name}}, your {{leave_type}} leave from {{start_date}} to {{end_date}} has been DECLINED by {{approver_name}}. Reason: {{rejection_reason}}. Balance unchanged: {{leave_balance_remaining}} days. — StaffPortal'
),

(
  'wfh_notification',
  '{{employee_name}} is Working From Home on {{wfh_date}}',
  'attendance',
  ARRAY['employee_name','wfh_date','department_name'],
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>WFH Notification</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#2563eb;">🏠 Work From Home Notice</h2>
    <p><strong>{{employee_name}}</strong> from <strong>{{department_name}}</strong> will be working from home on <strong>{{wfh_date}}</strong>.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">StaffPortal &bull; Internal Office System &bull; <a href="https://sarmalinux.com" style="color:#999;">Designed &amp; Developed by Sarma Linux</a></p>
  </div>
</body>
</html>',
  '{{employee_name}} ({{department_name}}) will be working from home on {{wfh_date}}. — StaffPortal'
),

(
  'early_clock_out',
  'Early Departure Notice — {{employee_name}} on {{work_date}}',
  'attendance',
  ARRAY['employee_name','work_date','clock_out_time','hours_worked','reason','department_name'],
  '<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Early Departure</title></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e5e5;">
    <h2 style="color:#d97706;">⚠ Early Departure Notice</h2>
    <p><strong>{{employee_name}}</strong> clocked out early on <strong>{{work_date}}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;color:#666;width:40%;">Department</td><td style="padding:8px;">{{department_name}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Clock-out Time</td><td style="padding:8px;">{{clock_out_time}}</td></tr>
      <tr><td style="padding:8px;color:#666;">Hours Worked</td><td style="padding:8px;">{{hours_worked}}</td></tr>
      <tr style="background:#f5f5f5;"><td style="padding:8px;color:#666;">Reason</td><td style="padding:8px;">{{reason}}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#999;font-size:12px;">StaffPortal &bull; Internal Office System &bull; <a href="https://sarmalinux.com" style="color:#999;">Designed &amp; Developed by Sarma Linux</a></p>
  </div>
</body>
</html>',
  '{{employee_name}} ({{department_name}}) left early on {{work_date}} at {{clock_out_time}} after {{hours_worked}} hours. Reason: {{reason}}. — StaffPortal'
)

ON CONFLICT (name) DO NOTHING;
