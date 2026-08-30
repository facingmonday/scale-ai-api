# Challenge 1 Remediation and Rerun Runbook

**Prepared:** August 29, 2026  
**Challenge:** The Viral Rush  
**Challenge ID:** `6a876ecafe7305697b950b19`  
**Classroom ID:** `6a871131c681ce0eaf67c5a8`  
**Expected student count:** 272

## Executive summary

Challenge 1 exposed several independent configuration and calculation problems:

- The shared outcome was not reliably included in the AI request. Student forecasts could therefore be interpreted as realized conditions.
- The legacy classroom configuration gave every profile type the same $16 selling price, even when its costs and operating model were very different.
- Week 0 ledger entries were initialized from metric defaults. Because the cash metrics defaulted to zero, Week 0 did not use each profile type's `startingBalance` and `initialStartupCost`.
- Some first-challenge calculations used a separate starting-balance fallback while others trusted the zero-valued Week 0 ledger. This produced a mixture of `$50,000` and `$0` for `cashBefore`.
- Campus Essentials was the clearest demand outlier. Its original request did not contain a usable `global_outcome`, so the model inferred a much larger demand baseline—approximately 400—rather than consistently applying the published outcome.
- The leaderboard previously emphasized a metric other than the intended competition measure. Net Profit is now the only leaderboard metric.

The remediation is to deploy the corrected calculation code, repair the 272 Week 0 records from their actual profile-type financial settings, and then use **Cancel Batch and Rerun** to replace Challenge 1 results. Feedback must remain manual until the replacement results have been validated.

## What is expected to vary—and what was defective

The simulation is not intended to give every student the same result. Profile type, capacity, preparation decisions, pricing decisions, costs, and bounded random events should produce meaningful differences.

The following variation is expected:

- Students may achieve different sales below the available demand because of production, inventory, capacity, or decision constraints.
- Profile types may have different prices, costs, capacity, and startup capital remaining after startup costs.
- A student may outperform peers because of better decisions or an explainable random event.

The following behavior was not intended:

- Students receiving different realized market conditions because their forecasts replaced the shared outcome.
- A single store using an unexplained demand baseline of approximately 400 when peers were evaluated against the published outcome.
- Fine Dining and a Campus Kiosk both being forced to use the same $16 baseline selling price.
- Week 0 ignoring the profile type's startup financial settings.
- Challenge 1 beginning with `$0` for some students and `$50,000` for others solely because two calculation paths selected different starting sources.

## Root causes

### 1. The shared outcome was missing from the effective AI context

The outcome was returned as a Mongoose document. Spreading that document did not reliably preserve `notes` and `hiddenNotes`, so the generated request could omit the `global_outcome` envelope.

At the same time, student challenge answers were included with challenge data. Without an authoritative outcome in the request, the model could treat a student's forecast as the actual conversion rate.

The original Campus Essentials request demonstrates this failure: it contained the challenge, profile, student decisions, and Week 0 metrics, but no usable `global_outcome` message. That left the model to infer demand from the challenge narrative, student inputs, and capacity examples.

### 2. The legacy profile-type selling price was uniformly $16

All built-in profile types inherited the same $16 baseline selling price. Their unit costs were not uniform, so this systematically disadvantaged higher-cost types such as Fine Dining and Upscale Bistro while benefiting lower-cost operations.

The corrected classroom configuration contains distinct baseline selling prices. An idempotent migration updates only classrooms that still match the exact legacy uniform-$16 signature, avoiding administrator-authored prices.

### 3. Week 0 used metric defaults instead of profile-type finances

Week 0 was seeded from each active metric definition's `defaultInitialValue`. Numeric metrics without an explicit initial value became zero. The old seeding code never read:

- `profileType.startingBalance`
- `profileType.initialStartupCost`

This produced:

```text
cashBefore = 0
cashAfter  = 0
```

The corrected Week 0 rule is:

```text
openingCash = startingBalance - initialStartupCost

Week 0 cashBefore = openingCash
Week 0 cashAfter  = openingCash
```

The startup cost is represented once in Week 0. It must not also be charged against Challenge 1 costs or Net Profit.

### 4. First-period cash had competing sources

