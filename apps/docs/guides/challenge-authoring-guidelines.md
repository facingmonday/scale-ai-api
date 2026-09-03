# Challenge Authoring Guidelines

<!-- markdownlint-disable MD013 -->

## Purpose

SCALE challenges should feel like a business simulation rather than a worksheet with one correct answer. Every student experiences the same external event, but their results can differ because of profile economics, customer fit, pricing, preparation, inventory, production capacity, channel choices, and bounded simulation variability.

This guide explains how to create challenges, questions, and outcomes that produce results that are fair, explainable, and connected to the lesson being taught.

## Core design principle

Separate the simulation into three layers:

1. **The challenge** describes the uncertain situation students must respond to.
2. **The outcome** establishes the external conditions that actually occurred.
3. **The calculation** applies those conditions to each student's profile and decisions.

The outcome is shared. The result is individual.

```text
Shared challenge outcome
        +
Profile configuration
        +
Student decisions
        +
Inventory and prior ledger state
        =
Individual student result
```

Do not put a completed student result into the shared outcome. For example, the outcome may establish that a campaign generated strong but uneven demand. It should not say that every store sold 120 units.

## What should be the same for every student

The outcome should establish external facts such as:

- Weather, traffic, event attendance, or market conditions.
- The size of an engagement or opportunity pool.
- Supplier reliability, lead time, and rush premiums.
- Delivery-platform commission and payment timing.
- Tariffs, shipping costs, border delays, or contract terms.
- A bounded demand or conversion range.
- The availability of emergency replenishment.
- A documented disruption or market-wide random event.

These conditions should not change because a student forecasted differently.

## What should vary by student

The calculation should determine individual results from:

- Profile type and customer fit.
- Baseline selling price and the student's pricing adjustment.
- Beginning inventory and accepted replenishment.
- Production intensity and production capacity.
- Supplier commitments.
- Delivery-platform participation.
- Waste discipline and service priorities.
- Available cash and prior-period ledger state.
- Bounded variability allowed by the outcome.

Student forecasts are planning inputs. They may affect purchasing or preparation, but they must never become the realized market condition.

## Challenge creation workflow

### 1. Define the learning objective

Start with one primary lesson and, at most, one or two supporting tradeoffs.

Examples:

- Forecast uncertainty versus overstock risk.
- Service level versus operating cost.
- Direct sales versus a commissioned delivery platform.
- Contract growth versus capacity constraints.
- Lower prices and higher volume versus higher prices and lower volume.
- Cash timing versus accounting profit.

If a challenge tries to teach every supply-chain concept at once, the result becomes difficult to explain and difficult to calibrate.

### 2. Identify the decisions students can control

Every question should change something in the calculation or the evaluation of the result.

For each question, document:

| Question | Student controls | Expected calculation effect |
| --- | --- | --- |
| Expected conversion | Forecast and preparation | May affect commitments; never sets realized demand |
| Supplier commitment | Inventory availability and exposure | Changes received inventory, rush need, holding, or cash risk |
| Platform participation | Channel access | Changes reachable demand and platform commission |
| Pricing adjustment | Unit price | Changes revenue per sale and price-adjusted demand |
| Cash reserve | Liquidity policy | Changes ability to fund commitments when the model supports cash timing |
| Production intensity | Planned production | Caps how much available demand can be fulfilled |

Do not ask a question if its answer is used only in the narrative. Either connect it to a calculation rule or remove it from the challenge.

### 3. Confirm the platform can represent the lesson

Use only concepts supported by the configured metrics and ledger state.

For example, a seven-day platform payment delay cannot be fully represented by `cashBefore`, `netProfit`, and `cashAfter` alone when the required rule is:

```text
cashAfter = cashBefore + netProfit
```

Accurately teaching that delay requires an accounts-receivable or pending-cash metric. Until that exists, payment delay should be framed as qualitative liquidity risk rather than deducted as an expense.

Likewise, a firm supplier commitment may create inventory and cash exposure without immediately becoming a profit-and-loss expense. Make sure the configured metrics can distinguish purchasing, consumption, inventory value, and cash timing before making that distinction central to the challenge.

