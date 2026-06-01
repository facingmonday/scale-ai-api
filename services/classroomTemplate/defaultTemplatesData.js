module.exports = [
  {
    key: "default_digital_marketing_101",
    label: "Digital Marketing",
    description: "Focuses on organic and paid web traffic, SEO indicators, conversion rates, and email campaign analytics.",
    profileTypes: [
      { key: "solo_blogger", label: "Solo Blogger", description: "Content creator focused on organic search optimization and email subscriptions.", startingBalance: 500, initialStartupCost: 100, isActive: true },
      { key: "ecom_brand", label: "E-Commerce Brand", description: "Online store using paid advertisements, social channels, and search ranking.", startingBalance: 5000, initialStartupCost: 1500, isActive: true },
      { key: "lead_gen_agency", label: "Lead Gen Agency", description: "B2B agency focusing on marketing qualified leads and landing page conversions.", startingBalance: 10000, initialStartupCost: 2000, isActive: true }
    ],
    metrics: [
      "organicTraffic", "paidTraffic", "socialTraffic", "emailTraffic", "searchRank", "keywordRankingScore",
      "backlinks", "domainAuthorityScore", "landingPageConversionRate", "bounceRate", "averageSessionDuration",
      "adSpend",
      { key: "costPerClick", description: "Average cost per click for paid traffic.", aiPromptRule: "Must equal adSpend / paidTraffic. Capped between $0.10 and $10.00. Set to 0 if paidTraffic is 0." },
      "costPerThousandImpressions",
      { key: "clickThroughRate", description: "Ad click-through rate.", aiPromptRule: "Ad clicks (paidTraffic) divided by ad impressions. Must be a decimal between 0 and 1 (e.g. 0.024 for 2.4%)." },
      { key: "leadConversionRate", description: "Landing page to lead conversion rate.", aiPromptRule: "Decimal between 0 and 1 representing the rate at which visitors become leads." },
      "emailOpenRate", "emailClickRate", "unsubscribeRate",
      { key: "returnOnAdSpend", description: "Return on ad spend (ROAS).", aiPromptRule: "Revenue from paid search divided by adSpend. Return 0 if adSpend is 0." },
      { key: "marketingQualifiedLeads", description: "Total marketing qualified leads generated.", aiPromptRule: "Total traffic (sum of organic, paid, social, email traffic) multiplied by landingPageConversionRate, rounded to a whole integer." }
    ]
  },
  {
    key: "default_entrepreneurship_101",
    label: "Entrepreneurship",
    description: "Covers startup cash flow, runway, gross/net profits, churn, CAC, and investor sentiment.",
    profileTypes: [
      { key: "bootstrap_startup", label: "Bootstrapped Startup", description: "Self-funded venture focusing heavily on early profitability and cash on hand.", startingBalance: 2000, initialStartupCost: 500, isActive: true },
      { key: "venture_backed", label: "Venture-Backed Startup", description: "High-growth potential company with VC funding and runway constraints.", startingBalance: 50000, initialStartupCost: 10000, isActive: true }
    ],
    metrics: [
      "cashOnHand", "monthlyRevenue", "monthlyExpenses", "grossProfit",
      { key: "netProfit", description: "Net profit this period.", aiPromptRule: "Must equal monthlyRevenue - monthlyExpenses. Represents the net bottom-line profit or loss." },
      "customerCount", "newCustomers", "returningCustomers",
      { key: "customerAcquisitionCost", description: "Average customer acquisition cost.", aiPromptRule: "Calculated as marketingSpend / newCustomers. Set to 0 if newCustomers is 0." },
      "customerLifetimeValue", "churnRate",
      "productUnitsSold", "marketShareScore", "brandReputationScore", "investorConfidenceScore",
      "teamMoraleScore", "operationalCapacity",
      { key: "runwayMonths", description: "Estimated runway in months.", aiPromptRule: "Calculated as cashOnHand / monthlyExpenses (or cashOnHand / netLoss if netProfit is negative). If netProfit is positive, return 999." },
      { key: "valuationEstimate", description: "Estimated market valuation.", aiPromptRule: "Rough enterprise valuation. Can be calculated as monthlyRevenue * 12 * valuationMultiple (based on growth rate and customer base)." },
      "riskScore"
    ]
  },
  {
    key: "default_intro_to_business_101",
    label: "Intro to Business",
    description: "Teaches the basic foundations of business operation, including sales, assets, debt, equity, and satisfaction scores.",
    profileTypes: [
      { key: "sole_proprietorship", label: "Sole Proprietorship", description: "A business owned and run by one person.", startingBalance: 1000, initialStartupCost: 200, isActive: true },
      { key: "partnership", label: "Partnership", description: "A business structure owned by two or more partners sharing profits.", startingBalance: 5000, initialStartupCost: 1000, isActive: true },
      { key: "corporation", label: "Corporation", description: "A complex business entity legally separate from its owners.", startingBalance: 25000, initialStartupCost: 5000, isActive: true }
    ],
    metrics: [
      "sales", "revenue", "expenses",
      { key: "profit", description: "Net profit this period.", aiPromptRule: "Must equal revenue - expenses." },
      { key: "cashBalance", description: "Cash balance after operations.", aiPromptRule: "Carry-forward balance: previous cashBalance + profit." },
      "inventoryLevel", "customerSatisfaction",
      "employeeSatisfaction", "marketDemand", "brandAwareness", "operatingEfficiency", "debt", "assets",
      "liabilities",
      { key: "equity", description: "Owner equity.", aiPromptRule: "Must satisfy the accounting equation: assets - liabilities." },
      "growthRate", "riskScore", "decisionQualityScore"
    ]
  },
  {
    key: "default_accounting_101",
    label: "Accounting",
    description: "Double-entry indicators, receivables/payables, inventory valuations, COGS, net income, and ratios.",
    profileTypes: [
      { key: "retail_store", label: "Retail Store", description: "Product seller dealing with inventory value and cost of goods sold.", startingBalance: 5000, initialStartupCost: 1000, isActive: true },
      { key: "service_provider", label: "Service Provider", description: "Consultancy or service business dealing primarily with receivables and payables.", startingBalance: 3000, initialStartupCost: 500, isActive: true }
    ],
    metrics: [
      "cash", "accountsReceivable", "accountsPayable", "inventoryValue", "revenue", "costOfGoodsSold",
      { key: "grossProfit", description: "Gross profit this period.", aiPromptRule: "Must equal revenue - costOfGoodsSold." },
      "operatingExpenses",
      { key: "netIncome", description: "Net income this period.", aiPromptRule: "Must equal grossProfit - operatingExpenses." },
      "assets", "liabilities",
      { key: "equity", description: "Total equity.", aiPromptRule: "Must equal assets - liabilities." },
      "debt", "cashFlow", "profitMargin",
      { key: "currentRatio", description: "Current ratio (liquidity metric).", aiPromptRule: "Calculated as currentAssets / currentLiabilities. Keep to 2 decimal places." },
      "breakEvenPoint", "budgetVariance", "taxLiability",
      { key: "retainedEarnings", description: "Cumulative retained earnings.", aiPromptRule: "Carry-forward balance: previous retainedEarnings + netIncome - dividendsPaid." }
    ]
  },
  {
    key: "default_finance_101",
    label: "Finance",
    description: "Capital budgeting, NPV/IRR, liquidity, return on equity, and enterprise valuation.",
    profileTypes: [
      { key: "corporate_finance", label: "Corporate Finance", description: "Corporate treasury management and capital allocation.", startingBalance: 15000, initialStartupCost: 3000, isActive: true },
      { key: "investment_fund", label: "Investment Fund", description: "Managing portfolio values and risk exposures.", startingBalance: 100000, initialStartupCost: 5000, isActive: true }
    ],
    metrics: [
      "cashBalance", "portfolioValue", "investmentReturn", "debtBalance", "interestExpense", "operatingCashFlow",
      "freeCashFlow", "netPresentValue", "internalRateOfReturn", "riskExposure", "creditScore", "profitMargin",
      "returnOnInvestment", "returnOnEquity", "liquidityRatio", "debtToEquityRatio", "burnRate", "runwayMonths",
      "valuation", "shareholderValue"
    ]
  },
  {
    key: "default_personal_finance_101",
    label: "Personal Finance",
    description: "Teaches budgeting, savings rate, emergency funds, debt management, and net worth calculations.",
    profileTypes: [
      { key: "college_student", label: "College Student", description: "Student managing part-time income, textbooks, and tuition expenses.", startingBalance: 200, initialStartupCost: 0, isActive: true },
      { key: "young_professional", label: "Young Professional", description: "Individual establishing career earnings, housing costs, and investments.", startingBalance: 2000, initialStartupCost: 500, isActive: true },
      { key: "retiree", label: "Retiree", description: "Individual drawing down checking balances and managing retirement savings.", startingBalance: 50000, initialStartupCost: 0, isActive: true }
    ],
    metrics: [
      "income", "expenses", "savings", "checkingBalance", "emergencyFund", "debtBalance", "creditScore",
      "monthlyCashFlow", "investmentBalance", "retirementSavings", "housingCost", "transportationCost",
      "foodCost", "insuranceCost", "interestPaid", "netWorth", "savingsRate", "debtToIncomeRatio",
      "financialStressScore", "goalProgress"
    ]
  },
  {
    key: "default_economics_101",
    label: "Economics",
    description: "Teaches market supply/demand, price equilibrium, surplus levels, and macro indicators.",
    profileTypes: [
      { key: "monopoly_firm", label: "Monopoly Firm", description: "Single seller controlling prices and maximizing producer surplus.", startingBalance: 10000, initialStartupCost: 2000, isActive: true },
      { key: "competitive_firm", label: "Competitive Firm", description: "Price-taking firm operating in a perfectly competitive market.", startingBalance: 2000, initialStartupCost: 500, isActive: true }
    ],
    metrics: [
      "price", "quantityDemanded", "quantitySupplied", "marketDemand", "marketSupply", "consumerSurplus",
      "producerSurplus", "shortageAmount", "surplusAmount", "inflationRate", "unemploymentRate",
      "interestRate", "gdpContribution", "taxRevenue", "governmentSpending", "marketShare", "priceElasticity",
      "profit", "welfareScore", "efficiencyScore"
    ]
  },
  {
    key: "default_operations_management_101",
    label: "Operations Management",
    description: "Capacity utilization, throughput, cycle/lead times, defect rates, and stockouts.",
    profileTypes: [
      { key: "job_shop", label: "Job Shop", description: "Low volume, high variety production setup.", startingBalance: 5000, initialStartupCost: 1500, isActive: true },
      { key: "assembly_line", label: "Assembly Line", description: "High volume, standardized product manufacturing.", startingBalance: 20000, initialStartupCost: 5000, isActive: true }
    ],
    metrics: [
      "unitsProduced", "unitsSold", "capacityUtilization", "throughput", "cycleTime", "leadTime",
      "backlog", "defectRate", "qualityScore", "laborHours", "laborCost", "materialCost",
      "operatingCost", "inventoryLevel", "stockouts", "waste", "onTimeDeliveryRate", "customerSatisfaction",
      "netProfit", "efficiencyScore"
    ]
  },
  {
    key: "default_logistics_101",
    label: "Logistics",
    description: "Shipping costs, warehouse costs, delivery speed, routing efficiency, and carbon emissions.",
    profileTypes: [
      { key: "regional_carrier", label: "Regional Carrier", description: "Courier or truckload company serving a localized area.", startingBalance: 8000, initialStartupCost: 2000, isActive: true },
      { key: "freight_forwarder", label: "Freight Forwarder", description: "Managing multi-modal shipments and delivery capacities globally.", startingBalance: 30000, initialStartupCost: 6000, isActive: true }
    ],
    metrics: [
      "ordersShipped", "ordersDelivered", "onTimeDeliveryRate", "lateDeliveries", "shippingCost", "fuelCost",
      "warehouseCost", "deliveryDistance", "routeEfficiency", "vehicleUtilization", "laborHours",
      "damagedShipments", "lostShipments", "customerSatisfaction", "carbonEmissions", "inventoryInTransit",
      "deliveryCapacity", "backlog", "profit", "serviceLevel"
    ]
  },
  {
    key: "default_hospitality_management_101",
    label: "Hospitality / Restaurant Management",
    description: "Guest turnover, ticket size, beverage/food cost percentages, review scores, and table turnover rates.",
    profileTypes: [
      { key: "fast_casual", label: "Fast Casual", description: "Quick service eatery prioritizing speed and order counts.", startingBalance: 6000, initialStartupCost: 2000, isActive: true },
      { key: "fine_dining", label: "Fine Dining", description: "Sit-down restaurant focusing on average ticket size and reservation rates.", startingBalance: 18000, initialStartupCost: 5000, isActive: true }
    ],
    metrics: [
      "guestCount", "reservations", "walkIns", "tableTurnoverRate", "averageTicketSize", "foodRevenue",
      "beverageRevenue", "laborCost", "foodCost", "wasteCost", "inventoryValue", "customerSatisfaction",
      "reviewScore", "staffMorale", "serviceSpeed", "capacityUtilization", "profitMargin", "netProfit",
      "reputationScore", "repeatGuestRate"
    ]
  },
  {
    key: "default_event_management_101",
    label: "Event Management",
    description: "Ticket check-ins, sponsor support, venue costs, staffing levels, and social media mentions.",
    profileTypes: [
      { key: "concert_promoter", label: "Concert Promoter", description: "Organizing music events, managing tickets sold and marketing costs.", startingBalance: 12000, initialStartupCost: 3500, isActive: true },
      { key: "conference_planner", label: "Conference Planner", description: "Corporate event organizer with sponsor revenue and vendor costs.", startingBalance: 25000, initialStartupCost: 8000, isActive: true }
    ],
    metrics: [
      "ticketsSold", "attendance", "grossRevenue", "sponsorRevenue", "vendorCosts", "staffingCosts",
      "marketingCosts", "netProfit", "checkInRate", "noShowRate", "guestSatisfaction", "sponsorSatisfaction",
      "volunteerHours", "capacityUtilization", "eventReputationScore", "socialMentions", "safetyIncidents",
      "operationalIssues", "weatherImpactScore", "postEventLeads"
    ]
  },
  {
    key: "default_agribusiness_101",
    label: "Agribusiness",
    description: "Crop yields, livestock outputs, fertilizers, sustainability metrics, and weather impacts.",
    profileTypes: [
      { key: "family_farm", label: "Family Farm", description: "Small-scale crop and livestock production with tight soil health constraints.", startingBalance: 4000, initialStartupCost: 1000, isActive: true },
      { key: "corporate_coop", label: "Corporate Co-Op", description: "Large-scale agriculture operation utilizing land and massive fuel/seed allocations.", startingBalance: 35000, initialStartupCost: 10000, isActive: true }
    ],
    metrics: [
      "cropYield", "livestockOutput", "marketPrice", "salesRevenue", "seedCost", "feedCost", "fertilizerCost",
      "laborCost", "equipmentCost", "waterUsage", "fuelCost", "landUtilization", "inventoryOnHand", "waste",
      "weatherImpact", "profit", "soilHealthScore", "sustainabilityScore", "riskScore", "cashBalance"
    ]
  },
  {
    key: "default_environmental_science_101",
    label: "Environmental Science / Sustainability",
    description: "Resource usage, divergence tracking, compliance costs, carbon levels, and public approval.",
    profileTypes: [
      { key: "eco_consultancy", label: "Eco Consultancy", description: "Helping businesses reduce energy and waste footprints.", startingBalance: 3000, initialStartupCost: 500, isActive: true },
      { key: "conservation_ngo", label: "Conservation NGO", description: "Direct advocacy and environmental impact tracking.", startingBalance: 6000, initialStartupCost: 1000, isActive: true }
    ],
    metrics: [
      "resourceUsage", "waterUsage", "energyUsage", "carbonEmissions", "wasteGenerated", "wasteDiverted",
      "recyclingRate", "biodiversityScore", "sustainabilityScore", "costOfCompliance", "environmentalImpactScore",
      "communityApprovalScore", "policyEffectiveness", "pollutionLevel", "conservationProgress", "operatingCost",
      "longTermRiskScore", "resilienceScore"
    ]
  },
  {
    key: "default_public_administration_101",
    label: "Public Administration",
    description: "Budget allocations, civic compliance, citizen satisfaction, and service delivery backlog.",
    profileTypes: [
      { key: "municipal_dept", label: "Municipal Department", description: "Local city services managing local staff and tax revenues.", startingBalance: 20000, initialStartupCost: 0, isActive: true },
      { key: "federal_program", label: "Federal Program", description: "National initiatives supported by federal grants and policy outcomes.", startingBalance: 150000, initialStartupCost: 0, isActive: true }
    ],
    metrics: [
      "budgetAllocated", "budgetSpent", "budgetRemaining", "citizensServed", "serviceQualityScore",
      "publicApprovalScore", "staffingLevel", "programCost", "programImpactScore", "equityScore",
      "responseTime", "backlog", "complianceScore", "riskScore", "taxRevenue", "grantFunding",
      "operationalEfficiency", "communityTrustScore", "policyOutcomeScore"
    ]
  },
  {
    key: "default_civics_government_101",
    label: "Civics / Government",
    description: "Political approval, education, voter turnout, safety scores, and long-term public safety metrics.",
    profileTypes: [
      { key: "local_council", label: "Local Council", description: "City or county municipal representatives.", startingBalance: 15000, initialStartupCost: 0, isActive: true },
      { key: "national_assembly", label: "National Assembly", description: "Legislative body managing national spending and structural deficits.", startingBalance: 500000, initialStartupCost: 0, isActive: true }
    ],
    metrics: [
      "publicApproval", "taxRevenue", "publicSpending", "budgetBalance", "citizenSatisfaction", "infrastructureScore",
      "educationScore", "publicSafetyScore", "healthcareAccessScore", "housingAccessScore", "employmentRate",
      "equityScore", "policySupport", "voterTurnout", "communityTrust", "serviceDeliveryScore", "deficit",
      "surplus", "longTermStabilityScore"
    ]
  },
  {
    key: "default_healthcare_administration_101",
    label: "Healthcare Administration",
    description: "Patient satisfaction, clinic throughput, readmission rates, and care compliance indicators.",
    profileTypes: [
      { key: "family_clinic", label: "Family Clinic", description: "Local medical office offering routine checkups and patient consults.", startingBalance: 10000, initialStartupCost: 3000, isActive: true },
      { key: "regional_hospital", label: "Regional Hospital", description: "Emergency and major care medical facility with massive supply costs.", startingBalance: 80000, initialStartupCost: 20000, isActive: true }
    ],
    metrics: [
      "patientsServed", "patientSatisfaction", "averageWaitTime", "staffUtilization", "supplyInventory",
      "supplyCosts", "laborCosts", "operatingCosts", "revenue", "netMargin", "readmissionRate",
      "careQualityScore", "complianceScore", "appointmentCapacity", "missedAppointments", "emergencyCases",
      "resourceShortages", "burnoutScore", "healthOutcomeScore"
    ]
  },
  {
    key: "default_public_health_101",
    label: "Public Health",
    description: "Vaccination rates, community outreach outreach, recovery metrics, and county infection rates.",
    profileTypes: [
      { key: "county_health_board", label: "County Health Board", description: "Regional health oversight and population health metrics.", startingBalance: 12000, initialStartupCost: 0, isActive: true },
      { key: "outreach_campaign", label: "Outreach Campaign", description: "Targeted health programs in the community.", startingBalance: 3000, initialStartupCost: 0, isActive: true }
    ],
    metrics: [
      "populationReached", "casesPrevented", "infectionRate", "vaccinationRate", "awarenessScore", "programCost",
      "staffingLevel", "supplyLevel", "responseTime", "communityTrustScore", "healthOutcomeScore", "riskLevel",
      "equityScore", "hospitalCapacity", "publicComplianceRate", "outreachEffectiveness", "incidentCount",
      "mortalityRate", "recoveryRate"
    ]
  },
  {
    key: "default_project_management_101",
    label: "Project Management",
    description: "Scope changes, project health, team morale, defects, and calendar delay tracking.",
    profileTypes: [
      { key: "agile_team", label: "Agile Software Team", description: "Software crew delivering iteratively and managing story point capacity.", startingBalance: 4000, initialStartupCost: 0, isActive: true },
      { key: "waterfall_corp", label: "Waterfall Corp Project", description: "Large infrastructure planning with complex budgets and schedules.", startingBalance: 45000, initialStartupCost: 10000, isActive: true }
    ],
    metrics: [
      "budgetPlanned", "budgetSpent", "budgetRemaining", "tasksCompleted", "tasksDelayed", "scopeChangeCount",
      "teamCapacity", "teamMorale", "qualityScore", "riskScore", "timelineProgress", "deadlineVariance",
      "resourceUtilization", "stakeholderSatisfaction", "defectCount", "reworkHours", "deliveryConfidence",
      "projectHealthScore"
    ]
  },
  {
    key: "default_software_development_101",
    label: "Software Development",
    description: "Story points, code coverage, deployment failures, technical debt, and team velocity.",
    profileTypes: [
      { key: "saas_startup", label: "SaaS Startup", description: "Bootstrapping software products with rapid deployment schedules.", startingBalance: 8000, initialStartupCost: 2000, isActive: true },
      { key: "enterprise_dev", label: "Enterprise Dev Team", description: "Large engineering department prioritizing code quality and test coverage.", startingBalance: 30000, initialStartupCost: 5000, isActive: true }
    ],
    metrics: [
      "featuresCompleted", "storyPointsCompleted", "bugsReported", "bugsResolved", "technicalDebtScore",
      "codeQualityScore", "testCoverage", "deploymentFrequency", "failedDeployments", "userAdoption",
      "activeUsers", "churnRate", "supportTickets", "developmentCost", "infrastructureCost", "teamVelocity",
      "customerSatisfaction", "securityRiskScore", "productMarketFitScore"
    ]
  },
  {
    key: "default_cybersecurity_101",
    label: "Cybersecurity",
    description: "Phishing failure rates, open vulnerabilities, incident resolution speeds, and compliance marks.",
    profileTypes: [
      { key: "soc_operations", label: "SOC Operations", description: "Security team monitoring networks and detecting intrusions.", startingBalance: 12000, initialStartupCost: 2500, isActive: true },
      { key: "compliance_audit", label: "Compliance Auditing", description: "Reviewing company training scores and patching vulnerabilities.", startingBalance: 6000, initialStartupCost: 1000, isActive: true }
    ],
    metrics: [
      "securityBudget", "riskExposure", "incidentsDetected", "incidentsResolved", "breachImpactScore",
      "vulnerabilitiesOpen", "vulnerabilitiesPatched", "complianceScore", "employeeTrainingScore",
      "phishingFailureRate", "responseTime", "downtimeHours", "dataLossRisk", "reputationImpact",
      "securityMaturityScore", "attackSurfaceScore", "recoveryCost", "resilienceScore"
    ]
  },
  {
    key: "default_human_resources_101",
    label: "Human Resources",
    description: "Turnover, recruitment speed, employee satisfaction, manager effectiveness, and payroll load.",
    profileTypes: [
      { key: "recruiting_agency", label: "Recruiting Agency", description: "High volume placements focusing on time-to-hire metrics.", startingBalance: 4000, initialStartupCost: 500, isActive: true },
      { key: "corporate_hr", label: "Corporate HR Dept", description: "Internal personnel management and employee retention programs.", startingBalance: 10000, initialStartupCost: 1500, isActive: true }
    ],
    metrics: [
      "employeeCount", "newHires", "turnoverRate", "retentionRate", "trainingCost", "recruitingCost",
      "employeeSatisfaction", "productivityScore", "absenteeismRate", "engagementScore", "payrollCost",
      "benefitsCost", "openPositions", "timeToHire", "promotionRate", "diversityScore",
      "managerEffectivenessScore", "teamMorale", "complianceScore"
    ]
  },
  {
    key: "default_education_administration_101",
    label: "Education Administration",
    description: "Attendance, student test scores, parent engagement, class sizes, and academic growth averages.",
    profileTypes: [
      { key: "charter_district", label: "Charter District", description: "Managing community charter schools and district budgets.", startingBalance: 30000, initialStartupCost: 0, isActive: true },
      { key: "university_dept", label: "University Department", description: "Higher ed administration managing research grants and graduation rates.", startingBalance: 90000, initialStartupCost: 0, isActive: true }
    ],
    metrics: [
      "studentsServed", "attendanceRate", "graduationRate", "testScoreAverage", "studentSatisfaction",
      "teacherSatisfaction", "budgetSpent", "budgetRemaining", "programCost", "interventionSuccessRate",
      "disciplineIncidents", "parentEngagement", "staffingLevel", "classSizeAverage", "resourceAvailability",
      "equityScore", "retentionRate", "academicGrowthScore"
    ]
  },
  {
    key: "default_nonprofit_management_101",
    label: "Nonprofit Management",
    description: "Donations, fundraising costs, grant usage, restricted/unrestricted reserves, and public trust indicators.",
    profileTypes: [
      { key: "charitable_trust", label: "Charitable Trust", description: "Distributing restricted funds for community aid projects.", startingBalance: 15000, initialStartupCost: 1000, isActive: true },
      { key: "advocacy_group", label: "Advocacy Group", description: "Active volunteer coordination and donor recruitment campaigns.", startingBalance: 5000, initialStartupCost: 500, isActive: true }
    ],
    metrics: [
      "donationsReceived", "grantFunding", "programExpenses", "operatingExpenses", "volunteerHours",
      "peopleServed", "donorRetentionRate", "newDonors", "fundraisingCost", "programImpactScore",
      "communityReach", "eventAttendance", "cashBalance", "restrictedFunds", "unrestrictedFunds",
      "serviceQualityScore", "missionAlignmentScore", "publicTrustScore"
    ]
  },
  {
    key: "default_construction_management_101",
    label: "Construction / Skilled Trades",
    description: "Estimates, cost to date, material waste, delay days, change orders, and inspector approval rates.",
    profileTypes: [
      { key: "residential_builder", label: "Residential Builder", description: "Single-family home projects with high material waste controls.", startingBalance: 25000, initialStartupCost: 8000, isActive: true },
      { key: "commercial_contractor", label: "Commercial Contractor", description: "Corporate structures with subcontractor costs and heavy schedules.", startingBalance: 100000, initialStartupCost: 25000, isActive: true }
    ],
    metrics: [
      "projectBudget", "costToDate", "materialsUsed", "materialWaste", "laborHours", "laborCost",
      "scheduleProgress", "delayDays", "changeOrders", "safetyIncidents", "inspectionScore", "qualityScore",
      "equipmentUtilization", "subcontractorCost", "clientSatisfaction", "profitMargin", "completionPercentage",
      "riskScore"
    ]
  },
  {
    key: "default_manufacturing_101",
    label: "Manufacturing",
    description: "Units defect rates, machine utilization, scrap waste, lead/cycle times, and throughput efficiency.",
    profileTypes: [
      { key: "part_supplier", label: "Automotive Part Supplier", description: "Supplier plant making parts with strict scrap rate limits.", startingBalance: 20000, initialStartupCost: 5000, isActive: true },
      { key: "electronics_assembly", label: "Electronics Assembly", description: "Precision board assemblies requiring high quality control.", startingBalance: 60000, initialStartupCost: 15000, isActive: true }
    ],
    metrics: [
      "unitsProduced", "unitsDefective", "defectRate", "productionCost", "laborCost", "materialCost",
      "machineUtilization", "downtimeHours", "throughput", "cycleTime", "inventoryLevel", "scrapWaste",
      "qualityScore", "ordersFulfilled", "backlog", "onTimeDeliveryRate", "grossMargin", "netProfit",
      "efficiencyScore"
    ]
  },
  {
    key: "default_real_estate_101",
    label: "Real Estate",
    description: "Rentals, occupancy rates, cash flow, maintenance, lease renewals, and days on market.",
    profileTypes: [
      { key: "residential_landlord", label: "Residential Landlord", description: "Leasing single-family and multi-family homes to tenants.", startingBalance: 15000, initialStartupCost: 3000, isActive: true },
      { key: "commercial_reit", label: "Commercial REIT", description: "Real Estate Investment Trust managing retail complexes.", startingBalance: 120000, initialStartupCost: 30000, isActive: true }
    ],
    metrics: [
      "propertyValue", "rentalIncome", "occupancyRate", "vacancyRate", "maintenanceCost", "operatingExpenses",
      "netOperatingIncome", "cashFlow", "debtService", "capRate", "tenantSatisfaction", "leaseRenewalRate",
      "marketingCost", "daysOnMarket", "appreciationRate", "repairBacklog", "riskScore", "portfolioValue"
    ]
  },
  {
    key: "default_media_content_creation_101",
    label: "Media / Content Creation",
    description: "Subscribers, video watch times, engagement, brand deals, production costs, and net platform revenues.",
    profileTypes: [
      { key: "solo_influencer", label: "Solo Influencer", description: "Single operator managing their own channel view count.", startingBalance: 500, initialStartupCost: 100, isActive: true },
      { key: "production_company", label: "Production House", description: "Studio producing commercial videos and managing ad sponsorships.", startingBalance: 8000, initialStartupCost: 2000, isActive: true }
    ],
    metrics: [
      "contentPublished", "views", "watchTime", "followers", "subscribers", "engagementRate", "shareRate",
      "comments", "productionCost", "adRevenue", "sponsorRevenue", "brandDeals", "audienceGrowth",
      "retentionRate", "contentQualityScore", "reputationScore", "conversionRate", "profit"
    ]
  }
];
