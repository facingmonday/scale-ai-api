module.exports = [
  {
    "key": "default_digital_marketing_101",
    "label": "Digital Marketing",
    "description": "Focuses on organic and paid web traffic, SEO indicators, conversion rates, and email campaign analytics.",
    "profileTypes": [
      {
        "key": "solo_blogger",
        "label": "Solo Blogger",
        "description": "Content creator focused on organic search optimization and email subscriptions.",
        "startingBalance": 500,
        "initialStartupCost": 100,
        "isActive": true
      },
      {
        "key": "ecom_brand",
        "label": "E-Commerce Brand",
        "description": "Online store using paid advertisements, social channels, and search ranking.",
        "startingBalance": 5000,
        "initialStartupCost": 1500,
        "isActive": true
      },
      {
        "key": "lead_gen_agency",
        "label": "Lead Gen Agency",
        "description": "B2B agency focusing on marketing qualified leads and landing page conversions.",
        "startingBalance": 10000,
        "initialStartupCost": 2000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "organicTraffic",
        "description": "Computed organic traffic for the period.",
        "aiPromptRule": "Total count representing the organic traffic accumulated during this period."
      },
      {
        "key": "paidTraffic",
        "description": "Computed paid traffic for the period.",
        "aiPromptRule": "Currency value representing the total paid traffic for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "socialTraffic",
        "description": "Computed social traffic for the period.",
        "aiPromptRule": "Total count representing the social traffic accumulated during this period."
      },
      {
        "key": "emailTraffic",
        "description": "Computed email traffic for the period.",
        "aiPromptRule": "Total count representing the email traffic accumulated during this period."
      },
      {
        "key": "searchRank",
        "description": "Computed search rank for the period.",
        "aiPromptRule": "Total count representing the search rank accumulated during this period."
      },
      {
        "key": "keywordRankingScore",
        "description": "Computed keyword ranking score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest keyword ranking score at the end of this period."
      },
      {
        "key": "backlinks",
        "description": "Computed backlinks for the period.",
        "aiPromptRule": "Total count representing the backlinks accumulated during this period."
      },
      {
        "key": "domainAuthorityScore",
        "description": "Computed domain authority score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest domain authority score at the end of this period."
      },
      {
        "key": "landingPageConversionRate",
        "description": "Computed landing page conversion rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the landing page conversion rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "bounceRate",
        "description": "Computed bounce rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the bounce rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "averageSessionDuration",
        "description": "Computed average session duration for the period.",
        "aiPromptRule": "Total count representing the average session duration accumulated during this period."
      },
      {
        "key": "adSpend",
        "description": "Computed ad spend for the period.",
        "aiPromptRule": "Currency value representing the total ad spend for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "costPerClick",
        "description": "Average cost per click for paid traffic.",
        "aiPromptRule": "Must equal adSpend / paidTraffic. Capped between $0.10 and $10.00. Set to 0 if paidTraffic is 0."
      },
      {
        "key": "costPerThousandImpressions",
        "description": "Computed cost per thousand impressions for the period.",
        "aiPromptRule": "Currency value representing the total cost per thousand impressions for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "clickThroughRate",
        "description": "Ad click-through rate.",
        "aiPromptRule": "Ad clicks (paidTraffic) divided by ad impressions. Must be a decimal between 0 and 1 (e.g. 0.024 for 2.4%)."
      },
      {
        "key": "leadConversionRate",
        "description": "Landing page to lead conversion rate.",
        "aiPromptRule": "Decimal between 0 and 1 representing the rate at which visitors become leads."
      },
      {
        "key": "emailOpenRate",
        "description": "Computed email open rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the email open rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "emailClickRate",
        "description": "Computed email click rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the email click rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "unsubscribeRate",
        "description": "Computed unsubscribe rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the unsubscribe rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "returnOnAdSpend",
        "description": "Return on ad spend (ROAS).",
        "aiPromptRule": "Revenue from paid search divided by adSpend. Return 0 if adSpend is 0."
      },
      {
        "key": "marketingQualifiedLeads",
        "description": "Total marketing qualified leads generated.",
        "aiPromptRule": "Total traffic (sum of organic, paid, social, email traffic) multiplied by landingPageConversionRate, rounded to a whole integer."
      }
    ]
  },
  {
    "key": "default_entrepreneurship_101",
    "label": "Entrepreneurship",
    "description": "Covers startup cash flow, runway, gross/net profits, churn, CAC, and investor sentiment.",
    "profileTypes": [
      {
        "key": "bootstrap_startup",
        "label": "Bootstrapped Startup",
        "description": "Self-funded venture focusing heavily on early profitability and cash on hand.",
        "startingBalance": 2000,
        "initialStartupCost": 500,
        "isActive": true
      },
      {
        "key": "venture_backed",
        "label": "Venture-Backed Startup",
        "description": "High-growth potential company with VC funding and runway constraints.",
        "startingBalance": 50000,
        "initialStartupCost": 10000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "cashOnHand",
        "description": "Computed cash on hand for the period.",
        "aiPromptRule": "Total count representing the cash on hand accumulated during this period."
      },
      {
        "key": "monthlyRevenue",
        "description": "Computed monthly revenue for the period.",
        "aiPromptRule": "Currency value representing the total monthly revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "monthlyExpenses",
        "description": "Computed monthly expenses for the period.",
        "aiPromptRule": "Currency value representing the total monthly expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "grossProfit",
        "description": "Computed gross profit for the period.",
        "aiPromptRule": "Currency value representing the total gross profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netProfit",
        "description": "Net profit this period.",
        "aiPromptRule": "Must equal monthlyRevenue - monthlyExpenses. Represents the net bottom-line profit or loss."
      },
      {
        "key": "customerCount",
        "description": "Computed customer count for the period.",
        "aiPromptRule": "Total count representing the customer count accumulated during this period."
      },
      {
        "key": "newCustomers",
        "description": "Computed new customers for the period.",
        "aiPromptRule": "Total count representing the new customers accumulated during this period."
      },
      {
        "key": "returningCustomers",
        "description": "Computed returning customers for the period.",
        "aiPromptRule": "Total count representing the returning customers accumulated during this period."
      },
      {
        "key": "customerAcquisitionCost",
        "description": "Average customer acquisition cost.",
        "aiPromptRule": "Calculated as marketingSpend / newCustomers. Set to 0 if newCustomers is 0."
      },
      {
        "key": "customerLifetimeValue",
        "description": "Computed customer lifetime value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current customer lifetime value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "churnRate",
        "description": "Computed churn rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the churn rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "productUnitsSold",
        "description": "Computed product units sold for the period.",
        "aiPromptRule": "Total count representing the product units sold accumulated during this period."
      },
      {
        "key": "marketShareScore",
        "description": "Computed market share score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest market share score at the end of this period."
      },
      {
        "key": "brandReputationScore",
        "description": "Computed brand reputation score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest brand reputation score at the end of this period."
      },
      {
        "key": "investorConfidenceScore",
        "description": "Computed investor confidence score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest investor confidence score at the end of this period."
      },
      {
        "key": "teamMoraleScore",
        "description": "Computed team morale score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest team morale score at the end of this period."
      },
      {
        "key": "operationalCapacity",
        "description": "Computed operational capacity for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest operational capacity at the end of this period."
      },
      {
        "key": "runwayMonths",
        "description": "Estimated runway in months.",
        "aiPromptRule": "Calculated as cashOnHand / monthlyExpenses (or cashOnHand / netLoss if netProfit is negative). If netProfit is positive, return 999."
      },
      {
        "key": "valuationEstimate",
        "description": "Estimated market valuation.",
        "aiPromptRule": "Rough enterprise valuation. Can be calculated as monthlyRevenue * 12 * valuationMultiple (based on growth rate and customer base)."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      }
    ]
  },
  {
    "key": "default_intro_to_business_101",
    "label": "Intro to Business",
    "description": "Teaches the basic foundations of business operation, including sales, assets, debt, equity, and satisfaction scores.",
    "profileTypes": [
      {
        "key": "sole_proprietorship",
        "label": "Sole Proprietorship",
        "description": "A business owned and run by one person.",
        "startingBalance": 1000,
        "initialStartupCost": 200,
        "isActive": true
      },
      {
        "key": "partnership",
        "label": "Partnership",
        "description": "A business structure owned by two or more partners sharing profits.",
        "startingBalance": 5000,
        "initialStartupCost": 1000,
        "isActive": true
      },
      {
        "key": "corporation",
        "label": "Corporation",
        "description": "A complex business entity legally separate from its owners.",
        "startingBalance": 25000,
        "initialStartupCost": 5000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "sales",
        "description": "Computed sales for the period.",
        "aiPromptRule": "Currency value representing the total sales for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "revenue",
        "description": "Computed revenue for the period.",
        "aiPromptRule": "Currency value representing the total revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "expenses",
        "description": "Computed expenses for the period.",
        "aiPromptRule": "Currency value representing the total expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "profit",
        "description": "Net profit this period.",
        "aiPromptRule": "Must equal revenue - expenses."
      },
      {
        "key": "cashBalance",
        "description": "Cash balance after operations.",
        "aiPromptRule": "Carry-forward balance: previous cashBalance + profit."
      },
      {
        "key": "inventoryLevel",
        "description": "Computed inventory level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest inventory level at the end of this period."
      },
      {
        "key": "customerSatisfaction",
        "description": "Computed customer satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest customer satisfaction at the end of this period."
      },
      {
        "key": "employeeSatisfaction",
        "description": "Computed employee satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest employee satisfaction at the end of this period."
      },
      {
        "key": "marketDemand",
        "description": "Computed market demand for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest market demand at the end of this period."
      },
      {
        "key": "brandAwareness",
        "description": "Computed brand awareness for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest brand awareness at the end of this period."
      },
      {
        "key": "operatingEfficiency",
        "description": "Computed operating efficiency for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest operating efficiency at the end of this period."
      },
      {
        "key": "debt",
        "description": "Computed debt for the period.",
        "aiPromptRule": "Total count representing the debt accumulated during this period."
      },
      {
        "key": "assets",
        "description": "Computed assets for the period.",
        "aiPromptRule": "Currency value representing the total assets for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "liabilities",
        "description": "Computed liabilities for the period.",
        "aiPromptRule": "Currency value representing the total liabilities for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "equity",
        "description": "Owner equity.",
        "aiPromptRule": "Must satisfy the accounting equation: assets - liabilities."
      },
      {
        "key": "growthRate",
        "description": "Computed growth rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the growth rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      },
      {
        "key": "decisionQualityScore",
        "description": "Computed decision quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest decision quality score at the end of this period."
      }
    ]
  },
  {
    "key": "default_accounting_101",
    "label": "Accounting",
    "description": "Double-entry indicators, receivables/payables, inventory valuations, COGS, net income, and ratios.",
    "profileTypes": [
      {
        "key": "retail_store",
        "label": "Retail Store",
        "description": "Product seller dealing with inventory value and cost of goods sold.",
        "startingBalance": 5000,
        "initialStartupCost": 1000,
        "isActive": true
      },
      {
        "key": "service_provider",
        "label": "Service Provider",
        "description": "Consultancy or service business dealing primarily with receivables and payables.",
        "startingBalance": 3000,
        "initialStartupCost": 500,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "cash",
        "description": "Computed cash for the period.",
        "aiPromptRule": "Total count representing the cash accumulated during this period."
      },
      {
        "key": "accountsReceivable",
        "description": "Computed accounts receivable for the period.",
        "aiPromptRule": "Total count representing the accounts receivable accumulated during this period."
      },
      {
        "key": "accountsPayable",
        "description": "Computed accounts payable for the period.",
        "aiPromptRule": "Total count representing the accounts payable accumulated during this period."
      },
      {
        "key": "inventoryValue",
        "description": "Computed inventory value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current inventory value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "revenue",
        "description": "Computed revenue for the period.",
        "aiPromptRule": "Currency value representing the total revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "costOfGoodsSold",
        "description": "Computed cost of goods sold for the period.",
        "aiPromptRule": "Currency value representing the total cost of goods sold for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "grossProfit",
        "description": "Gross profit this period.",
        "aiPromptRule": "Must equal revenue - costOfGoodsSold."
      },
      {
        "key": "operatingExpenses",
        "description": "Computed operating expenses for the period.",
        "aiPromptRule": "Currency value representing the total operating expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netIncome",
        "description": "Net income this period.",
        "aiPromptRule": "Must equal grossProfit - operatingExpenses."
      },
      {
        "key": "assets",
        "description": "Computed assets for the period.",
        "aiPromptRule": "Currency value representing the total assets for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "liabilities",
        "description": "Computed liabilities for the period.",
        "aiPromptRule": "Currency value representing the total liabilities for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "equity",
        "description": "Total equity.",
        "aiPromptRule": "Must equal assets - liabilities."
      },
      {
        "key": "debt",
        "description": "Computed debt for the period.",
        "aiPromptRule": "Total count representing the debt accumulated during this period."
      },
      {
        "key": "cashFlow",
        "description": "Computed cash flow for the period.",
        "aiPromptRule": "Total count representing the cash flow accumulated during this period."
      },
      {
        "key": "profitMargin",
        "description": "Computed profit margin for the period.",
        "aiPromptRule": "Currency value representing the total profit margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "currentRatio",
        "description": "Current ratio (liquidity metric).",
        "aiPromptRule": "Calculated as currentAssets / currentLiabilities. Keep to 2 decimal places."
      },
      {
        "key": "breakEvenPoint",
        "description": "Computed break even point for the period.",
        "aiPromptRule": "Total count representing the break even point accumulated during this period."
      },
      {
        "key": "budgetVariance",
        "description": "Computed budget variance for the period.",
        "aiPromptRule": "Currency value representing the total budget variance for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "taxLiability",
        "description": "Computed tax liability for the period.",
        "aiPromptRule": "Currency value representing the total tax liability for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "retainedEarnings",
        "description": "Cumulative retained earnings.",
        "aiPromptRule": "Carry-forward balance: previous retainedEarnings + netIncome - dividendsPaid."
      }
    ]
  },
  {
    "key": "default_finance_101",
    "label": "Finance",
    "description": "Capital budgeting, NPV/IRR, liquidity, return on equity, and enterprise valuation.",
    "profileTypes": [
      {
        "key": "corporate_finance",
        "label": "Corporate Finance",
        "description": "Corporate treasury management and capital allocation.",
        "startingBalance": 15000,
        "initialStartupCost": 3000,
        "isActive": true
      },
      {
        "key": "investment_fund",
        "label": "Investment Fund",
        "description": "Managing portfolio values and risk exposures.",
        "startingBalance": 100000,
        "initialStartupCost": 5000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "cashBalance",
        "description": "Computed cash balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current cash balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "portfolioValue",
        "description": "Computed portfolio value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current portfolio value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "investmentReturn",
        "description": "Computed investment return for the period.",
        "aiPromptRule": "Total count representing the investment return accumulated during this period."
      },
      {
        "key": "debtBalance",
        "description": "Computed debt balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current debt balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "interestExpense",
        "description": "Computed interest expense for the period.",
        "aiPromptRule": "Currency value representing the total interest expense for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operatingCashFlow",
        "description": "Computed operating cash flow for the period.",
        "aiPromptRule": "Total count representing the operating cash flow accumulated during this period."
      },
      {
        "key": "freeCashFlow",
        "description": "Computed free cash flow for the period.",
        "aiPromptRule": "Total count representing the free cash flow accumulated during this period."
      },
      {
        "key": "netPresentValue",
        "description": "Computed net present value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current net present value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "internalRateOfReturn",
        "description": "Computed internal rate of return for the period.",
        "aiPromptRule": "Total count representing the internal rate of return accumulated during this period."
      },
      {
        "key": "riskExposure",
        "description": "Computed risk exposure for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk exposure at the end of this period."
      },
      {
        "key": "creditScore",
        "description": "Computed credit score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest credit score at the end of this period."
      },
      {
        "key": "profitMargin",
        "description": "Computed profit margin for the period.",
        "aiPromptRule": "Currency value representing the total profit margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "returnOnInvestment",
        "description": "Computed return on investment for the period.",
        "aiPromptRule": "Total count representing the return on investment accumulated during this period."
      },
      {
        "key": "returnOnEquity",
        "description": "Computed return on equity for the period.",
        "aiPromptRule": "Currency value representing the total return on equity for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "liquidityRatio",
        "description": "Computed liquidity ratio for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the liquidity ratio. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "debtToEquityRatio",
        "description": "Computed debt to equity ratio for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the debt to equity ratio. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "burnRate",
        "description": "Computed burn rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the burn rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "runwayMonths",
        "description": "Computed runway months for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest runway months at the end of this period."
      },
      {
        "key": "valuation",
        "description": "Computed valuation for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current valuation balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "shareholderValue",
        "description": "Computed shareholder value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current shareholder value balance. Add revenues/funding and subtract costs/expenses."
      }
    ]
  },
  {
    "key": "default_personal_finance_101",
    "label": "Personal Finance",
    "description": "Teaches budgeting, savings rate, emergency funds, debt management, and net worth calculations.",
    "profileTypes": [
      {
        "key": "college_student",
        "label": "College Student",
        "description": "Student managing part-time income, textbooks, and tuition expenses.",
        "startingBalance": 200,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "young_professional",
        "label": "Young Professional",
        "description": "Individual establishing career earnings, housing costs, and investments.",
        "startingBalance": 2000,
        "initialStartupCost": 500,
        "isActive": true
      },
      {
        "key": "retiree",
        "label": "Retiree",
        "description": "Individual drawing down checking balances and managing retirement savings.",
        "startingBalance": 50000,
        "initialStartupCost": 0,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "income",
        "description": "Computed income for the period.",
        "aiPromptRule": "Currency value representing the total income for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "expenses",
        "description": "Computed expenses for the period.",
        "aiPromptRule": "Currency value representing the total expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "savings",
        "description": "Computed savings for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current savings balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "checkingBalance",
        "description": "Computed checking balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current checking balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "emergencyFund",
        "description": "Computed emergency fund for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current emergency fund balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "debtBalance",
        "description": "Computed debt balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current debt balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "creditScore",
        "description": "Computed credit score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest credit score at the end of this period."
      },
      {
        "key": "monthlyCashFlow",
        "description": "Computed monthly cash flow for the period.",
        "aiPromptRule": "Total count representing the monthly cash flow accumulated during this period."
      },
      {
        "key": "investmentBalance",
        "description": "Computed investment balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current investment balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "retirementSavings",
        "description": "Computed retirement savings for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current retirement savings balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "housingCost",
        "description": "Computed housing cost for the period.",
        "aiPromptRule": "Currency value representing the total housing cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "transportationCost",
        "description": "Computed transportation cost for the period.",
        "aiPromptRule": "Currency value representing the total transportation cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "foodCost",
        "description": "Computed food cost for the period.",
        "aiPromptRule": "Currency value representing the total food cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "insuranceCost",
        "description": "Computed insurance cost for the period.",
        "aiPromptRule": "Currency value representing the total insurance cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "interestPaid",
        "description": "Computed interest paid for the period.",
        "aiPromptRule": "Currency value representing the total interest paid for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netWorth",
        "description": "Computed net worth for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current net worth balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "savingsRate",
        "description": "Computed savings rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the savings rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "debtToIncomeRatio",
        "description": "Computed debt to income ratio for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the debt to income ratio. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "financialStressScore",
        "description": "Computed financial stress score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest financial stress score at the end of this period."
      },
      {
        "key": "goalProgress",
        "description": "Computed goal progress for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest goal progress at the end of this period."
      }
    ]
  },
  {
    "key": "default_economics_101",
    "label": "Economics",
    "description": "Teaches market supply/demand, price equilibrium, surplus levels, and macro indicators.",
    "profileTypes": [
      {
        "key": "monopoly_firm",
        "label": "Monopoly Firm",
        "description": "Single seller controlling prices and maximizing producer surplus.",
        "startingBalance": 10000,
        "initialStartupCost": 2000,
        "isActive": true
      },
      {
        "key": "competitive_firm",
        "label": "Competitive Firm",
        "description": "Price-taking firm operating in a perfectly competitive market.",
        "startingBalance": 2000,
        "initialStartupCost": 500,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "price",
        "description": "Computed price for the period.",
        "aiPromptRule": "Currency value representing the total price for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "quantityDemanded",
        "description": "Computed quantity demanded for the period.",
        "aiPromptRule": "Total count representing the quantity demanded accumulated during this period."
      },
      {
        "key": "quantitySupplied",
        "description": "Computed quantity supplied for the period.",
        "aiPromptRule": "Total count representing the quantity supplied accumulated during this period."
      },
      {
        "key": "marketDemand",
        "description": "Computed market demand for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest market demand at the end of this period."
      },
      {
        "key": "marketSupply",
        "description": "Computed market supply for the period.",
        "aiPromptRule": "Total count representing the market supply accumulated during this period."
      },
      {
        "key": "consumerSurplus",
        "description": "Computed consumer surplus for the period.",
        "aiPromptRule": "Total count representing the consumer surplus accumulated during this period."
      },
      {
        "key": "producerSurplus",
        "description": "Computed producer surplus for the period.",
        "aiPromptRule": "Total count representing the producer surplus accumulated during this period."
      },
      {
        "key": "shortageAmount",
        "description": "Computed shortage amount for the period.",
        "aiPromptRule": "Total count representing the shortage amount accumulated during this period."
      },
      {
        "key": "surplusAmount",
        "description": "Computed surplus amount for the period.",
        "aiPromptRule": "Total count representing the surplus amount accumulated during this period."
      },
      {
        "key": "inflationRate",
        "description": "Computed inflation rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the inflation rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "unemploymentRate",
        "description": "Computed unemployment rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the unemployment rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "interestRate",
        "description": "Computed interest rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the interest rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "gdpContribution",
        "description": "Computed gdp contribution for the period.",
        "aiPromptRule": "Total count representing the gdp contribution accumulated during this period."
      },
      {
        "key": "taxRevenue",
        "description": "Computed tax revenue for the period.",
        "aiPromptRule": "Currency value representing the total tax revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "governmentSpending",
        "description": "Computed government spending for the period.",
        "aiPromptRule": "Currency value representing the total government spending for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "marketShare",
        "description": "Computed market share for the period.",
        "aiPromptRule": "Total count representing the market share accumulated during this period."
      },
      {
        "key": "priceElasticity",
        "description": "Computed price elasticity for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the price elasticity. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "profit",
        "description": "Computed profit for the period.",
        "aiPromptRule": "Currency value representing the total profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "welfareScore",
        "description": "Computed welfare score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest welfare score at the end of this period."
      },
      {
        "key": "efficiencyScore",
        "description": "Computed efficiency score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest efficiency score at the end of this period."
      }
    ]
  },
  {
    "key": "default_operations_management_101",
    "label": "Operations Management",
    "description": "Capacity utilization, throughput, cycle/lead times, defect rates, and stockouts.",
    "profileTypes": [
      {
        "key": "job_shop",
        "label": "Job Shop",
        "description": "Low volume, high variety production setup.",
        "startingBalance": 5000,
        "initialStartupCost": 1500,
        "isActive": true
      },
      {
        "key": "assembly_line",
        "label": "Assembly Line",
        "description": "High volume, standardized product manufacturing.",
        "startingBalance": 20000,
        "initialStartupCost": 5000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "unitsProduced",
        "description": "Computed units produced for the period.",
        "aiPromptRule": "Total count representing the units produced accumulated during this period."
      },
      {
        "key": "unitsSold",
        "description": "Computed units sold for the period.",
        "aiPromptRule": "Total count representing the units sold accumulated during this period."
      },
      {
        "key": "capacityUtilization",
        "description": "Computed capacity utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest capacity utilization at the end of this period."
      },
      {
        "key": "throughput",
        "description": "Computed throughput for the period.",
        "aiPromptRule": "Total count representing the throughput accumulated during this period."
      },
      {
        "key": "cycleTime",
        "description": "Computed cycle time for the period.",
        "aiPromptRule": "Total count representing the cycle time accumulated during this period."
      },
      {
        "key": "leadTime",
        "description": "Computed lead time for the period.",
        "aiPromptRule": "Total count representing the lead time accumulated during this period."
      },
      {
        "key": "backlog",
        "description": "Computed backlog for the period.",
        "aiPromptRule": "Total count representing the backlog accumulated during this period."
      },
      {
        "key": "defectRate",
        "description": "Computed defect rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the defect rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "qualityScore",
        "description": "Computed quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest quality score at the end of this period."
      },
      {
        "key": "laborHours",
        "description": "Computed labor hours for the period.",
        "aiPromptRule": "Total count representing the labor hours accumulated during this period."
      },
      {
        "key": "laborCost",
        "description": "Computed labor cost for the period.",
        "aiPromptRule": "Currency value representing the total labor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "materialCost",
        "description": "Computed material cost for the period.",
        "aiPromptRule": "Currency value representing the total material cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operatingCost",
        "description": "Computed operating cost for the period.",
        "aiPromptRule": "Currency value representing the total operating cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "inventoryLevel",
        "description": "Computed inventory level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest inventory level at the end of this period."
      },
      {
        "key": "stockouts",
        "description": "Computed stockouts for the period.",
        "aiPromptRule": "Total count representing the stockouts accumulated during this period."
      },
      {
        "key": "waste",
        "description": "Computed waste for the period.",
        "aiPromptRule": "Total count representing the waste accumulated during this period."
      },
      {
        "key": "onTimeDeliveryRate",
        "description": "Computed on time delivery rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the on time delivery rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "customerSatisfaction",
        "description": "Computed customer satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest customer satisfaction at the end of this period."
      },
      {
        "key": "netProfit",
        "description": "Computed net profit for the period.",
        "aiPromptRule": "Currency value representing the total net profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "efficiencyScore",
        "description": "Computed efficiency score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest efficiency score at the end of this period."
      }
    ]
  },
  {
    "key": "default_logistics_101",
    "label": "Logistics",
    "description": "Shipping costs, warehouse costs, delivery speed, routing efficiency, and carbon emissions.",
    "profileTypes": [
      {
        "key": "regional_carrier",
        "label": "Regional Carrier",
        "description": "Courier or truckload company serving a localized area.",
        "startingBalance": 8000,
        "initialStartupCost": 2000,
        "isActive": true
      },
      {
        "key": "freight_forwarder",
        "label": "Freight Forwarder",
        "description": "Managing multi-modal shipments and delivery capacities globally.",
        "startingBalance": 30000,
        "initialStartupCost": 6000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "ordersShipped",
        "description": "Computed orders shipped for the period.",
        "aiPromptRule": "Total count representing the orders shipped accumulated during this period."
      },
      {
        "key": "ordersDelivered",
        "description": "Computed orders delivered for the period.",
        "aiPromptRule": "Total count representing the orders delivered accumulated during this period."
      },
      {
        "key": "onTimeDeliveryRate",
        "description": "Computed on time delivery rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the on time delivery rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "lateDeliveries",
        "description": "Computed late deliveries for the period.",
        "aiPromptRule": "Total count representing the late deliveries accumulated during this period."
      },
      {
        "key": "shippingCost",
        "description": "Computed shipping cost for the period.",
        "aiPromptRule": "Currency value representing the total shipping cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "fuelCost",
        "description": "Computed fuel cost for the period.",
        "aiPromptRule": "Currency value representing the total fuel cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "warehouseCost",
        "description": "Computed warehouse cost for the period.",
        "aiPromptRule": "Currency value representing the total warehouse cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "deliveryDistance",
        "description": "Computed delivery distance for the period.",
        "aiPromptRule": "Total count representing the delivery distance accumulated during this period."
      },
      {
        "key": "routeEfficiency",
        "description": "Computed route efficiency for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest route efficiency at the end of this period."
      },
      {
        "key": "vehicleUtilization",
        "description": "Computed vehicle utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest vehicle utilization at the end of this period."
      },
      {
        "key": "laborHours",
        "description": "Computed labor hours for the period.",
        "aiPromptRule": "Total count representing the labor hours accumulated during this period."
      },
      {
        "key": "damagedShipments",
        "description": "Computed damaged shipments for the period.",
        "aiPromptRule": "Total count representing the damaged shipments accumulated during this period."
      },
      {
        "key": "lostShipments",
        "description": "Computed lost shipments for the period.",
        "aiPromptRule": "Total count representing the lost shipments accumulated during this period."
      },
      {
        "key": "customerSatisfaction",
        "description": "Computed customer satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest customer satisfaction at the end of this period."
      },
      {
        "key": "carbonEmissions",
        "description": "Computed carbon emissions for the period.",
        "aiPromptRule": "Total count representing the carbon emissions accumulated during this period."
      },
      {
        "key": "inventoryInTransit",
        "description": "Computed inventory in transit for the period.",
        "aiPromptRule": "Total count representing the inventory in transit accumulated during this period."
      },
      {
        "key": "deliveryCapacity",
        "description": "Computed delivery capacity for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest delivery capacity at the end of this period."
      },
      {
        "key": "backlog",
        "description": "Computed backlog for the period.",
        "aiPromptRule": "Total count representing the backlog accumulated during this period."
      },
      {
        "key": "profit",
        "description": "Computed profit for the period.",
        "aiPromptRule": "Currency value representing the total profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "serviceLevel",
        "description": "Computed service level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest service level at the end of this period."
      }
    ]
  },
  {
    "key": "default_hospitality_management_101",
    "label": "Hospitality / Restaurant Management",
    "description": "Guest turnover, ticket size, beverage/food cost percentages, review scores, and table turnover rates.",
    "profileTypes": [
      {
        "key": "fast_casual",
        "label": "Fast Casual",
        "description": "Quick service eatery prioritizing speed and order counts.",
        "startingBalance": 6000,
        "initialStartupCost": 2000,
        "isActive": true
      },
      {
        "key": "fine_dining",
        "label": "Fine Dining",
        "description": "Sit-down restaurant focusing on average ticket size and reservation rates.",
        "startingBalance": 18000,
        "initialStartupCost": 5000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "guestCount",
        "description": "Computed guest count for the period.",
        "aiPromptRule": "Total count representing the guest count accumulated during this period."
      },
      {
        "key": "reservations",
        "description": "Computed reservations for the period.",
        "aiPromptRule": "Total count representing the reservations accumulated during this period."
      },
      {
        "key": "walkIns",
        "description": "Computed walk ins for the period.",
        "aiPromptRule": "Total count representing the walk ins accumulated during this period."
      },
      {
        "key": "tableTurnoverRate",
        "description": "Computed table turnover rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the table turnover rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "averageTicketSize",
        "description": "Computed average ticket size for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current average ticket size balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "foodRevenue",
        "description": "Computed food revenue for the period.",
        "aiPromptRule": "Currency value representing the total food revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "beverageRevenue",
        "description": "Computed beverage revenue for the period.",
        "aiPromptRule": "Currency value representing the total beverage revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "laborCost",
        "description": "Computed labor cost for the period.",
        "aiPromptRule": "Currency value representing the total labor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "foodCost",
        "description": "Computed food cost for the period.",
        "aiPromptRule": "Currency value representing the total food cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "wasteCost",
        "description": "Computed waste cost for the period.",
        "aiPromptRule": "Currency value representing the total waste cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "inventoryValue",
        "description": "Computed inventory value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current inventory value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "customerSatisfaction",
        "description": "Computed customer satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest customer satisfaction at the end of this period."
      },
      {
        "key": "reviewScore",
        "description": "Computed review score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest review score at the end of this period."
      },
      {
        "key": "staffMorale",
        "description": "Computed staff morale for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest staff morale at the end of this period."
      },
      {
        "key": "serviceSpeed",
        "description": "Computed service speed for the period.",
        "aiPromptRule": "Total count representing the service speed accumulated during this period."
      },
      {
        "key": "capacityUtilization",
        "description": "Computed capacity utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest capacity utilization at the end of this period."
      },
      {
        "key": "profitMargin",
        "description": "Computed profit margin for the period.",
        "aiPromptRule": "Currency value representing the total profit margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netProfit",
        "description": "Computed net profit for the period.",
        "aiPromptRule": "Currency value representing the total net profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "reputationScore",
        "description": "Computed reputation score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest reputation score at the end of this period."
      },
      {
        "key": "repeatGuestRate",
        "description": "Computed repeat guest rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the repeat guest rate. Scale dynamically based on decisions, challenges, and profile constraints."
      }
    ]
  },
  {
    "key": "default_event_management_101",
    "label": "Event Management",
    "description": "Ticket check-ins, sponsor support, venue costs, staffing levels, and social media mentions.",
    "profileTypes": [
      {
        "key": "concert_promoter",
        "label": "Concert Promoter",
        "description": "Organizing music events, managing tickets sold and marketing costs.",
        "startingBalance": 12000,
        "initialStartupCost": 3500,
        "isActive": true
      },
      {
        "key": "conference_planner",
        "label": "Conference Planner",
        "description": "Corporate event organizer with sponsor revenue and vendor costs.",
        "startingBalance": 25000,
        "initialStartupCost": 8000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "ticketsSold",
        "description": "Computed tickets sold for the period.",
        "aiPromptRule": "Currency value representing the total tickets sold for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "attendance",
        "description": "Computed attendance for the period.",
        "aiPromptRule": "Total count representing the attendance accumulated during this period."
      },
      {
        "key": "grossRevenue",
        "description": "Computed gross revenue for the period.",
        "aiPromptRule": "Currency value representing the total gross revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "sponsorRevenue",
        "description": "Computed sponsor revenue for the period.",
        "aiPromptRule": "Currency value representing the total sponsor revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "vendorCosts",
        "description": "Computed vendor costs for the period.",
        "aiPromptRule": "Currency value representing the total vendor costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "staffingCosts",
        "description": "Computed staffing costs for the period.",
        "aiPromptRule": "Currency value representing the total staffing costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "marketingCosts",
        "description": "Computed marketing costs for the period.",
        "aiPromptRule": "Currency value representing the total marketing costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netProfit",
        "description": "Computed net profit for the period.",
        "aiPromptRule": "Currency value representing the total net profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "checkInRate",
        "description": "Computed check in rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the check in rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "noShowRate",
        "description": "Computed no show rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the no show rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "guestSatisfaction",
        "description": "Computed guest satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest guest satisfaction at the end of this period."
      },
      {
        "key": "sponsorSatisfaction",
        "description": "Computed sponsor satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest sponsor satisfaction at the end of this period."
      },
      {
        "key": "volunteerHours",
        "description": "Computed volunteer hours for the period.",
        "aiPromptRule": "Total count representing the volunteer hours accumulated during this period."
      },
      {
        "key": "capacityUtilization",
        "description": "Computed capacity utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest capacity utilization at the end of this period."
      },
      {
        "key": "eventReputationScore",
        "description": "Computed event reputation score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest event reputation score at the end of this period."
      },
      {
        "key": "socialMentions",
        "description": "Computed social mentions for the period.",
        "aiPromptRule": "Total count representing the social mentions accumulated during this period."
      },
      {
        "key": "safetyIncidents",
        "description": "Computed safety incidents for the period.",
        "aiPromptRule": "Total count representing the safety incidents accumulated during this period."
      },
      {
        "key": "operationalIssues",
        "description": "Computed operational issues for the period.",
        "aiPromptRule": "Total count representing the operational issues accumulated during this period."
      },
      {
        "key": "weatherImpactScore",
        "description": "Computed weather impact score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest weather impact score at the end of this period."
      },
      {
        "key": "postEventLeads",
        "description": "Computed post event leads for the period.",
        "aiPromptRule": "Total count representing the post event leads accumulated during this period."
      }
    ]
  },
  {
    "key": "default_agribusiness_101",
    "label": "Agribusiness",
    "description": "Crop yields, livestock outputs, fertilizers, sustainability metrics, and weather impacts.",
    "profileTypes": [
      {
        "key": "family_farm",
        "label": "Family Farm",
        "description": "Small-scale crop and livestock production with tight soil health constraints.",
        "startingBalance": 4000,
        "initialStartupCost": 1000,
        "isActive": true
      },
      {
        "key": "corporate_coop",
        "label": "Corporate Co-Op",
        "description": "Large-scale agriculture operation utilizing land and massive fuel/seed allocations.",
        "startingBalance": 35000,
        "initialStartupCost": 10000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "cropYield",
        "description": "Computed crop yield for the period.",
        "aiPromptRule": "Total count representing the crop yield accumulated during this period."
      },
      {
        "key": "livestockOutput",
        "description": "Computed livestock output for the period.",
        "aiPromptRule": "Total count representing the livestock output accumulated during this period."
      },
      {
        "key": "marketPrice",
        "description": "Computed market price for the period.",
        "aiPromptRule": "Currency value representing the total market price for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "salesRevenue",
        "description": "Computed sales revenue for the period.",
        "aiPromptRule": "Currency value representing the total sales revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "seedCost",
        "description": "Computed seed cost for the period.",
        "aiPromptRule": "Currency value representing the total seed cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "feedCost",
        "description": "Computed feed cost for the period.",
        "aiPromptRule": "Currency value representing the total feed cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "fertilizerCost",
        "description": "Computed fertilizer cost for the period.",
        "aiPromptRule": "Currency value representing the total fertilizer cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "laborCost",
        "description": "Computed labor cost for the period.",
        "aiPromptRule": "Currency value representing the total labor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "equipmentCost",
        "description": "Computed equipment cost for the period.",
        "aiPromptRule": "Currency value representing the total equipment cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "waterUsage",
        "description": "Computed water usage for the period.",
        "aiPromptRule": "Total count representing the water usage accumulated during this period."
      },
      {
        "key": "fuelCost",
        "description": "Computed fuel cost for the period.",
        "aiPromptRule": "Currency value representing the total fuel cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "landUtilization",
        "description": "Computed land utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest land utilization at the end of this period."
      },
      {
        "key": "inventoryOnHand",
        "description": "Computed inventory on hand for the period.",
        "aiPromptRule": "Total count representing the inventory on hand accumulated during this period."
      },
      {
        "key": "waste",
        "description": "Computed waste for the period.",
        "aiPromptRule": "Total count representing the waste accumulated during this period."
      },
      {
        "key": "weatherImpact",
        "description": "Computed weather impact for the period.",
        "aiPromptRule": "Total count representing the weather impact accumulated during this period."
      },
      {
        "key": "profit",
        "description": "Computed profit for the period.",
        "aiPromptRule": "Currency value representing the total profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "soilHealthScore",
        "description": "Computed soil health score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest soil health score at the end of this period."
      },
      {
        "key": "sustainabilityScore",
        "description": "Computed sustainability score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest sustainability score at the end of this period."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      },
      {
        "key": "cashBalance",
        "description": "Computed cash balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current cash balance balance. Add revenues/funding and subtract costs/expenses."
      }
    ]
  },
  {
    "key": "default_environmental_science_101",
    "label": "Environmental Science / Sustainability",
    "description": "Resource usage, divergence tracking, compliance costs, carbon levels, and public approval.",
    "profileTypes": [
      {
        "key": "eco_consultancy",
        "label": "Eco Consultancy",
        "description": "Helping businesses reduce energy and waste footprints.",
        "startingBalance": 3000,
        "initialStartupCost": 500,
        "isActive": true
      },
      {
        "key": "conservation_ngo",
        "label": "Conservation NGO",
        "description": "Direct advocacy and environmental impact tracking.",
        "startingBalance": 6000,
        "initialStartupCost": 1000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "resourceUsage",
        "description": "Computed resource usage for the period.",
        "aiPromptRule": "Total count representing the resource usage accumulated during this period."
      },
      {
        "key": "waterUsage",
        "description": "Computed water usage for the period.",
        "aiPromptRule": "Total count representing the water usage accumulated during this period."
      },
      {
        "key": "energyUsage",
        "description": "Computed energy usage for the period.",
        "aiPromptRule": "Total count representing the energy usage accumulated during this period."
      },
      {
        "key": "carbonEmissions",
        "description": "Computed carbon emissions for the period.",
        "aiPromptRule": "Total count representing the carbon emissions accumulated during this period."
      },
      {
        "key": "wasteGenerated",
        "description": "Computed waste generated for the period.",
        "aiPromptRule": "Total count representing the waste generated accumulated during this period."
      },
      {
        "key": "wasteDiverted",
        "description": "Computed waste diverted for the period.",
        "aiPromptRule": "Total count representing the waste diverted accumulated during this period."
      },
      {
        "key": "recyclingRate",
        "description": "Computed recycling rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the recycling rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "biodiversityScore",
        "description": "Computed biodiversity score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest biodiversity score at the end of this period."
      },
      {
        "key": "sustainabilityScore",
        "description": "Computed sustainability score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest sustainability score at the end of this period."
      },
      {
        "key": "costOfCompliance",
        "description": "Computed cost of compliance for the period.",
        "aiPromptRule": "Currency value representing the total cost of compliance for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "environmentalImpactScore",
        "description": "Computed environmental impact score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest environmental impact score at the end of this period."
      },
      {
        "key": "communityApprovalScore",
        "description": "Computed community approval score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest community approval score at the end of this period."
      },
      {
        "key": "policyEffectiveness",
        "description": "Computed policy effectiveness for the period.",
        "aiPromptRule": "Total count representing the policy effectiveness accumulated during this period."
      },
      {
        "key": "pollutionLevel",
        "description": "Computed pollution level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest pollution level at the end of this period."
      },
      {
        "key": "conservationProgress",
        "description": "Computed conservation progress for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest conservation progress at the end of this period."
      },
      {
        "key": "operatingCost",
        "description": "Computed operating cost for the period.",
        "aiPromptRule": "Currency value representing the total operating cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "longTermRiskScore",
        "description": "Computed long term risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest long term risk score at the end of this period."
      },
      {
        "key": "resilienceScore",
        "description": "Computed resilience score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest resilience score at the end of this period."
      }
    ]
  },
  {
    "key": "default_public_administration_101",
    "label": "Public Administration",
    "description": "Budget allocations, civic compliance, citizen satisfaction, and service delivery backlog.",
    "profileTypes": [
      {
        "key": "municipal_dept",
        "label": "Municipal Department",
        "description": "Local city services managing local staff and tax revenues.",
        "startingBalance": 20000,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "federal_program",
        "label": "Federal Program",
        "description": "National initiatives supported by federal grants and policy outcomes.",
        "startingBalance": 150000,
        "initialStartupCost": 0,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "budgetAllocated",
        "description": "Computed budget allocated for the period.",
        "aiPromptRule": "Currency value representing the total budget allocated for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetSpent",
        "description": "Computed budget spent for the period.",
        "aiPromptRule": "Currency value representing the total budget spent for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetRemaining",
        "description": "Computed budget remaining for the period.",
        "aiPromptRule": "Currency value representing the total budget remaining for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "citizensServed",
        "description": "Computed citizens served for the period.",
        "aiPromptRule": "Total count representing the citizens served accumulated during this period."
      },
      {
        "key": "serviceQualityScore",
        "description": "Computed service quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest service quality score at the end of this period."
      },
      {
        "key": "publicApprovalScore",
        "description": "Computed public approval score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest public approval score at the end of this period."
      },
      {
        "key": "staffingLevel",
        "description": "Computed staffing level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest staffing level at the end of this period."
      },
      {
        "key": "programCost",
        "description": "Computed program cost for the period.",
        "aiPromptRule": "Currency value representing the total program cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "programImpactScore",
        "description": "Computed program impact score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest program impact score at the end of this period."
      },
      {
        "key": "equityScore",
        "description": "Computed equity score for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current equity score balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "responseTime",
        "description": "Computed response time for the period.",
        "aiPromptRule": "Total count representing the response time accumulated during this period."
      },
      {
        "key": "backlog",
        "description": "Computed backlog for the period.",
        "aiPromptRule": "Total count representing the backlog accumulated during this period."
      },
      {
        "key": "complianceScore",
        "description": "Computed compliance score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest compliance score at the end of this period."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      },
      {
        "key": "taxRevenue",
        "description": "Computed tax revenue for the period.",
        "aiPromptRule": "Currency value representing the total tax revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "grantFunding",
        "description": "Computed grant funding for the period.",
        "aiPromptRule": "Currency value representing the total grant funding for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operationalEfficiency",
        "description": "Computed operational efficiency for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest operational efficiency at the end of this period."
      },
      {
        "key": "communityTrustScore",
        "description": "Computed community trust score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest community trust score at the end of this period."
      },
      {
        "key": "policyOutcomeScore",
        "description": "Computed policy outcome score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest policy outcome score at the end of this period."
      }
    ]
  },
  {
    "key": "default_civics_government_101",
    "label": "Civics / Government",
    "description": "Political approval, education, voter turnout, safety scores, and long-term public safety metrics.",
    "profileTypes": [
      {
        "key": "local_council",
        "label": "Local Council",
        "description": "City or county municipal representatives.",
        "startingBalance": 15000,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "national_assembly",
        "label": "National Assembly",
        "description": "Legislative body managing national spending and structural deficits.",
        "startingBalance": 500000,
        "initialStartupCost": 0,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "publicApproval",
        "description": "Computed public approval for the period.",
        "aiPromptRule": "Total count representing the public approval accumulated during this period."
      },
      {
        "key": "taxRevenue",
        "description": "Computed tax revenue for the period.",
        "aiPromptRule": "Currency value representing the total tax revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "publicSpending",
        "description": "Computed public spending for the period.",
        "aiPromptRule": "Currency value representing the total public spending for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetBalance",
        "description": "Computed budget balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current budget balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "citizenSatisfaction",
        "description": "Computed citizen satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest citizen satisfaction at the end of this period."
      },
      {
        "key": "infrastructureScore",
        "description": "Computed infrastructure score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest infrastructure score at the end of this period."
      },
      {
        "key": "educationScore",
        "description": "Computed education score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest education score at the end of this period."
      },
      {
        "key": "publicSafetyScore",
        "description": "Computed public safety score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest public safety score at the end of this period."
      },
      {
        "key": "healthcareAccessScore",
        "description": "Computed healthcare access score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest healthcare access score at the end of this period."
      },
      {
        "key": "housingAccessScore",
        "description": "Computed housing access score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest housing access score at the end of this period."
      },
      {
        "key": "employmentRate",
        "description": "Computed employment rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the employment rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "equityScore",
        "description": "Computed equity score for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current equity score balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "policySupport",
        "description": "Computed policy support for the period.",
        "aiPromptRule": "Total count representing the policy support accumulated during this period."
      },
      {
        "key": "voterTurnout",
        "description": "Computed voter turnout for the period.",
        "aiPromptRule": "Total count representing the voter turnout accumulated during this period."
      },
      {
        "key": "communityTrust",
        "description": "Computed community trust for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest community trust at the end of this period."
      },
      {
        "key": "serviceDeliveryScore",
        "description": "Computed service delivery score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest service delivery score at the end of this period."
      },
      {
        "key": "deficit",
        "description": "Computed deficit for the period.",
        "aiPromptRule": "Total count representing the deficit accumulated during this period."
      },
      {
        "key": "surplus",
        "description": "Computed surplus for the period.",
        "aiPromptRule": "Total count representing the surplus accumulated during this period."
      },
      {
        "key": "longTermStabilityScore",
        "description": "Computed long term stability score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest long term stability score at the end of this period."
      }
    ]
  },
  {
    "key": "default_healthcare_administration_101",
    "label": "Healthcare Administration",
    "description": "Patient satisfaction, clinic throughput, readmission rates, and care compliance indicators.",
    "profileTypes": [
      {
        "key": "family_clinic",
        "label": "Family Clinic",
        "description": "Local medical office offering routine checkups and patient consults.",
        "startingBalance": 10000,
        "initialStartupCost": 3000,
        "isActive": true
      },
      {
        "key": "regional_hospital",
        "label": "Regional Hospital",
        "description": "Emergency and major care medical facility with massive supply costs.",
        "startingBalance": 80000,
        "initialStartupCost": 20000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "patientsServed",
        "description": "Computed patients served for the period.",
        "aiPromptRule": "Total count representing the patients served accumulated during this period."
      },
      {
        "key": "patientSatisfaction",
        "description": "Computed patient satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest patient satisfaction at the end of this period."
      },
      {
        "key": "averageWaitTime",
        "description": "Computed average wait time for the period.",
        "aiPromptRule": "Total count representing the average wait time accumulated during this period."
      },
      {
        "key": "staffUtilization",
        "description": "Computed staff utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest staff utilization at the end of this period."
      },
      {
        "key": "supplyInventory",
        "description": "Computed supply inventory for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest supply inventory at the end of this period."
      },
      {
        "key": "supplyCosts",
        "description": "Computed supply costs for the period.",
        "aiPromptRule": "Currency value representing the total supply costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "laborCosts",
        "description": "Computed labor costs for the period.",
        "aiPromptRule": "Currency value representing the total labor costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operatingCosts",
        "description": "Computed operating costs for the period.",
        "aiPromptRule": "Currency value representing the total operating costs for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "revenue",
        "description": "Computed revenue for the period.",
        "aiPromptRule": "Currency value representing the total revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netMargin",
        "description": "Computed net margin for the period.",
        "aiPromptRule": "Currency value representing the total net margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "readmissionRate",
        "description": "Computed readmission rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the readmission rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "careQualityScore",
        "description": "Computed care quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest care quality score at the end of this period."
      },
      {
        "key": "complianceScore",
        "description": "Computed compliance score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest compliance score at the end of this period."
      },
      {
        "key": "appointmentCapacity",
        "description": "Computed appointment capacity for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest appointment capacity at the end of this period."
      },
      {
        "key": "missedAppointments",
        "description": "Computed missed appointments for the period.",
        "aiPromptRule": "Total count representing the missed appointments accumulated during this period."
      },
      {
        "key": "emergencyCases",
        "description": "Computed emergency cases for the period.",
        "aiPromptRule": "Total count representing the emergency cases accumulated during this period."
      },
      {
        "key": "resourceShortages",
        "description": "Computed resource shortages for the period.",
        "aiPromptRule": "Total count representing the resource shortages accumulated during this period."
      },
      {
        "key": "burnoutScore",
        "description": "Computed burnout score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest burnout score at the end of this period."
      },
      {
        "key": "healthOutcomeScore",
        "description": "Computed health outcome score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest health outcome score at the end of this period."
      }
    ]
  },
  {
    "key": "default_public_health_101",
    "label": "Public Health",
    "description": "Vaccination rates, community outreach outreach, recovery metrics, and county infection rates.",
    "profileTypes": [
      {
        "key": "county_health_board",
        "label": "County Health Board",
        "description": "Regional health oversight and population health metrics.",
        "startingBalance": 12000,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "outreach_campaign",
        "label": "Outreach Campaign",
        "description": "Targeted health programs in the community.",
        "startingBalance": 3000,
        "initialStartupCost": 0,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "populationReached",
        "description": "Computed population reached for the period.",
        "aiPromptRule": "Total count representing the population reached accumulated during this period."
      },
      {
        "key": "casesPrevented",
        "description": "Computed cases prevented for the period.",
        "aiPromptRule": "Total count representing the cases prevented accumulated during this period."
      },
      {
        "key": "infectionRate",
        "description": "Computed infection rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the infection rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "vaccinationRate",
        "description": "Computed vaccination rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the vaccination rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "awarenessScore",
        "description": "Computed awareness score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest awareness score at the end of this period."
      },
      {
        "key": "programCost",
        "description": "Computed program cost for the period.",
        "aiPromptRule": "Currency value representing the total program cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "staffingLevel",
        "description": "Computed staffing level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest staffing level at the end of this period."
      },
      {
        "key": "supplyLevel",
        "description": "Computed supply level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest supply level at the end of this period."
      },
      {
        "key": "responseTime",
        "description": "Computed response time for the period.",
        "aiPromptRule": "Total count representing the response time accumulated during this period."
      },
      {
        "key": "communityTrustScore",
        "description": "Computed community trust score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest community trust score at the end of this period."
      },
      {
        "key": "healthOutcomeScore",
        "description": "Computed health outcome score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest health outcome score at the end of this period."
      },
      {
        "key": "riskLevel",
        "description": "Computed risk level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk level at the end of this period."
      },
      {
        "key": "equityScore",
        "description": "Computed equity score for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current equity score balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "hospitalCapacity",
        "description": "Computed hospital capacity for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest hospital capacity at the end of this period."
      },
      {
        "key": "publicComplianceRate",
        "description": "Computed public compliance rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the public compliance rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "outreachEffectiveness",
        "description": "Computed outreach effectiveness for the period.",
        "aiPromptRule": "Total count representing the outreach effectiveness accumulated during this period."
      },
      {
        "key": "incidentCount",
        "description": "Computed incident count for the period.",
        "aiPromptRule": "Total count representing the incident count accumulated during this period."
      },
      {
        "key": "mortalityRate",
        "description": "Computed mortality rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the mortality rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "recoveryRate",
        "description": "Computed recovery rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the recovery rate. Scale dynamically based on decisions, challenges, and profile constraints."
      }
    ]
  },
  {
    "key": "default_project_management_101",
    "label": "Project Management",
    "description": "Scope changes, project health, team morale, defects, and calendar delay tracking.",
    "profileTypes": [
      {
        "key": "agile_team",
        "label": "Agile Software Team",
        "description": "Software crew delivering iteratively and managing story point capacity.",
        "startingBalance": 4000,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "waterfall_corp",
        "label": "Waterfall Corp Project",
        "description": "Large infrastructure planning with complex budgets and schedules.",
        "startingBalance": 45000,
        "initialStartupCost": 10000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "budgetPlanned",
        "description": "Computed budget planned for the period.",
        "aiPromptRule": "Currency value representing the total budget planned for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetSpent",
        "description": "Computed budget spent for the period.",
        "aiPromptRule": "Currency value representing the total budget spent for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetRemaining",
        "description": "Computed budget remaining for the period.",
        "aiPromptRule": "Currency value representing the total budget remaining for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "tasksCompleted",
        "description": "Computed tasks completed for the period.",
        "aiPromptRule": "Total count representing the tasks completed accumulated during this period."
      },
      {
        "key": "tasksDelayed",
        "description": "Computed tasks delayed for the period.",
        "aiPromptRule": "Total count representing the tasks delayed accumulated during this period."
      },
      {
        "key": "scopeChangeCount",
        "description": "Computed scope change count for the period.",
        "aiPromptRule": "Total count representing the scope change count accumulated during this period."
      },
      {
        "key": "teamCapacity",
        "description": "Computed team capacity for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest team capacity at the end of this period."
      },
      {
        "key": "teamMorale",
        "description": "Computed team morale for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest team morale at the end of this period."
      },
      {
        "key": "qualityScore",
        "description": "Computed quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest quality score at the end of this period."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      },
      {
        "key": "timelineProgress",
        "description": "Computed timeline progress for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest timeline progress at the end of this period."
      },
      {
        "key": "deadlineVariance",
        "description": "Computed deadline variance for the period.",
        "aiPromptRule": "Total count representing the deadline variance accumulated during this period."
      },
      {
        "key": "resourceUtilization",
        "description": "Computed resource utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest resource utilization at the end of this period."
      },
      {
        "key": "stakeholderSatisfaction",
        "description": "Computed stakeholder satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest stakeholder satisfaction at the end of this period."
      },
      {
        "key": "defectCount",
        "description": "Computed defect count for the period.",
        "aiPromptRule": "Total count representing the defect count accumulated during this period."
      },
      {
        "key": "reworkHours",
        "description": "Computed rework hours for the period.",
        "aiPromptRule": "Total count representing the rework hours accumulated during this period."
      },
      {
        "key": "deliveryConfidence",
        "description": "Computed delivery confidence for the period.",
        "aiPromptRule": "Total count representing the delivery confidence accumulated during this period."
      },
      {
        "key": "projectHealthScore",
        "description": "Computed project health score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest project health score at the end of this period."
      }
    ]
  },
  {
    "key": "default_software_development_101",
    "label": "Software Development",
    "description": "Story points, code coverage, deployment failures, technical debt, and team velocity.",
    "profileTypes": [
      {
        "key": "saas_startup",
        "label": "SaaS Startup",
        "description": "Bootstrapping software products with rapid deployment schedules.",
        "startingBalance": 8000,
        "initialStartupCost": 2000,
        "isActive": true
      },
      {
        "key": "enterprise_dev",
        "label": "Enterprise Dev Team",
        "description": "Large engineering department prioritizing code quality and test coverage.",
        "startingBalance": 30000,
        "initialStartupCost": 5000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "featuresCompleted",
        "description": "Computed features completed for the period.",
        "aiPromptRule": "Total count representing the features completed accumulated during this period."
      },
      {
        "key": "storyPointsCompleted",
        "description": "Computed story points completed for the period.",
        "aiPromptRule": "Total count representing the story points completed accumulated during this period."
      },
      {
        "key": "bugsReported",
        "description": "Computed bugs reported for the period.",
        "aiPromptRule": "Total count representing the bugs reported accumulated during this period."
      },
      {
        "key": "bugsResolved",
        "description": "Computed bugs resolved for the period.",
        "aiPromptRule": "Total count representing the bugs resolved accumulated during this period."
      },
      {
        "key": "technicalDebtScore",
        "description": "Computed technical debt score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest technical debt score at the end of this period."
      },
      {
        "key": "codeQualityScore",
        "description": "Computed code quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest code quality score at the end of this period."
      },
      {
        "key": "testCoverage",
        "description": "Computed test coverage for the period.",
        "aiPromptRule": "Total count representing the test coverage accumulated during this period."
      },
      {
        "key": "deploymentFrequency",
        "description": "Computed deployment frequency for the period.",
        "aiPromptRule": "Total count representing the deployment frequency accumulated during this period."
      },
      {
        "key": "failedDeployments",
        "description": "Computed failed deployments for the period.",
        "aiPromptRule": "Total count representing the failed deployments accumulated during this period."
      },
      {
        "key": "userAdoption",
        "description": "Computed user adoption for the period.",
        "aiPromptRule": "Total count representing the user adoption accumulated during this period."
      },
      {
        "key": "activeUsers",
        "description": "Computed active users for the period.",
        "aiPromptRule": "Total count representing the active users accumulated during this period."
      },
      {
        "key": "churnRate",
        "description": "Computed churn rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the churn rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "supportTickets",
        "description": "Computed support tickets for the period.",
        "aiPromptRule": "Currency value representing the total support tickets for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "developmentCost",
        "description": "Computed development cost for the period.",
        "aiPromptRule": "Currency value representing the total development cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "infrastructureCost",
        "description": "Computed infrastructure cost for the period.",
        "aiPromptRule": "Currency value representing the total infrastructure cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "teamVelocity",
        "description": "Computed team velocity for the period.",
        "aiPromptRule": "Total count representing the team velocity accumulated during this period."
      },
      {
        "key": "customerSatisfaction",
        "description": "Computed customer satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest customer satisfaction at the end of this period."
      },
      {
        "key": "securityRiskScore",
        "description": "Computed security risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest security risk score at the end of this period."
      },
      {
        "key": "productMarketFitScore",
        "description": "Computed product market fit score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest product market fit score at the end of this period."
      }
    ]
  },
  {
    "key": "default_cybersecurity_101",
    "label": "Cybersecurity",
    "description": "Phishing failure rates, open vulnerabilities, incident resolution speeds, and compliance marks.",
    "profileTypes": [
      {
        "key": "soc_operations",
        "label": "SOC Operations",
        "description": "Security team monitoring networks and detecting intrusions.",
        "startingBalance": 12000,
        "initialStartupCost": 2500,
        "isActive": true
      },
      {
        "key": "compliance_audit",
        "label": "Compliance Auditing",
        "description": "Reviewing company training scores and patching vulnerabilities.",
        "startingBalance": 6000,
        "initialStartupCost": 1000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "securityBudget",
        "description": "Computed security budget for the period.",
        "aiPromptRule": "Total count representing the security budget accumulated during this period."
      },
      {
        "key": "riskExposure",
        "description": "Computed risk exposure for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk exposure at the end of this period."
      },
      {
        "key": "incidentsDetected",
        "description": "Computed incidents detected for the period.",
        "aiPromptRule": "Total count representing the incidents detected accumulated during this period."
      },
      {
        "key": "incidentsResolved",
        "description": "Computed incidents resolved for the period.",
        "aiPromptRule": "Total count representing the incidents resolved accumulated during this period."
      },
      {
        "key": "breachImpactScore",
        "description": "Computed breach impact score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest breach impact score at the end of this period."
      },
      {
        "key": "vulnerabilitiesOpen",
        "description": "Computed vulnerabilities open for the period.",
        "aiPromptRule": "Total count representing the vulnerabilities open accumulated during this period."
      },
      {
        "key": "vulnerabilitiesPatched",
        "description": "Computed vulnerabilities patched for the period.",
        "aiPromptRule": "Total count representing the vulnerabilities patched accumulated during this period."
      },
      {
        "key": "complianceScore",
        "description": "Computed compliance score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest compliance score at the end of this period."
      },
      {
        "key": "employeeTrainingScore",
        "description": "Computed employee training score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest employee training score at the end of this period."
      },
      {
        "key": "phishingFailureRate",
        "description": "Computed phishing failure rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the phishing failure rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "responseTime",
        "description": "Computed response time for the period.",
        "aiPromptRule": "Total count representing the response time accumulated during this period."
      },
      {
        "key": "downtimeHours",
        "description": "Computed downtime hours for the period.",
        "aiPromptRule": "Total count representing the downtime hours accumulated during this period."
      },
      {
        "key": "dataLossRisk",
        "description": "Computed data loss risk for the period.",
        "aiPromptRule": "Total count representing the data loss risk accumulated during this period."
      },
      {
        "key": "reputationImpact",
        "description": "Computed reputation impact for the period.",
        "aiPromptRule": "Total count representing the reputation impact accumulated during this period."
      },
      {
        "key": "securityMaturityScore",
        "description": "Computed security maturity score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest security maturity score at the end of this period."
      },
      {
        "key": "attackSurfaceScore",
        "description": "Computed attack surface score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest attack surface score at the end of this period."
      },
      {
        "key": "recoveryCost",
        "description": "Computed recovery cost for the period.",
        "aiPromptRule": "Currency value representing the total recovery cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "resilienceScore",
        "description": "Computed resilience score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest resilience score at the end of this period."
      }
    ]
  },
  {
    "key": "default_human_resources_101",
    "label": "Human Resources",
    "description": "Turnover, recruitment speed, employee satisfaction, manager effectiveness, and payroll load.",
    "profileTypes": [
      {
        "key": "recruiting_agency",
        "label": "Recruiting Agency",
        "description": "High volume placements focusing on time-to-hire metrics.",
        "startingBalance": 4000,
        "initialStartupCost": 500,
        "isActive": true
      },
      {
        "key": "corporate_hr",
        "label": "Corporate HR Dept",
        "description": "Internal personnel management and employee retention programs.",
        "startingBalance": 10000,
        "initialStartupCost": 1500,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "employeeCount",
        "description": "Computed employee count for the period.",
        "aiPromptRule": "Total count representing the employee count accumulated during this period."
      },
      {
        "key": "newHires",
        "description": "Computed new hires for the period.",
        "aiPromptRule": "Total count representing the new hires accumulated during this period."
      },
      {
        "key": "turnoverRate",
        "description": "Computed turnover rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the turnover rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "retentionRate",
        "description": "Computed retention rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the retention rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "trainingCost",
        "description": "Computed training cost for the period.",
        "aiPromptRule": "Currency value representing the total training cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "recruitingCost",
        "description": "Computed recruiting cost for the period.",
        "aiPromptRule": "Currency value representing the total recruiting cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "employeeSatisfaction",
        "description": "Computed employee satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest employee satisfaction at the end of this period."
      },
      {
        "key": "productivityScore",
        "description": "Computed productivity score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest productivity score at the end of this period."
      },
      {
        "key": "absenteeismRate",
        "description": "Computed absenteeism rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the absenteeism rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "engagementScore",
        "description": "Computed engagement score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest engagement score at the end of this period."
      },
      {
        "key": "payrollCost",
        "description": "Computed payroll cost for the period.",
        "aiPromptRule": "Currency value representing the total payroll cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "benefitsCost",
        "description": "Computed benefits cost for the period.",
        "aiPromptRule": "Currency value representing the total benefits cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "openPositions",
        "description": "Computed open positions for the period.",
        "aiPromptRule": "Total count representing the open positions accumulated during this period."
      },
      {
        "key": "timeToHire",
        "description": "Computed time to hire for the period.",
        "aiPromptRule": "Total count representing the time to hire accumulated during this period."
      },
      {
        "key": "promotionRate",
        "description": "Computed promotion rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the promotion rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "diversityScore",
        "description": "Computed diversity score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest diversity score at the end of this period."
      },
      {
        "key": "managerEffectivenessScore",
        "description": "Computed manager effectiveness score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest manager effectiveness score at the end of this period."
      },
      {
        "key": "teamMorale",
        "description": "Computed team morale for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest team morale at the end of this period."
      },
      {
        "key": "complianceScore",
        "description": "Computed compliance score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest compliance score at the end of this period."
      }
    ]
  },
  {
    "key": "default_education_administration_101",
    "label": "Education Administration",
    "description": "Attendance, student test scores, parent engagement, class sizes, and academic growth averages.",
    "profileTypes": [
      {
        "key": "charter_district",
        "label": "Charter District",
        "description": "Managing community charter schools and district budgets.",
        "startingBalance": 30000,
        "initialStartupCost": 0,
        "isActive": true
      },
      {
        "key": "university_dept",
        "label": "University Department",
        "description": "Higher ed administration managing research grants and graduation rates.",
        "startingBalance": 90000,
        "initialStartupCost": 0,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "studentsServed",
        "description": "Computed students served for the period.",
        "aiPromptRule": "Total count representing the students served accumulated during this period."
      },
      {
        "key": "attendanceRate",
        "description": "Computed attendance rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the attendance rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "graduationRate",
        "description": "Computed graduation rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the graduation rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "testScoreAverage",
        "description": "Computed test score average for the period.",
        "aiPromptRule": "Total count representing the test score average accumulated during this period."
      },
      {
        "key": "studentSatisfaction",
        "description": "Computed student satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest student satisfaction at the end of this period."
      },
      {
        "key": "teacherSatisfaction",
        "description": "Computed teacher satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest teacher satisfaction at the end of this period."
      },
      {
        "key": "budgetSpent",
        "description": "Computed budget spent for the period.",
        "aiPromptRule": "Currency value representing the total budget spent for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "budgetRemaining",
        "description": "Computed budget remaining for the period.",
        "aiPromptRule": "Currency value representing the total budget remaining for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "programCost",
        "description": "Computed program cost for the period.",
        "aiPromptRule": "Currency value representing the total program cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "interventionSuccessRate",
        "description": "Computed intervention success rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the intervention success rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "disciplineIncidents",
        "description": "Computed discipline incidents for the period.",
        "aiPromptRule": "Total count representing the discipline incidents accumulated during this period."
      },
      {
        "key": "parentEngagement",
        "description": "Computed parent engagement for the period.",
        "aiPromptRule": "Total count representing the parent engagement accumulated during this period."
      },
      {
        "key": "staffingLevel",
        "description": "Computed staffing level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest staffing level at the end of this period."
      },
      {
        "key": "classSizeAverage",
        "description": "Computed class size average for the period.",
        "aiPromptRule": "Total count representing the class size average accumulated during this period."
      },
      {
        "key": "resourceAvailability",
        "description": "Computed resource availability for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest resource availability at the end of this period."
      },
      {
        "key": "equityScore",
        "description": "Computed equity score for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current equity score balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "retentionRate",
        "description": "Computed retention rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the retention rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "academicGrowthScore",
        "description": "Computed academic growth score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest academic growth score at the end of this period."
      }
    ]
  },
  {
    "key": "default_nonprofit_management_101",
    "label": "Nonprofit Management",
    "description": "Donations, fundraising costs, grant usage, restricted/unrestricted reserves, and public trust indicators.",
    "profileTypes": [
      {
        "key": "charitable_trust",
        "label": "Charitable Trust",
        "description": "Distributing restricted funds for community aid projects.",
        "startingBalance": 15000,
        "initialStartupCost": 1000,
        "isActive": true
      },
      {
        "key": "advocacy_group",
        "label": "Advocacy Group",
        "description": "Active volunteer coordination and donor recruitment campaigns.",
        "startingBalance": 5000,
        "initialStartupCost": 500,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "donationsReceived",
        "description": "Computed donations received for the period.",
        "aiPromptRule": "Total count representing the donations received accumulated during this period."
      },
      {
        "key": "grantFunding",
        "description": "Computed grant funding for the period.",
        "aiPromptRule": "Currency value representing the total grant funding for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "programExpenses",
        "description": "Computed program expenses for the period.",
        "aiPromptRule": "Currency value representing the total program expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operatingExpenses",
        "description": "Computed operating expenses for the period.",
        "aiPromptRule": "Currency value representing the total operating expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "volunteerHours",
        "description": "Computed volunteer hours for the period.",
        "aiPromptRule": "Total count representing the volunteer hours accumulated during this period."
      },
      {
        "key": "peopleServed",
        "description": "Computed people served for the period.",
        "aiPromptRule": "Total count representing the people served accumulated during this period."
      },
      {
        "key": "donorRetentionRate",
        "description": "Computed donor retention rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the donor retention rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "newDonors",
        "description": "Computed new donors for the period.",
        "aiPromptRule": "Total count representing the new donors accumulated during this period."
      },
      {
        "key": "fundraisingCost",
        "description": "Computed fundraising cost for the period.",
        "aiPromptRule": "Currency value representing the total fundraising cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "programImpactScore",
        "description": "Computed program impact score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest program impact score at the end of this period."
      },
      {
        "key": "communityReach",
        "description": "Computed community reach for the period.",
        "aiPromptRule": "Total count representing the community reach accumulated during this period."
      },
      {
        "key": "eventAttendance",
        "description": "Computed event attendance for the period.",
        "aiPromptRule": "Total count representing the event attendance accumulated during this period."
      },
      {
        "key": "cashBalance",
        "description": "Computed cash balance for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current cash balance balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "restrictedFunds",
        "description": "Computed restricted funds for the period.",
        "aiPromptRule": "Currency value representing the total restricted funds for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "unrestrictedFunds",
        "description": "Computed unrestricted funds for the period.",
        "aiPromptRule": "Currency value representing the total unrestricted funds for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "serviceQualityScore",
        "description": "Computed service quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest service quality score at the end of this period."
      },
      {
        "key": "missionAlignmentScore",
        "description": "Computed mission alignment score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest mission alignment score at the end of this period."
      },
      {
        "key": "publicTrustScore",
        "description": "Computed public trust score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest public trust score at the end of this period."
      }
    ]
  },
  {
    "key": "default_construction_management_101",
    "label": "Construction / Skilled Trades",
    "description": "Estimates, cost to date, material waste, delay days, change orders, and inspector approval rates.",
    "profileTypes": [
      {
        "key": "residential_builder",
        "label": "Residential Builder",
        "description": "Single-family home projects with high material waste controls.",
        "startingBalance": 25000,
        "initialStartupCost": 8000,
        "isActive": true
      },
      {
        "key": "commercial_contractor",
        "label": "Commercial Contractor",
        "description": "Corporate structures with subcontractor costs and heavy schedules.",
        "startingBalance": 100000,
        "initialStartupCost": 25000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "projectBudget",
        "description": "Computed project budget for the period.",
        "aiPromptRule": "Total count representing the project budget accumulated during this period."
      },
      {
        "key": "costToDate",
        "description": "Computed cost to date for the period.",
        "aiPromptRule": "Currency value representing the total cost to date for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "materialsUsed",
        "description": "Computed materials used for the period.",
        "aiPromptRule": "Total count representing the materials used accumulated during this period."
      },
      {
        "key": "materialWaste",
        "description": "Computed material waste for the period.",
        "aiPromptRule": "Total count representing the material waste accumulated during this period."
      },
      {
        "key": "laborHours",
        "description": "Computed labor hours for the period.",
        "aiPromptRule": "Total count representing the labor hours accumulated during this period."
      },
      {
        "key": "laborCost",
        "description": "Computed labor cost for the period.",
        "aiPromptRule": "Currency value representing the total labor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "scheduleProgress",
        "description": "Computed schedule progress for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest schedule progress at the end of this period."
      },
      {
        "key": "delayDays",
        "description": "Computed delay days for the period.",
        "aiPromptRule": "Total count representing the delay days accumulated during this period."
      },
      {
        "key": "changeOrders",
        "description": "Computed change orders for the period.",
        "aiPromptRule": "Total count representing the change orders accumulated during this period."
      },
      {
        "key": "safetyIncidents",
        "description": "Computed safety incidents for the period.",
        "aiPromptRule": "Total count representing the safety incidents accumulated during this period."
      },
      {
        "key": "inspectionScore",
        "description": "Computed inspection score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest inspection score at the end of this period."
      },
      {
        "key": "qualityScore",
        "description": "Computed quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest quality score at the end of this period."
      },
      {
        "key": "equipmentUtilization",
        "description": "Computed equipment utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest equipment utilization at the end of this period."
      },
      {
        "key": "subcontractorCost",
        "description": "Computed subcontractor cost for the period.",
        "aiPromptRule": "Currency value representing the total subcontractor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "clientSatisfaction",
        "description": "Computed client satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest client satisfaction at the end of this period."
      },
      {
        "key": "profitMargin",
        "description": "Computed profit margin for the period.",
        "aiPromptRule": "Currency value representing the total profit margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "completionPercentage",
        "description": "Computed completion percentage for the period.",
        "aiPromptRule": "Total count representing the completion percentage accumulated during this period."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      }
    ]
  },
  {
    "key": "default_manufacturing_101",
    "label": "Manufacturing",
    "description": "Units defect rates, machine utilization, scrap waste, lead/cycle times, and throughput efficiency.",
    "profileTypes": [
      {
        "key": "part_supplier",
        "label": "Automotive Part Supplier",
        "description": "Supplier plant making parts with strict scrap rate limits.",
        "startingBalance": 20000,
        "initialStartupCost": 5000,
        "isActive": true
      },
      {
        "key": "electronics_assembly",
        "label": "Electronics Assembly",
        "description": "Precision board assemblies requiring high quality control.",
        "startingBalance": 60000,
        "initialStartupCost": 15000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "unitsProduced",
        "description": "Computed units produced for the period.",
        "aiPromptRule": "Total count representing the units produced accumulated during this period."
      },
      {
        "key": "unitsDefective",
        "description": "Computed units defective for the period.",
        "aiPromptRule": "Total count representing the units defective accumulated during this period."
      },
      {
        "key": "defectRate",
        "description": "Computed defect rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the defect rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "productionCost",
        "description": "Computed production cost for the period.",
        "aiPromptRule": "Currency value representing the total production cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "laborCost",
        "description": "Computed labor cost for the period.",
        "aiPromptRule": "Currency value representing the total labor cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "materialCost",
        "description": "Computed material cost for the period.",
        "aiPromptRule": "Currency value representing the total material cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "machineUtilization",
        "description": "Computed machine utilization for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest machine utilization at the end of this period."
      },
      {
        "key": "downtimeHours",
        "description": "Computed downtime hours for the period.",
        "aiPromptRule": "Total count representing the downtime hours accumulated during this period."
      },
      {
        "key": "throughput",
        "description": "Computed throughput for the period.",
        "aiPromptRule": "Total count representing the throughput accumulated during this period."
      },
      {
        "key": "cycleTime",
        "description": "Computed cycle time for the period.",
        "aiPromptRule": "Total count representing the cycle time accumulated during this period."
      },
      {
        "key": "inventoryLevel",
        "description": "Computed inventory level for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest inventory level at the end of this period."
      },
      {
        "key": "scrapWaste",
        "description": "Computed scrap waste for the period.",
        "aiPromptRule": "Total count representing the scrap waste accumulated during this period."
      },
      {
        "key": "qualityScore",
        "description": "Computed quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest quality score at the end of this period."
      },
      {
        "key": "ordersFulfilled",
        "description": "Computed orders fulfilled for the period.",
        "aiPromptRule": "Total count representing the orders fulfilled accumulated during this period."
      },
      {
        "key": "backlog",
        "description": "Computed backlog for the period.",
        "aiPromptRule": "Total count representing the backlog accumulated during this period."
      },
      {
        "key": "onTimeDeliveryRate",
        "description": "Computed on time delivery rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the on time delivery rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "grossMargin",
        "description": "Computed gross margin for the period.",
        "aiPromptRule": "Currency value representing the total gross margin for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netProfit",
        "description": "Computed net profit for the period.",
        "aiPromptRule": "Currency value representing the total net profit for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "efficiencyScore",
        "description": "Computed efficiency score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest efficiency score at the end of this period."
      }
    ]
  },
  {
    "key": "default_real_estate_101",
    "label": "Real Estate",
    "description": "Rentals, occupancy rates, cash flow, maintenance, lease renewals, and days on market.",
    "profileTypes": [
      {
        "key": "residential_landlord",
        "label": "Residential Landlord",
        "description": "Leasing single-family and multi-family homes to tenants.",
        "startingBalance": 15000,
        "initialStartupCost": 3000,
        "isActive": true
      },
      {
        "key": "commercial_reit",
        "label": "Commercial REIT",
        "description": "Real Estate Investment Trust managing retail complexes.",
        "startingBalance": 120000,
        "initialStartupCost": 30000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "propertyValue",
        "description": "Computed property value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current property value balance. Add revenues/funding and subtract costs/expenses."
      },
      {
        "key": "rentalIncome",
        "description": "Computed rental income for the period.",
        "aiPromptRule": "Currency value representing the total rental income for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "occupancyRate",
        "description": "Computed occupancy rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the occupancy rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "vacancyRate",
        "description": "Computed vacancy rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the vacancy rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "maintenanceCost",
        "description": "Computed maintenance cost for the period.",
        "aiPromptRule": "Currency value representing the total maintenance cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "operatingExpenses",
        "description": "Computed operating expenses for the period.",
        "aiPromptRule": "Currency value representing the total operating expenses for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "netOperatingIncome",
        "description": "Computed net operating income for the period.",
        "aiPromptRule": "Currency value representing the total net operating income for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "cashFlow",
        "description": "Computed cash flow for the period.",
        "aiPromptRule": "Total count representing the cash flow accumulated during this period."
      },
      {
        "key": "debtService",
        "description": "Computed debt service for the period.",
        "aiPromptRule": "Total count representing the debt service accumulated during this period."
      },
      {
        "key": "capRate",
        "description": "Computed cap rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the cap rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "tenantSatisfaction",
        "description": "Computed tenant satisfaction for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest tenant satisfaction at the end of this period."
      },
      {
        "key": "leaseRenewalRate",
        "description": "Computed lease renewal rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the lease renewal rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "marketingCost",
        "description": "Computed marketing cost for the period.",
        "aiPromptRule": "Currency value representing the total marketing cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "daysOnMarket",
        "description": "Computed days on market for the period.",
        "aiPromptRule": "Total count representing the days on market accumulated during this period."
      },
      {
        "key": "appreciationRate",
        "description": "Computed appreciation rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the appreciation rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "repairBacklog",
        "description": "Computed repair backlog for the period.",
        "aiPromptRule": "Total count representing the repair backlog accumulated during this period."
      },
      {
        "key": "riskScore",
        "description": "Computed risk score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest risk score at the end of this period."
      },
      {
        "key": "portfolioValue",
        "description": "Computed portfolio value for the period.",
        "aiPromptRule": "Carry-forward currency value representing the current portfolio value balance. Add revenues/funding and subtract costs/expenses."
      }
    ]
  },
  {
    "key": "default_media_content_creation_101",
    "label": "Media / Content Creation",
    "description": "Subscribers, video watch times, engagement, brand deals, production costs, and net platform revenues.",
    "profileTypes": [
      {
        "key": "solo_influencer",
        "label": "Solo Influencer",
        "description": "Single operator managing their own channel view count.",
        "startingBalance": 500,
        "initialStartupCost": 100,
        "isActive": true
      },
      {
        "key": "production_company",
        "label": "Production House",
        "description": "Studio producing commercial videos and managing ad sponsorships.",
        "startingBalance": 8000,
        "initialStartupCost": 2000,
        "isActive": true
      }
    ],
    "metrics": [
      {
        "key": "contentPublished",
        "description": "Computed content published for the period.",
        "aiPromptRule": "Total count representing the content published accumulated during this period."
      },
      {
        "key": "views",
        "description": "Computed views for the period.",
        "aiPromptRule": "Total count representing the views accumulated during this period."
      },
      {
        "key": "watchTime",
        "description": "Computed watch time for the period.",
        "aiPromptRule": "Total count representing the watch time accumulated during this period."
      },
      {
        "key": "followers",
        "description": "Computed followers for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest followers at the end of this period."
      },
      {
        "key": "subscribers",
        "description": "Computed subscribers for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest subscribers at the end of this period."
      },
      {
        "key": "engagementRate",
        "description": "Computed engagement rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the engagement rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "shareRate",
        "description": "Computed share rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the share rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "comments",
        "description": "Computed comments for the period.",
        "aiPromptRule": "Total count representing the comments accumulated during this period."
      },
      {
        "key": "productionCost",
        "description": "Computed production cost for the period.",
        "aiPromptRule": "Currency value representing the total production cost for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "adRevenue",
        "description": "Computed ad revenue for the period.",
        "aiPromptRule": "Currency value representing the total ad revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "sponsorRevenue",
        "description": "Computed sponsor revenue for the period.",
        "aiPromptRule": "Currency value representing the total sponsor revenue for this period. Compute based on operations, pricing, and event outcomes."
      },
      {
        "key": "brandDeals",
        "description": "Computed brand deals for the period.",
        "aiPromptRule": "Total count representing the brand deals accumulated during this period."
      },
      {
        "key": "audienceGrowth",
        "description": "Computed audience growth for the period.",
        "aiPromptRule": "Total count representing the audience growth accumulated during this period."
      },
      {
        "key": "retentionRate",
        "description": "Computed retention rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the retention rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "contentQualityScore",
        "description": "Computed content quality score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest content quality score at the end of this period."
      },
      {
        "key": "reputationScore",
        "description": "Computed reputation score for the period.",
        "aiPromptRule": "Carry-forward count/value representing the latest reputation score at the end of this period."
      },
      {
        "key": "conversionRate",
        "description": "Computed conversion rate for the period.",
        "aiPromptRule": "Decimal value between 0 and 1 (e.g., 0.05 for 5%) representing the conversion rate. Scale dynamically based on decisions, challenges, and profile constraints."
      },
      {
        "key": "profit",
        "description": "Computed profit for the period.",
        "aiPromptRule": "Currency value representing the total profit for this period. Compute based on operations, pricing, and event outcomes."
      }
    ]
  }
];
