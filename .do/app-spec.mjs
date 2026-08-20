const PROJECT_ID = "5da22275-cacb-4511-86cb-1c590971397d";
const MONGO_CLUSTER = "db-mongodb-nyc3-43254";
const PROD_VALKEY_CLUSTER = "scalelxp-valkey-prod";
const DEV_VALKEY_CLUSTER = "scalelxp-valkey-dev";
const COMPONENT_SIZE = "apps-s-1vcpu-0.5gb";

const ENVIRONMENTS = {
  dev: {
    appName: "scalelxp-dev",
    branch: "develop",
    marketingBranch: "develop",
    marketingDomain: "dev.scalelxp.com",
    appDomain: "app-dev.scalelxp.com",
    apiDomain: "api-dev.scalelxp.com",
    webhookDomain: "webhooks-dev.scalelxp.com",
    mongoDatabase: "scale_dev",
    sendEmail: "false",
    envFile: ".env.development",
  },
  prod: {
    appName: "scalelxp-prod",
    branch: "main",
    marketingBranch: "main",
    marketingDomain: "scalelxp.com",
    appDomain: "app.scalelxp.com",
    apiDomain: "api.scalelxp.com",
    webhookDomain: "webhooks.scalelxp.com",
    mongoDatabase: "scale_prod",
    sendEmail: "true",
    envFile: ".env.production",
  },
};

const secretKeys = [
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GAMMA_API_KEY",
  "SENDGRID_WEBHOOK_KEY",
  "SPACES_API_KEY",
  "SPACES_API_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "QUEUE_ADMIN_BASIC_AUTH_USER",
  "QUEUE_ADMIN_BASIC_AUTH_PASS",
];

const optionalGeneralKeys = [
  "AI_DEBUG_DECISION_ID",
  "AI_DEBUG_REQUEST_BODY",
  "AI_DEBUG_REQUESTS",
  "AI_MAX_MESSAGE_CHARS",
  "AI_MODEL",
  "AUTO_GENERATE_SUBMISSIONS_ON_PUBLISH",
  "AUTO_SUBMISSION_CONCURRENCY",
  "AUTO_SUBMISSION_MODEL",
  "EMAIL_JOB_DELAY_MS",
  "EMAIL_RATE_LIMIT_DURATION_MS",
  "EMAIL_RATE_LIMIT_MAX",
  "EMAIL_WORKER_CONCURRENCY",
  "FREE_TEACHER_CLASSROOM_LIMIT",
  "GAMMA_THEME_ID",
  "OUTCOME_PROCESSING_CONCURRENCY",
  "SENDGRID_API_KEY_ID",
  "SENDGRID_FROM_EMAIL",
  "SENDGRID_FROM_NAME",
  "SIMULATION_BATCH_CONCURRENCY",
  "SIMULATION_CONCURRENCY",
  "SIMULATION_MODE",
  "SIMULATION_RATE_LIMIT_DURATION_MS",
  "SIMULATION_RATE_LIMIT_MAX",
  "SIM_BATCH_POLL_FINALIZING_SECONDS",
  "SIM_BATCH_POLL_MAX_SECONDS",
  "SIM_BATCH_POLL_SECONDS",
  "SIM_SCENARIO_MODEL",
  "SPACES_BUCKET",
  "SPACES_ENDPOINT",
  "STRIPE_CHECKOUT_CANCEL_URL",
  "STRIPE_CHECKOUT_SUCCESS_URL",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SEAT_PRICE_ID",
  "STRIPE_SEAT_PRODUCT_ID",
];

function env(key, value, { scope = "RUN_TIME", type } = {}) {
  const item = { key, value: String(value), scope };
  if (type) item.type = type;
  return item;
}

function requireValue(values, key) {
  const value = values[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required deployment value: ${key}`);
  }
  return value;
}

function backendEnvs(config, values, portKey, port) {
  const result = [
    env("NODE_ENV", "production"),
    env(portKey, port),
    env("SCALE_API_HOST", `https://${config.apiDomain}`),
    env("SCALE_API_VERSION", "v1"),
    env("SCALE_APP_HOST", `https://${config.appDomain}`),
    env("SCALE_ADMIN_HOST", `https://${config.appDomain}`),
    env("CORS_ALLOWED_ORIGINS", `https://${config.appDomain}`),
    env("MONGO_SCHEME", "mongodb+srv"),
    env("MONGO_USERNAME", "${mongo.USERNAME}", { type: "SECRET" }),
    env("MONGO_PASSWORD", "${mongo.PASSWORD}", { type: "SECRET" }),
    env("MONGO_HOSTNAME", "${mongo.HOSTNAME}"),
    env("MONGO_PORT", "${mongo.PORT}"),
    env("MONGO_DB", config.mongoDatabase),
    env("REDIS_HOST", "${valkey.HOSTNAME}"),
    env("REDIS_USERNAME", "${valkey.USERNAME}", { type: "SECRET" }),
    env("REDIS_PASSWORD", "${valkey.PASSWORD}", { type: "SECRET" }),
    env("REDIS_PORT", "${valkey.PORT}"),
    env("REDIS_DB", "0"),
    env("REDIS_TLS", "true"),
    env("WORKERS_ENABLED", "true"),
    env("SEND_EMAIL", config.sendEmail),
    env("CLERK_PUBLISHABLE_KEY", requireValue(values, "CLERK_PUBLISHABLE_KEY")),
  ];

  for (const key of secretKeys) {
    if (values[key]) result.push(env(key, values[key], { type: "SECRET" }));
  }
  for (const key of optionalGeneralKeys) {
    if (values[key]) result.push(env(key, values[key]));
  }

  return result;
}