Some calculation paths tried to compensate for bad Week 0 data by reading the profile's starting balance directly. Other paths used Week 0's `cashAfter`. This explains why 91 of the 272 Challenge 1 ledgers had zero opening cash while other students received the full `$50,000` balance.

The corrected design removes the special first-period fallback. Week 0 is the authoritative baseline, and all challenges follow the same continuity rule:

```text
currentChallenge.cashBefore = previousLedger.cashAfter
currentChallenge.cashAfter  = currentChallenge.cashBefore + netProfit
```

## Software corrections included in the release

The release that is deployed before the rerun must contain all of the following:

1. Outcome documents are converted to plain data without losing `notes` or `hiddenNotes`.
2. Student challenge answers are sent as `student_challenge_answers`, separate from challenge facts.
3. The system policy explicitly states that student forecasts are not realized conditions and that `global_outcome` is authoritative.
4. Sales are constrained by realized demand, planned production, and production capacity.
5. The known uniform-$16 profile-type configuration is repaired without overwriting custom administrator pricing.
6. Net Profit is the sole leaderboard metric.
7. New Week 0 entries use `startingBalance - initialStartupCost` for both cash metrics.
8. Direct and batch simulations enforce cash continuity from `priorMetrics.cashAfter`.
9. `cashAfter` is deterministically enforced as `cashBefore + netProfit`.
10. The teacher UI explains that starting balance is capital before the one-time startup deduction.
11. The first-period-only cash snapshot and fallback logic have been removed.

Focused verification for these changes currently passes 23 backend tests and the teacher web application build.

## Important effect on Campus Essentials

The Week 0 repair alone does **not** alter Campus Essentials' revenue, costs, or Net Profit. It only repairs opening and ending cash.

The Challenge 1 rerun is what addresses its large profit gap. The corrected request will include the same global outcome used for the other students, keep the student's forecast separate, apply capacity-aware sales rules, and use the corrected Campus Kiosk selling price. Campus Essentials may still perform better or worse than another student for legitimate reasons, but it should not receive a unique approximately-400-unit demand baseline.

## Production procedure

Complete the following steps in order. Do not combine the validation and mutation scripts into one execution.

### Change-window checklist

- [ ] Assign one person to run the database steps and one person to review the output.
- [ ] Confirm Challenge 1 is not currently processing.
- [ ] Confirm the Challenge 1 outcome is saved and contains the intended public and hidden conditions.
- [ ] Confirm the expected population is 272 students.
- [ ] Confirm no Challenge 2 results have been calculated.
- [ ] Record the API and worker release identifier that will be deployed.
- [ ] Keep feedback set to Manual until all post-rerun checks pass.

### Step 1: Create a full database backup

Create a provider-level snapshot or full logical backup before deploying or modifying data. Record:

- Backup identifier
- Creation time
- Database/cluster name
- Person who verified the backup
- Restore instructions or retention period

The targeted ledger backup collections created below are useful for comparison and investigation, but they are **not** a replacement for a full database backup. Restoring Challenge 1 involves related jobs, decisions, ledger references, batches, and notification state—not only ledger entries.

### Step 2: Set Challenge 1 feedback to Manual

In the teacher Challenge 1 settings, set the feedback release mode to **Manual** before starting the rerun.

Why this matters:

- With Immediate feedback, every replacement ledger can generate a second result notification/email.
- With Manual feedback, ledger creation skips immediate notification.
- Do not release feedback until the replacement ledgers have passed the validation steps below.

### Step 3: Merge and deploy the corrected release

Deploy the same release to both:

- API service
- Background worker service

Do not repair Week 0 and start the rerun while an older worker version is still running. An old worker can recreate the same calculation defects even when the API has been updated.

The API startup performs the guarded legacy selling-price migration. Review startup logs for migration errors. A migration log may be absent when the classroom was already repaired or did not match the exact legacy signature, so also verify the database values directly.

#### Verify the Campus Kiosk selling price

Run this read-only script in Studio 3T IntelliShell:

```javascript
var classroomId = ObjectId("6a871131c681ce0eaf67c5a8");

var campusKiosk = db.getCollection("profiletypes").findOne({
  classroomId: classroomId,
  key: "campus_kiosk"
});

if (!campusKiosk) {
  throw new Error("Campus Kiosk profile type not found");
}

var campusKioskPrices = db.getCollection("variablevalues").find(
  {
    classroomId: classroomId,
    appliesTo: "profileType",
    ownerId: campusKiosk._id,
    variableKey: {
      $in: [
        "avg-selling-price-per-unit",
        "average-selling-price-per-unit",
        "avgSellingPricePerUnit",
        "averageSellingPricePerUnit"
      ]
    }
  },
  {
    variableKey: 1,
    value: 1
  }
).toArray();

var campusEssentials = db.getCollection("profiles").findOne({
  classroomId: classroomId,
  shopName: "Campus Essentials"
});

var campusEssentialsPrices = campusEssentials
  ? db.getCollection("variablevalues").find(
    {
      classroomId: classroomId,
      appliesTo: "profile",
      ownerId: campusEssentials._id,
      variableKey: {
        $in: [
          "avg-selling-price-per-unit",
          "average-selling-price-per-unit",
          "avgSellingPricePerUnit",
          "averageSellingPricePerUnit"
        ]
      }
    },
    {
      variableKey: 1,
      value: 1
    }
  ).toArray()
  : [];

printjson({
  profileType: campusKiosk.label,
  profileTypePrices: campusKioskPrices,
  campusEssentialsFound: !!campusEssentials,
  campusEssentialsProfilePrices: campusEssentialsPrices
});
```

For the corrected built-in pizza-shop configuration, neither the Campus Kiosk profile type nor a Campus Essentials profile-level override should still use the legacy `$16` value. The configured built-in Campus Kiosk baseline is `$6`. If the classroom intentionally uses custom pricing, stop and have the instructor confirm the intended value rather than forcing the built-in value.

#### Verify the leaderboard configuration

```javascript
var classroomId = ObjectId("6a871131c681ce0eaf67c5a8");

var leaderboardMetrics = db.getCollection("metricdefinitions").find(
  {
    classroomId: classroomId,
    isActive: true,
    "displayIn.leaderboard": true
  },
  {
    key: 1,
    label: 1
  }
).toArray();

printjson(leaderboardMetrics);
```

Expected result: exactly one active leaderboard metric with key `netProfit`.

### Step 4: Run the Week 0 validation and targeted-backup script

Open Studio 3T IntelliShell. Paste and run this script by itself.

This script is read-only against existing records. Its only writes are two new backup collections. It intentionally stops if:

- The challenge does not exist.
- The Week 0 count is not exactly 272.
- A profile cannot be joined to a valid profile type.
- A financial setting is absent or invalid.
- A student has more than one Week 0 record.
- A later-challenge ledger already exists.
- Either targeted backup collection name already exists.

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");
var expectedCount = 272;
var backupSuffix = "20260828_before_challenge1_rerun";
var week0Backup = "ledgerentries_week0_backup_" + backupSuffix;
var challenge1Backup = "ledgerentries_challenge1_backup_" + backupSuffix;

var challenge = db.getCollection("challenges").findOne({
  _id: challengeId
});

if (!challenge) {
  throw new Error("Challenge not found");
}

var classroomId = challenge.classroomId;

var laterLedgerCount = db.getCollection("ledgerentries").find({
  classroomId: classroomId,
  challengeId: {
    $nin: [null, challengeId]
  }
}).count();

if (laterLedgerCount !== 0) {
  throw new Error(
    "Found " + laterLedgerCount +
    " later-challenge ledgers. Stop: their cash may depend on Challenge 1."
  );
}

var duplicateWeek0Users = db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      classroomId: classroomId,
      challengeId: null
    }
  },
  {
    $group: {
      _id: "$userId",
      count: { $sum: 1 }
    }
  },
  {
    $match: {
      count: { $ne: 1 }
    }
  }
]).toArray();

if (duplicateWeek0Users.length !== 0) {
  printjson(duplicateWeek0Users);
  throw new Error("Duplicate Week 0 records found. Stop without updating.");
}