### 4. Review the profile types

Before publishing, compare each profile type's:

- Starting balance.
- Initial startup cost.
- Opening cash after startup cost.
- Selling price.
- Direct material cost per finished item.
- Inventory capacities.
- Goods-per-unit output rates.
- Maximum finished-goods capacity.
- Holding costs.
- Expected customer fit for the challenge.

Calculate direct material cost per finished item as:

```text
refrigerated unit cost / refrigerated goods per unit
+ ambient unit cost / ambient goods per unit
+ operating-supply unit cost / operating-supply goods per unit
```

Calculate the inventory-supported production ceiling as:

```text
floor(
  minimum of:
    refrigerated units available * refrigerated goods per unit,
    ambient units available * ambient goods per unit,
    operating-supply units available * operating-supply goods per unit
)
```

Descriptions and numeric settings must agree. A profile described as "low volume" should not have a higher production ceiling than a kiosk, truck, or cart unless there is a documented reason.

## Outcome authoring guide

### Public outcome notes

Public notes explain what happened in the market. They should be understandable to students after feedback is released.

Include:

- The external event that occurred.
- Market-wide conditions.
- Supplier or channel behavior.
- Prices, commissions, premiums, delays, and other shared terms.
- A qualitative explanation that stores may perform differently.

Do not include:

- A universal sales total.
- A universal conversion rate when stores are supposed to differ.
- A student's accepted order quantity.
- A production amount that should be calculated from capacity.
- Instructions telling the model to ignore profile configuration.
- Internal implementation language or formulas that students should not see.

### Hidden notes

Hidden notes are optional. Leave them empty when the public outcome already supplies everything the calculation needs.

Use hidden notes only for concise instructor-approved calculation boundaries that should not be displayed to students, such as:

- The bounds of a demand range.
- How profile fit should influence placement within a range.
- Which event costs are authoritative.
- Whether a delay or disruption occurred.
- The order in which demand, price, inventory, and capacity constraints apply.

Hidden notes should not become a second system prompt. Stable formulas, inventory rules, pricing rules, and cost guardrails belong in classroom system prompts so they apply consistently to every challenge.

### Shared conditions versus individual results

A good outcome says:

> The campaign remained strong, but customer conversion varied by store format, customer fit, price, and channel participation. Suppliers fulfilled firm commitments, and rush replenishment was limited and cost 15% more than normal supply.

A problematic outcome says:

> Every store converted 12% of 1,000 engagements and received 120 orders.

The first version provides shared market facts while allowing the student's profile and decisions to matter. The second version makes capacity, price, customer fit, and many challenge questions irrelevant.

### Demand ranges

When the simulation should produce different demand for different stores, specify a bounded range rather than one universal conversion rate.

Example:

```text
Before pricing, inventory, production, and capacity constraints, stores
received order opportunities equivalent to approximately 3%–15% of the
1,000 engagements.
```

The range describes **base market demand**, not final sales.

Apply calculations in this order:

1. Select base demand within the outcome range.
2. Apply customer fit and channel availability.
3. Apply price elasticity.
4. Calculate accepted and usable inventory.
5. Calculate the production ceiling.
6. Apply planned production intensity.
7. Calculate final sales.

```text
sales = floor(
  min(
    price-adjusted realized demand,
    planned production,
    inventory-supported production capacity
  )
)
```

Do not choose a demand range without comparing it with profile capacity. If the minimum demand is 80 orders but most profiles can produce only 30–60 units, demand will almost never bind. The challenge will unintentionally become only a production-intensity exercise.

### Customer and profile fit

Provide direction for placement within the range without predetermining every result.

Example:

```text
Lower-priced, high-throughput formats with strong customer fit and effective
channel participation should generally fall in the middle or upper portion
of the range. Premium, full-service formats should generally fall in the
lower or middle portion because their prices and service model reduce the
number of customers they can serve. Exceptional fit may improve placement,
but it does not remove capacity constraints.
```

Avoid vague instructions such as "use realistic demand" when the result will affect a graded or competitive leaderboard. Give the model meaningful bounds and placement factors.

### Pricing and demand

