# Provider payout / bank settlement — main test

UpTillDawn now supports one *manual* Admin-attested matching workflow for imported Eventix/SumUp provider transactions and imported EUR bank credits.

- Administration can inspect the report; only an approved Admin can record the final match.
- Selected provider entries must belong to one provider and one event; only paid and refunded entries count. Pending entries cannot be settled.
- A bank credit must equal provider paid minus refunds minus explicitly supplied fees, using integer cents.
- Each bank credit and each provider transaction may be settled **once**. The SQL operation locks and revalidates the bank and selected provider rows and creates one immutable audit record with its transaction snapshot.
- A bank row already posted as an invoice payment or ignored cannot be settled. After settlement it cannot be posted or ignored through the earlier bank workflow, eliminating double counting.
- The operation does **not** post invoice payments, adjust sales, modify inventory or initiate a bank transfer. Uploaded CSV entries remain user-provided assertions; live bank/merchant integration and independent settlement verification still require provider access.
- The UI is available under Administration > Bank, in NL/FR/EN/DE. Existing bank statement rows show an explicit provider-matched status.
- A bounded, same-origin, permission-checked API and database/RLS boundaries handle cross-role and concurrent writes.

Verification: focused pure-accounting and source security regressions in `tests/provider-bank-settlement.test.mjs`, fast CI, main deployment and database policy/trigger inspection. Real settlement with real bank/provider data has **not** been verified and is not implied by an empty main-test ledger. No production CI/deploy or schema changes are authorized by this bundle.

Main-test migration ledger: `20261109100617_admin_provider_bank_settlements.sql`. This filename matches the recorded Supabase migration version. Validate PR head CI again after any filename or release-baseline adjustment.