function loadWeek0Rows() {
  return db.getCollection("ledgerentries").aggregate([
    {
      $match: {
        classroomId: classroomId,
        challengeId: null
      }
    },
    {
      $lookup: {
        from: "profiles",
        localField: "profileId",
        foreignField: "_id",
        as: "profile"
      }
    },
    {
      $unwind: {
        path: "$profile",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "profiletypes",
        localField: "profile.profileType",
        foreignField: "_id",
        as: "profileType"
      }
    },
    {
      $unwind: {
        path: "$profileType",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        ledgerId: "$_id",
        profileId: 1,
        userId: 1,
        profileTypeId: "$profileType._id",
        profileTypeLabel: "$profileType.label",
        startingBalance: "$profileType.startingBalance",
        initialStartupCost: "$profileType.initialStartupCost",
        currentCashBefore: "$metrics.cashBefore",
        currentCashAfter: "$metrics.cashAfter"
      }
    }
  ]).toArray();
}

var rows = loadWeek0Rows();

print("Week 0 records found: " + rows.length);

if (rows.length !== expectedCount) {
  throw new Error(
    "Expected " + expectedCount +
    " Week 0 records but found " + rows.length +
    ". Stop without updating."
  );
}

var invalid = rows.filter(function(row) {
  return !row.profileTypeId ||
    row.startingBalance === null ||
    row.startingBalance === undefined ||
    row.initialStartupCost === null ||
    row.initialStartupCost === undefined ||
    !isFinite(Number(row.startingBalance)) ||
    !isFinite(Number(row.initialStartupCost));
});

if (invalid.length > 0) {
  printjson(invalid.slice(0, 20));
  throw new Error(
    "Some profiles are missing valid profile-type financial settings. " +
    "Stop without updating."
  );
}

var summary = {};

rows.forEach(function(row) {
  var label = row.profileTypeLabel || String(row.profileTypeId);
  var openingCash = Math.round(
    (Number(row.startingBalance) - Number(row.initialStartupCost)) * 100
  ) / 100;

  if (!summary[label]) {
    summary[label] = {
      count: 0,
      startingBalance: Number(row.startingBalance),
      initialStartupCost: Number(row.initialStartupCost),
      openingCash: openingCash
    };
  }

  summary[label].count++;
});

print("Opening cash by profile type:");
printjson(summary);

var existingCollections = db.getCollectionNames();

if (
  existingCollections.indexOf(week0Backup) >= 0 ||
  existingCollections.indexOf(challenge1Backup) >= 0
) {
  throw new Error(
    "A targeted backup collection already exists. " +
    "Choose a new backupSuffix before continuing."
  );
}

db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      classroomId: classroomId,
      challengeId: null
    }
  },
  {
    $out: week0Backup
  }
]).toArray();

db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      challengeId: challengeId
    }
  },
  {
    $out: challenge1Backup
  }
]).toArray();

var backupCounts = {
  week0Source: db.getCollection("ledgerentries").find({
    classroomId: classroomId,
    challengeId: null
  }).count(),
  week0Backup: db.getCollection(week0Backup).find({}).count(),
  challenge1Source: db.getCollection("ledgerentries").find({
    challengeId: challengeId
  }).count(),
  challenge1Backup: db.getCollection(challenge1Backup).find({}).count()
};

print("Targeted backup counts:");
printjson(backupCounts);

if (
  backupCounts.week0Source !== expectedCount ||
  backupCounts.week0Backup !== backupCounts.week0Source ||
  backupCounts.challenge1Backup !== backupCounts.challenge1Source
) {
  throw new Error("Backup counts do not match. Stop before repairing Week 0.");
}

