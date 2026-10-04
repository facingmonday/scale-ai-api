# Decision answer updates

`Decision.updateSubmission` replaces decision variable rows, challenge answers,
participation classification, and audit metadata in one MongoDB transaction. An
insert or metadata-save failure aborts the replacement and retains the original
rows, including their IDs and audit fields. Writes use the same session, run
sequentially, and commit with majority write concern.

The Mongoose transaction helper retries transient transaction failures and handles
commit retries. Each attempt reads the decision again within its snapshot so a
concurrent update that omits challenge answers preserves the latest accepted
answers. Conflicting updates serialize through MongoDB write conflicts; the last
successful update wins. Retrying the same replacement does not accumulate rows.

## Database requirement

Answer updates require a transaction-capable replica set or sharded cluster. A
standalone MongoDB server rejects the operation before any answer writes; there is
no unsafe fallback. The API builds its connection from the split `MONGO_SCHEME`,
`MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_HOSTNAME`, and `MONGO_DB` settings; it does
not read `MONGO_URL` or `MONGO_URI`. The worker connection helper supports those
direct connection-string overrides before falling back to the split settings.

The checked-in DigitalOcean app spec declares managed MongoDB 8 with an SRV
address, but that config alone does not verify the deployed topology. Verify
transaction support in the target environment before rolling out this change.
No deployment or production database checks are part of this fix.

## Regression verification

Tests create disposable MongoDB instances using `mongodb-memory-server`, never the
application connection string. The test helper supports an opt-in replica set and
uses WiredTiger for compatibility with modern MongoDB. Run:

```sh
MONGOMS_VERSION=8.0.15 node --require ./test/helpers/env.js --test --test-concurrency=1 --test-force-exit services/decision/decision.atomic.integration.test.js
```

Coverage includes successful and repeated replacement, empty replacement, delete
failure, real database rejection of all inserts, a partial ordered-insert failure, a real database rejection of the
metadata update, abort after metadata save, visibility to outside readers,
transient retries, deterministic concurrent updates, and safe standalone failure.
The existing decision and grading integration suites use replica sets because
they exercise answer updates.