Pricing must affect both revenue per sale and the number of available orders. Otherwise, raising price becomes free profit.

Keep a stable pricing rule in the classroom system prompt. One bounded example is:

```text
priceDemandFactor =
  max(0.70, min(1.20, 1 - 1.5 * (pricingMultiplier - 1)))

priceAdjustedDemand =
  floor(baseRealizedDemand * priceDemandFactor)
```

Using that rule:

| Pricing multiplier | Demand factor |
| ---: | ---: |
| 0.90 | 1.15 |
| 1.00 | 1.00 |
| 1.10 | 0.85 |
| 1.15 | 0.775 |

The exact elasticity can be calibrated by classroom, but the direction must be consistent: higher prices generally reduce demand, while lower prices may increase demand within a reasonable cap.

### Capacity and accepted orders

Never state that a student fulfilled or sold an accepted quantity before applying capacity.

For contracts or export orders, distinguish:

```text
accepted quantity
requested quantity
producible quantity
shipped quantity
sold quantity
```

A student may accept 600 units but produce only 70. The outcome may establish the contract price, shipping cost, and late-delivery penalty. The calculation must determine how many units can actually be produced and shipped.

### Channels and commissions

Define the difference between platform availability and actual platform sales.

At minimum, specify:

- Whether platform participation expands reachable demand.
- How platform participation influences placement within the demand range.
- How the actual platform share is determined.
- That commission applies only to revenue processed through the platform.
- That a payment delay is not an additional expense.

Do not apply a 25% commission to all revenue merely because the student made 25% of capacity available through the platform.

### Supplier commitments and rush replenishment

Clarify:

- Whether firm commitments are fulfilled.
- Whether students must pay for committed but unused inventory.
- Whether unused inventory remains an asset.
- Whether rush replenishment is available.
- The exact premium and the inventory to which it applies.
- Whether supplier lead time limits usable receipts during the period.

A rush premium must apply only to affected replenishment:

```text
rush premium = rush replenishment base cost * premium percentage
```

### Randomness

Randomness should be bounded, explainable, and subordinate to student decisions.

Good randomness includes:

- Placement within an instructor-approved demand range.
- A documented one-day border delay.
- A small equipment or service disruption supported by the outcome.
- One store receiving unusually strong customer fit within established bounds.

Bad randomness includes:

- An unexplained demand pool several times larger than the shared opportunity.
- Invented costs used to force a loss.
- Ignoring capacity so one store can fulfill an impossible order.
- Giving one student a materially different external outcome without an authorized event.

Randomness can create memorable wins and losses, but every outlier should be traceable to the outcome, profile, decisions, and calculation rules.

## Example outcome: The Viral Rush

### Public notes

```text
The viral attention remained strong throughout the week, but it did not
convert into the same number of orders for every shop. Each store's realized
demand and sales depended on its business profile, customer fit, platform
participation, preparation decisions, available inventory, and production
capacity.

Third-party delivery platforms captured a meaningful share of online demand.
Platforms charged a 25% commission on orders they processed and released the
remaining proceeds after seven days.

Suppliers fulfilled each store's firm commitments. Additional rush
replenishment was available but limited and cost 15% more than normal supply.
Stores that prepared effectively were better positioned to capture the
opportunity, while stores constrained by inventory, production capacity,
channel availability, or cash could not fulfill all available demand.
```

### Example hidden notes

```text
The campaign created meaningful but uneven store-level base demand. Before
pricing, inventory, production, and capacity constraints were applied, stores
received order opportunities equivalent to approximately 3%–15% of the 1,000
engagements.

Place each store within that range based on customer fit and channel
participation. Lower-priced, high-throughput formats with strong customer fit
and effective channel participation should generally fall in the middle or
upper portion of the range. Premium, full-service formats should generally
fall in the lower or middle portion because their higher prices and slower
service reduce the number of customers they can convert. Exceptional customer
fit may improve their placement, but it must not eliminate their volume
constraints.

After selecting base demand, apply the classroom's required price-elasticity
calculation. Then apply inventory, planned production, and capacity
constraints. Student forecasts affect preparation but do not determine
realized demand.
```