print("VALIDATION AND TARGETED BACKUPS COMPLETED SUCCESSFULLY");
```

#### Required review after Step 4

Do not proceed until two people have confirmed:

- `Week 0 records found: 272`
- No later-challenge ledgers were found.
- Every profile type has a sensible `startingBalance`.
- Every profile type has the intended `initialStartupCost`.
- `openingCash` equals `startingBalance - initialStartupCost`.
- Week 0 source and backup counts match.
- Challenge 1 source and backup counts match.
- The script ends with `VALIDATION AND TARGETED BACKUPS COMPLETED SUCCESSFULLY`.

### Step 5: Run the Week 0 repair script

Clear the visible Step 4 code from the Studio 3T editor. Paste and run the following script separately.

This repair script is self-contained. It can run in a new IntelliShell session and does not depend on variables retained from Step 4.

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");
var expectedCount = 272;

var challenge = db.getCollection("challenges").findOne({
  _id: challengeId
});

if (!challenge) {
  throw new Error("Challenge not found");
}

var classroomId = challenge.classroomId;

var rows = db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      classroomId: classroomId,
      challengeId: null
    }
  },
  {
    $lookup: {
      from: "profiles",
      localField: "profileId",
      foreignField: "_id",
      as: "profile"
    }
  },
  {
    $unwind: {
      path: "$profile",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $lookup: {
      from: "profiletypes",
      localField: "profile.profileType",
      foreignField: "_id",
      as: "profileType"
    }
  },
  {
    $unwind: {
      path: "$profileType",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project: {
      ledgerId: "$_id",
      profileId: 1,
      userId: 1,
      profileTypeId: "$profileType._id",
      profileTypeLabel: "$profileType.label",
      startingBalance: "$profileType.startingBalance",
      initialStartupCost: "$profileType.initialStartupCost",
      currentCashBefore: "$metrics.cashBefore",
      currentCashAfter: "$metrics.cashAfter"
    }
  }
]).toArray();

if (rows.length !== expectedCount) {
  throw new Error(
    "Expected " + expectedCount +
    " Week 0 records but found " + rows.length +
    ". Stop without updating."
  );
}

var invalid = rows.filter(function(row) {
  return !row.profileTypeId ||
    row.startingBalance === null ||
    row.startingBalance === undefined ||
    row.initialStartupCost === null ||
    row.initialStartupCost === undefined ||
    !isFinite(Number(row.startingBalance)) ||
    !isFinite(Number(row.initialStartupCost));
});

if (invalid.length > 0) {
  printjson(invalid.slice(0, 20));
  throw new Error(
    "Invalid profile-type financial settings found. Stop without updating."
  );
}

var modified = 0;

rows.forEach(function(row) {
  var startingBalance = Number(row.startingBalance);
  var startupCost = Number(row.initialStartupCost);
  var openingCash = Math.round(
    (startingBalance - startupCost) * 100
  ) / 100;

  var result = db.getCollection("ledgerentries").updateOne(
    {
      _id: row.ledgerId,
      classroomId: classroomId,
      challengeId: null
    },
    {
      $set: {
        "metrics.cashBefore": openingCash,
        "metrics.cashAfter": openingCash,
        "calculationContext.profileVariables.startingBalance": startingBalance,
        "calculationContext.profileVariables.initialStartupCost": startupCost,
        summary: "Week 0: Profile setup — opening cash reflects starting balance minus the one-time startup cost.",
        updatedDate: new Date()
      }
    }
  );

  modified += result.modifiedCount !== undefined
    ? result.modifiedCount
    : (result.nModified || 0);
});

print("Modified Week 0 records: " + modified);

var repairedRows = db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      classroomId: classroomId,
      challengeId: null
    }
  },
  {
    $lookup: {
      from: "profiles",
      localField: "profileId",
      foreignField: "_id",
      as: "profile"
    }
  },
  {
    $unwind: "$profile"
  },
  {
    $lookup: {
      from: "profiletypes",
      localField: "profile.profileType",
      foreignField: "_id",
      as: "profileType"
    }
  },
  {
    $unwind: "$profileType"
  },
  {
    $project: {
      userId: 1,
      profileTypeLabel: "$profileType.label",
      startingBalance: "$profileType.startingBalance",
      initialStartupCost: "$profileType.initialStartupCost",
      cashBefore: "$metrics.cashBefore",
      cashAfter: "$metrics.cashAfter"
    }
  }
]).toArray();

var mismatches = repairedRows.filter(function(row) {
  var expected = Math.round(
    (Number(row.startingBalance) - Number(row.initialStartupCost)) * 100
  ) / 100;

  return Number(row.cashBefore) !== expected ||
    Number(row.cashAfter) !== expected;
});

print("Week 0 mismatches: " + mismatches.length);
printjson(mismatches.slice(0, 20));

if (mismatches.length !== 0) {
  throw new Error("Week 0 verification failed. Do not rerun Challenge 1.");
}

print("WEEK 0 REPAIR COMPLETED SUCCESSFULLY");
```

The number of modified records can be lower than 272 if any documents already contained some corrected values. The required success condition is:

```text
Week 0 mismatches: 0
WEEK 0 REPAIR COMPLETED SUCCESSFULLY
```

### Step 6: Spot-check repaired Week 0 records

Review several students from different profile types, including:

- Fine Dining
- Upscale Bistro
- Food Truck
- Street Cart
- Campus Kiosk

```javascript
var classroomId = ObjectId("6a871131c681ce0eaf67c5a8");

db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      classroomId: classroomId,
      challengeId: null
    }
  },
  {
    $lookup: {
      from: "profiles",
      localField: "profileId",
      foreignField: "_id",
      as: "profile"
    }
  },
  {
    $unwind: "$profile"
  },
  {
    $lookup: {
      from: "profiletypes",
      localField: "profile.profileType",
      foreignField: "_id",
      as: "profileType"
    }
  },
  {
    $unwind: "$profileType"
  },
  {
    $project: {
      shopName: "$profile.shopName",
      profileType: "$profileType.label",
      startingBalance: "$profileType.startingBalance",
      initialStartupCost: "$profileType.initialStartupCost",
      cashBefore: "$metrics.cashBefore",
      cashAfter: "$metrics.cashAfter"
    }
  },
  {
    $sort: {
      profileType: 1,
      shopName: 1
    }
  }
]).toArray();
```

### Step 7: Rerun Challenge 1 from the teacher screen

Use **Cancel Batch and Rerun** on Challenge 1. This is the frontend-supported action.

The action performs the following operations for Challenge 1:

1. Resets the challenge debrief state.
2. Cancels an in-progress OpenAI batch when batch mode is enabled.
3. Resets Challenge 1 simulation jobs.
4. Deletes existing ledger entries whose `challengeId` is Challenge 1.
5. Recreates Challenge 1 jobs and enqueues direct work or batch submission.
6. Returns the challenge to the calculating/processing state until the new jobs are terminal.

It does not delete the repaired Week 0 records because their `challengeId` is `null`. It also does not delete Challenge 2 submissions. Challenge 2 has not yet produced ledgers, so its eventual calculation will use the replacement Challenge 1 `cashAfter` values.

The old Challenge 1 ledgers are deleted and replacement ledger documents are created. They are not updated in place and will have new ledger `_id` values.

### Step 8: Monitor the rerun

The batch can take several hours. Check the teacher UI and, when necessary, use these read-only queries.

#### Job status counts

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");

db.getCollection("simulationjobs").aggregate([
  {
    $match: {
      challengeId: challengeId
    }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 }
    }
  },
  {
    $sort: {
      _id: 1
    }
  }
]).toArray();
```

#### Most recent batch

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");

db.getCollection("simulationbatches").find(
  {
    challengeId: challengeId
  },
  {
    status: 1,
    openaiBatchId: 1,
    error: 1,
    createdDate: 1,
    updatedDate: 1
  }
).sort({
  createdDate: -1
}).limit(1).toArray();
```

Do not release feedback while jobs are pending, running, or failed.

### Step 9: Validate all replacement Challenge 1 ledgers

Run the following after the batch is fully complete.

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");
var expectedCount = 272;

var challengeRows = db.getCollection("ledgerentries").find({
  challengeId: challengeId
}).toArray();

print("Replacement Challenge 1 ledgers: " + challengeRows.length);

if (challengeRows.length !== expectedCount) {
  throw new Error(
    "Expected " + expectedCount +
    " replacement ledgers but found " + challengeRows.length + "."
  );
}

var continuityProblems = db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      challengeId: challengeId
    }
  },
  {
    $lookup: {
      from: "ledgerentries",
      let: {
        profile: "$profileId",
        classroom: "$classroomId"
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$profileId", "$$profile"] },
                { $eq: ["$classroomId", "$$classroom"] },
                { $eq: ["$challengeId", null] }
              ]
            }
          }
        }
      ],
      as: "week0"
    }
  },
  {
    $unwind: {
      path: "$week0",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $match: {
      $expr: {
        $ne: [
          "$metrics.cashBefore",
          "$week0.metrics.cashAfter"
        ]
      }
    }
  },
  {
    $project: {
      userId: 1,
      profileId: 1,
      challengeCashBefore: "$metrics.cashBefore",
      week0CashAfter: "$week0.metrics.cashAfter"
    }
  }
]).toArray();