function githubSource(repo, branch) {
  return { repo, branch, deploy_on_push: true };
}

function serviceBase(name, repo, branch) {
  return {
    name,
    github: githubSource(repo, branch),
    source_dir: "/",
    instance_size_slug: COMPONENT_SIZE,
    instance_count: 1,
  };
}

function domain(domainName, type) {
  return { domain: domainName, type, zone: "scalelxp.com" };
}

function route(authority, componentName) {
  return {
    match: { path: { prefix: "/" }, authority: { exact: authority } },
    component: { name: componentName },
  };
}

export function getEnvironmentConfig(environment) {
  const config = ENVIRONMENTS[environment];
  if (!config) throw new Error(`Unknown environment: ${environment}`);
  return config;
}

export function buildAppSpec(environment, values) {
  const config = getEnvironmentConfig(environment);
  requireValue(values, "CLERK_PUBLISHABLE_KEY");
  requireValue(values, "CLERK_SECRET_KEY");
  requireValue(values, "CLERK_WEBHOOK_SECRET");
  requireValue(values, "OPENAI_API_KEY");
  requireValue(values, "SENDGRID_API_KEY");
  requireValue(values, "SPACES_API_KEY");
  requireValue(values, "SPACES_API_SECRET");

  const marketing = {
    ...serviceBase("marketing", "facingmonday/scale-ai-com", config.marketingBranch),
    dockerfile_path: "/Dockerfile",
    http_port: 3000,
  };

  const api = {
    ...serviceBase("api", "facingmonday/scale-ai-api", config.branch),
    environment_slug: "node-js",
    run_command: "npm run start:api",
    http_port: 1337,
    health_check: {
      http_path: "/health-check",
      initial_delay_seconds: 30,
      period_seconds: 10,
      timeout_seconds: 5,
      success_threshold: 1,
      failure_threshold: 5,
    },
    envs: backendEnvs(config, values, "PORT", 1337),
  };

  const webhooks = {
    ...serviceBase("webhooks", "facingmonday/scale-ai-api", config.branch),
    environment_slug: "node-js",
    run_command: "npm run start:webhooks",
    http_port: 1340,
    health_check: {
      http_path: "/",
      initial_delay_seconds: 30,
      period_seconds: 10,
      timeout_seconds: 5,
      success_threshold: 1,
      failure_threshold: 5,
    },
    envs: backendEnvs(config, values, "PORT_WEBHOOKS", 1340),
  };

  const worker = {
    ...serviceBase("workers", "facingmonday/scale-ai-api", config.branch),
    environment_slug: "node-js",
    run_command: "npm run start:workers",
    envs: backendEnvs(config, values, "PORT_WORKERS", 1341),
  };

  const databases = [
    {
      name: "mongo",
      engine: "MONGODB",
      version: "8",
      production: true,
      cluster_name: MONGO_CLUSTER,
    },
    {
      name: "valkey",
      engine: "VALKEY",
      version: "8",
      production: true,
      cluster_name:
        environment === "prod" ? PROD_VALKEY_CLUSTER : DEV_VALKEY_CLUSTER,
    },
  ];

  return {
    name: config.appName,
    region: "nyc",
    envs: [env("SENDGRID_API_KEY", requireValue(values, "SENDGRID_API_KEY"))],
    services: [marketing, api, webhooks],
    workers: [worker],
    static_sites: [
      {
        name: "web",
        github: githubSource("facingmonday/scale-ai-api", config.branch),
        source_dir: "/apps/web",
        environment_slug: "node-js",
        build_command: "npm ci && npm run build",
        output_dir: "dist",
        catchall_document: "index.html",
        envs: [
          env("VITE_API_HOST", `https://${config.apiDomain}`, { scope: "BUILD_TIME" }),
          env("VITE_CLERK_PUBLISHABLE_KEY", values.CLERK_PUBLISHABLE_KEY, {
            scope: "BUILD_TIME",
          }),
          env(
            "VITE_HELP_SCOUT_BEACON_ID",
            requireValue(values, "VITE_HELP_SCOUT_BEACON_ID"),
            { scope: "BUILD_TIME" },
          ),
        ],
      },
    ],
    databases,
    domains: [
      domain(config.marketingDomain, "PRIMARY"),
      domain(config.appDomain, "ALIAS"),
      domain(config.apiDomain, "ALIAS"),
      domain(config.webhookDomain, "ALIAS"),
    ],
    ingress: {
      rules: [
        route(config.marketingDomain, "marketing"),
        route(config.appDomain, "web"),
        route(config.apiDomain, "api"),
        route(config.webhookDomain, "webhooks"),
        { match: { path: { prefix: "/" } }, component: { name: "marketing" } },
      ],
    },
    alerts: [{ rule: "DEPLOYMENT_FAILED" }, { rule: "DOMAIN_FAILED" }],
    features: ["buildpack-stack=ubuntu-22"],
  };
}

export { COMPONENT_SIZE, PROJECT_ID };