## Challenge authoring worksheet

Complete this worksheet before entering the challenge into SCALE.

### Learning objective

```text
Primary lesson:
Supporting tradeoff:
What should a successful student recognize?
```

### Shared external conditions

```text
Market event:
Opportunity or demand bounds:
Supplier behavior:
Channel behavior:
Shared costs, premiums, or commissions:
Documented delay or disruption:
```

### Student decisions

```text
Decision 1:
Calculation effect:

Decision 2:
Calculation effect:

Decision 3:
Calculation effect:
```

### Profile review

```text
Lowest expected volume profile:
Highest expected volume profile:
Lowest expected margin profile:
Highest expected margin profile:
Profile with greatest cash risk:
Profile with greatest capacity risk:
```

### Expected result shape

```text
Expected sales range:
Expected Net Profit range:
Expected percentage of stores losing money:
Largest plausible positive outlier:
Largest plausible negative outlier:
Conditions required to produce either outlier:
```

If these cannot be estimated before publishing, the challenge is not ready to process an entire classroom.

## Pre-publish checklist

- [ ] The challenge has one clear primary lesson.
- [ ] Every question affects a calculation or evaluation rule.
- [ ] Student forecasts are labeled as forecasts, not realized conditions.
- [ ] Profile descriptions agree with numeric price, cost, and capacity settings.
- [ ] The outcome describes shared external conditions rather than completed student results.
- [ ] Demand bounds have been compared with every profile's production ceiling.
- [ ] Pricing changes affect both price and demand.
- [ ] Platform commission applies only to platform revenue.
- [ ] Payment delays are not treated as expenses.
- [ ] Supplier commitments and unused inventory have an explicit accounting treatment.
- [ ] Hidden notes contain only challenge-specific calculation guidance.
- [ ] Stable formulas are stored in classroom system prompts.
- [ ] System prompts do not contain duplicate sections.
- [ ] Missing-decision behavior and punishment are configured in the challenge scheduler.
- [ ] Feedback release is Manual for the first production run of a new challenge design.

## Test matrix before production

Test at least the following combinations in a development classroom:

| Profile | Preparation | Price | Platform | Expected behavior |
| --- | --- | --- | --- | --- |
| Low-price/high-volume | Low | Baseline | Low | May stock out or miss demand |
| Low-price/high-volume | High | Baseline | High | Higher volume with commission exposure |
| Premium/low-volume | Low | High | Low | Low volume; strong unit margin but limited upside |
| Premium/low-volume | High | High | High | Capacity still binds; price reduces demand |
| Any profile | High | Low | High | More demand but thinner unit margin |
| Any profile | Low | High | Low | Higher unit price but lower demand |

For every test result, verify:

- Revenue reconciles to sales and realized price.
- Sales do not exceed realized demand, planned production, or capacity.
- Inventory uses goods-per-unit as an output rate.
- Every nonzero cost has a supplied cause.
- Net Profit equals revenue minus costs.
- Cash After equals Cash Before plus Net Profit.
- The summary explains the binding constraint.

## Post-run review

Before releasing feedback, review:

- Total expected students, decisions, jobs, and ledgers.
- Failed or missing jobs.
- Minimum, maximum, average, and median Net Profit.
- Results by profile type.
- Top and bottom performers within each profile type.
- Whether one profile type dominates regardless of decisions.
- Whether higher prices were rewarded without a demand tradeoff.
- Whether demand was always above capacity and therefore irrelevant.
- Whether unexplained costs or sales outliers exist.
- Whether the teacher debrief describes correlations rather than claiming causation.

Do not rerun merely because some students lost money or because one student received a memorable but explainable result. Rerun when results came from missing shared conditions, invalid arithmetic, ignored capacity, inconsistent cash history, incomplete student processing, or configuration that made a profile structurally unable to succeed.

## Final standard

A challenge is ready when instructors can explain every material result using four things:

1. What happened in the shared outcome.
2. What kind of business the student operates.
3. What the student decided.
4. Which demand, inventory, production, price, or cost constraint became binding.

The goal is not to eliminate uncertainty. The goal is to make uncertainty bounded, consequential, and understandable.