print("Cash continuity problems: " + continuityProblems.length);
printjson(continuityProblems.slice(0, 20));

var mathProblems = challengeRows.filter(function(entry) {
  var cashBefore = Number(entry.metrics.cashBefore);
  var cashAfter = Number(entry.metrics.cashAfter);
  var netProfit = Number(entry.metrics.netProfit);

  return !isFinite(cashBefore) ||
    !isFinite(cashAfter) ||
    !isFinite(netProfit) ||
    Math.abs(cashAfter - (cashBefore + netProfit)) > 0.005;
});

print("Cash equation problems: " + mathProblems.length);
printjson(mathProblems.slice(0, 20));

if (continuityProblems.length !== 0 || mathProblems.length !== 0) {
  throw new Error("Replacement ledger cash validation failed.");
}

print("REPLACEMENT CASH VALIDATION COMPLETED SUCCESSFULLY");
```

Required results:

```text
Replacement Challenge 1 ledgers: 272
Cash continuity problems: 0
Cash equation problems: 0
REPLACEMENT CASH VALIDATION COMPLETED SUCCESSFULLY
```

### Step 10: Verify that the corrected AI context was used

Each replacement ledger stores its calculation prompt. This check looks for an actual serialized `global_outcome` envelope, not merely the words `global_outcome` in the system policy.

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");
var expectedCount = 272;

var outcomeEnvelopePattern = /\{\\"type\\":\\"global_outcome\\"/;
var forecastEnvelopePattern = /\{\\"type\\":\\"student_challenge_answers\\"/;

var withOutcomeEnvelope = db.getCollection("ledgerentries").find({
  challengeId: challengeId,
  "calculationContext.prompt": outcomeEnvelopePattern
}).count();

var withSeparatedForecast = db.getCollection("ledgerentries").find({
  challengeId: challengeId,
  "calculationContext.prompt": forecastEnvelopePattern
}).count();

printjson({
  expected: expectedCount,
  withOutcomeEnvelope: withOutcomeEnvelope,
  withSeparatedForecast: withSeparatedForecast
});

if (withOutcomeEnvelope !== expectedCount) {
  throw new Error(
    "Not every replacement ledger contains the authoritative outcome envelope."
  );
}
```

`withOutcomeEnvelope` must equal 272. `withSeparatedForecast` should also equal the number of students who supplied challenge answers.

### Step 11: Review business results and Campus Essentials

Before releasing feedback, review distributions by profile type rather than checking only the leaderboard winner.

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");

db.getCollection("ledgerentries").aggregate([
  {
    $match: {
      challengeId: challengeId
    }
  },
  {
    $lookup: {
      from: "profiles",
      localField: "profileId",
      foreignField: "_id",
      as: "profile"
    }
  },
  {
    $unwind: "$profile"
  },
  {
    $lookup: {
      from: "profiletypes",
      localField: "profile.profileType",
      foreignField: "_id",
      as: "profileType"
    }
  },
  {
    $unwind: "$profileType"
  },
  {
    $group: {
      _id: "$profileType.label",
      students: { $sum: 1 },
      averageSales: { $avg: "$metrics.sales" },
      minimumSales: { $min: "$metrics.sales" },
      maximumSales: { $max: "$metrics.sales" },
      averageNetProfit: { $avg: "$metrics.netProfit" },
      minimumNetProfit: { $min: "$metrics.netProfit" },
      maximumNetProfit: { $max: "$metrics.netProfit" }
    }
  },
  {
    $sort: {
      _id: 1
    }
  }
]).toArray();
```

Then inspect Campus Essentials directly:

```javascript
var challengeId = ObjectId("6a876ecafe7305697b950b19");
var classroomId = ObjectId("6a871131c681ce0eaf67c5a8");

var campusProfile = db.getCollection("profiles").findOne({
  classroomId: classroomId,
  shopName: "Campus Essentials"
});

if (!campusProfile) {
  throw new Error("Campus Essentials profile not found");
}

var campusLedger = db.getCollection("ledgerentries").findOne(
  {
    challengeId: challengeId,
    profileId: campusProfile._id
  },
  {
    metrics: 1,
    summary: 1,
    randomEvent: 1,
    "calculationContext.priorMetrics": 1
  }
);

