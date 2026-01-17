# Simulation CLI (dev tool)

Interactive CLI to create:
- a new `Classroom` inside an existing `Organization` (chosen from the selected admin’s org:admin memberships)
- a new **or existing** `Classroom` (with template applied / ensured)
- N student `Member`s + `Enrollment`s + `Store`s
- a published `Scenario` (published without save hooks to avoid notifications)
- AI-generated `Submission`s (existing functionality)
- a `ScenarioOutcome`, then triggers simulation jobs (direct or batch depending on `SIMULATION_MODE`)

Interactive options include:
- colored multiple-choice menus
- choose existing classroom vs create new
- scenario + outcome created manually or via AI structured output (requires `OPENAI_API_KEY`)

## Run

From repo root:

```bash
node ./apps/sim-cli/index.js
```

### Notes / prerequisites

- Requires Mongo env vars (same as other apps):
  - `MONGO_URL` or `MONGO_URI` (preferred), OR
  - `MONGO_SCHEME`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_HOSTNAME`, `MONGO_DB`
- To generate submissions with AI: `OPENAI_API_KEY` must be set.
- To run ledger generation in batch mode: set `SIMULATION_MODE=batch` and ensure workers are running (so the `simulation-batch` queue is processed).

### Non-interactive mode

If you’re running this from a non-interactive shell (or want defaults), use:

```bash
node ./apps/sim-cli/index.js --yes
```