printjson({
  shopName: campusProfile.shopName,
  metrics: campusLedger ? campusLedger.metrics : null,
  summary: campusLedger ? campusLedger.summary : null,
  randomEvent: campusLedger ? campusLedger.randomEvent : null,
  priorMetrics: campusLedger
    ? campusLedger.calculationContext.priorMetrics
    : null
});
```

Review questions:

- Is Campus Essentials evaluated against the same published outcome as everyone else?
- Is any sales advantage explainable by its capacity and student decisions?
- Does its revenue reconcile with the corrected Campus Kiosk selling price?
- Does its Net Profit reconcile with revenue minus costs?
- If it has an unusual random event, is the effect bounded and understandable?
- Is there any remaining reference to an unexplained approximately-400 demand baseline in the ledger summary?

Do not require all profile types to have identical sales or profit. The goal is a shared realized environment with explainable profile and decision differences.

### Step 12: Instructor approval and feedback release

After the technical checks pass:

1. Provide the profile-type distribution and Campus Essentials spot-check to the instructor and TA.
2. Confirm the results are plausible for the scenario and lesson objectives.
3. Decide whether students should receive a correction note before feedback is released.
4. Release feedback deliberately from Manual mode when approved.
5. Expect the release action to send replacement-result notifications according to the normal manual-release behavior.

## Stop conditions

Stop the procedure and do not rerun when any of the following occurs:

- The full database backup is missing or cannot be identified.
- API and workers are not on the same corrected release.
- The Challenge 1 outcome is absent or incorrect.
- The Week 0 population is not exactly 272.
- A profile cannot be joined to its profile type.
- A profile type is missing `startingBalance` or `initialStartupCost`.
- A later-challenge ledger already exists.
- Targeted backup counts do not match source counts.
- Week 0 verification reports any mismatch.
- Feedback cannot be placed in Manual mode.
- Replacement jobs fail or produce fewer than 272 ledgers.
- Any replacement ledger fails cash continuity or cash-equation validation.
- Any replacement prompt is missing the authoritative outcome envelope.

## Rollback guidance

### Before the Challenge 1 rerun

If Week 0 validation fails after the repair, do not start the rerun. The Week 0 backup collection and full database backup remain available for recovery. Investigate the mismatch before making another change.

### After the Challenge 1 rerun

Keep feedback in Manual mode if replacement results fail review. Do **not** restore only the old Challenge 1 ledger documents without also reconciling related decision `ledgerEntryId` references, simulation jobs, batches, debrief state, and notification state.

Use the full database backup for a complete point-in-time rollback, or prepare a separately reviewed targeted rollback that accounts for every related collection. The targeted ledger backup collections are primarily evidence and comparison data.

## Communication summary for students

If an explanation is needed, use language similar to the following:

> We identified configuration and calculation inconsistencies in the first challenge. Some results did not consistently apply the shared outcome, profile-type pricing, or opening financial settings. We corrected the configuration and calculation rules and recalculated Challenge 1 using the original student submissions. The rerun preserves differences caused by profile type and student decisions while applying the same realized conditions to everyone.

Avoid describing all variation as a defect. The intended experience still includes strategic trade-offs, profile-type strengths and weaknesses, and explainable uncertainty.

## Final sign-off record

Record the following when the procedure is complete:

```text
Full backup ID:
API release:
Worker release:
Database operator:
Reviewing operator:
Week 0 source/backup count:
Challenge 1 source/backup count:
Week 0 mismatch count:
Replacement ledger count:
Cash continuity problem count:
Cash equation problem count:
Outcome-envelope count:
Campus Essentials reviewed by:
Instructor approval:
Feedback released at:
```

Moving Forward, the plan is to confirm the full database backup, keep Challenge 1 feedback set to Manual, deploy the corrected API and worker release, validate and repair the 272 Week 0 records, rerun Challenge 1 using the original student submissions, and review the replacement results—including Campus Essentials—before releasing feedback. The procedure includes validation and stop conditions at each stage so we can pause without exposing incomplete results if anything does not match expectations. If everyone agrees with this approach, should I proceed with the remediation and rerun?
