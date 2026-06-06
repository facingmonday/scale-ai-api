import{_ as a,o as i,c as e,a0 as n}from"./chunks/framework.Dx25mwie.js";const E=JSON.parse('{"title":"SCALE LXP Application Architecture","description":"","frontmatter":{},"headers":[],"relativePath":"guides/application-architecture.md","filePath":"guides/application-architecture.md"}'),t={name:"guides/application-architecture.md"};function l(r,s,o,p,d,h){return i(),e("div",null,[...s[0]||(s[0]=[n(`<h1 id="scale-lxp-application-architecture" tabindex="-1">SCALE LXP Application Architecture <a class="header-anchor" href="#scale-lxp-application-architecture" aria-label="Permalink to &quot;SCALE LXP Application Architecture&quot;">​</a></h1><p>This document describes the SCALE LXP API architecture, runtime components, external dependencies, data stores, queues, and primary data flows. It is intended for engineering onboarding, security reviews, vendor assessments, and HECVAT-style architecture documentation.</p><h2 id="system-overview" tabindex="-1">System Overview <a class="header-anchor" href="#system-overview" aria-label="Permalink to &quot;System Overview&quot;">​</a></h2><p>SCALE LXP is a classroom-based supply chain simulation platform. Instructors create classes, define store and scenario variables, publish weekly scenarios, enter global outcomes, and review student results. Students create stores, submit weekly decisions, and view simulation results. Background workers use queue-based processing and OpenAI to calculate individualized ledger entries.</p><p>The platform includes a React frontend and three deployable Express applications that share service, model, middleware, queue, email, and OpenAI libraries:</p><ul><li><strong>Web app:</strong> Student/instructor UI under <code>apps/web/</code> (Vite SPA, separate <code>package.json</code>, deployed as a DigitalOcean static site).</li><li><strong>API service:</strong> Main REST API under <code>apps/api/</code>.</li><li><strong>Webhooks service:</strong> External webhook receiver under <code>apps/webhooks/</code>.</li><li><strong>Workers service:</strong> Background queue and scheduled job processor under <code>apps/workers/</code>.</li></ul><p>The web app is not part of the shared Express codebase; it calls the API over HTTPS with Clerk-authenticated requests.</p><p>Supporting tools include a simulation CLI and an email preview app, but they are not part of the primary production request path.</p><h2 id="high-level-container-diagram" tabindex="-1">High-Level Container Diagram <a class="header-anchor" href="#high-level-container-diagram" aria-label="Permalink to &quot;High-Level Container Diagram&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart LR</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Student[Student Browser]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Instructor[Instructor Browser]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  ClerkUI[Clerk Hosted/Auth UI]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Web[Web App\\napps/web\\nReact SPA Static Site]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  StaticHosting[DigitalOcean App Platform\\nStatic Site]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph SCALE[SCALE LXP Backend]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    API[API Service\\napps/api\\nExpress REST API]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Webhooks[Webhooks Service\\napps/webhooks\\nExternal Events]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Workers[Workers Service\\napps/workers\\nBull Processors + Cron]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Services[Domain Services\\nservices/*]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Models[Mongoose Models\\nservices/**/*.model.js]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Queues[Bull Queues\\nlib/queues]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Mongo[(MongoDB)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Redis[(Redis\\nBull Queue Store)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk[Clerk\\nAuth + Orgs]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  OpenAI[OpenAI\\nSimulation + AI APIs]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SendGrid[SendGrid\\nTransactional Email]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Spaces[DigitalOcean Spaces\\nObject Storage]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Hosting[DigitalOcean App Platform\\nDocker Runtime]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Student --&gt;|HTTPS| Web</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Instructor --&gt;|HTTPS| Web</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Web --&gt;|HTTPS API requests| API</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Web -. deployed on .-&gt; StaticHosting</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Student --&gt;|sign in/session| ClerkUI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Instructor --&gt;|sign in/session| ClerkUI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  ClerkUI --&gt; Clerk</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Models</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Models --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Queues</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Queues --&gt; Redis</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Models</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk --&gt;|Svix webhooks| Webhooks</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Queues</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Models</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; SendGrid</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; SendGrid</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Spaces</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API -. deployed on .-&gt; Hosting</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks -. deployed on .-&gt; Hosting</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers -. deployed on .-&gt; Hosting</span></span></code></pre></div><h2 id="runtime-component-diagram" tabindex="-1">Runtime Component Diagram <a class="header-anchor" href="#runtime-component-diagram" aria-label="Permalink to &quot;Runtime Component Diagram&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart TB</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph Apps[Deployable Apps]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    WebApp[apps/web\\nVite React SPA]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    API[apps/api/index.js\\nMain Express API]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Webhooks[apps/webhooks/index.js\\nWebhook Express API]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Workers[apps/workers/index.js\\nWorker Express App + Bull Board]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    SimCLI[apps/sim-cli\\nSimulation CLI]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    EmailPreview[apps/email-preview\\nEmail Template Preview]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph Shared[Shared Backend Code]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Router[services/index.js\\n/v1 Router]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Middleware[middleware/auth.js\\nClerk Auth + RBAC]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Domain[Domain Controllers + Services\\nservices/*]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    ModelLoader[models/index.js\\nAuto-load Mongoose Models]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    QueueLib[lib/queues\\nQueue Definitions + Workers]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    EmailLib[lib/sendGrid + lib/emails\\nEmail Rendering + Sending]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    OpenAILib[lib/openai + services/openai\\nOpenAI Client + AI Routes]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    StorageLib[lib/spaces.js + lib/s3.js\\nS3-Compatible Uploads]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph Persistence[Persistence + Infrastructure]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Mongo[(MongoDB)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Redis[(Redis)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Router</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Middleware</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; ModelLoader</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Router --&gt; Domain</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; QueueLib</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; EmailLib</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; OpenAILib</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; StorageLib</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Domain</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; ModelLoader</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Mongo</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; QueueLib</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; ModelLoader</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Domain</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  QueueLib --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  QueueLib --&gt; Mongo</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SimCLI --&gt; Domain</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  EmailPreview --&gt; EmailLib</span></span></code></pre></div><h2 id="primary-components" tabindex="-1">Primary Components <a class="header-anchor" href="#primary-components" aria-label="Permalink to &quot;Primary Components&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Component</th><th>Location</th><th>Responsibility</th><th>Primary Data In</th><th>Primary Data Out</th></tr></thead><tbody><tr><td>API service</td><td><code>apps/api/</code></td><td>Serves the <code>/v1</code> REST API, applies Clerk middleware, connects to MongoDB, and mounts domain routes.</td><td>Browser requests, Clerk session claims, JSON payloads</td><td>JSON responses, MongoDB writes, queue jobs</td></tr><tr><td>Webhooks service</td><td><code>apps/webhooks/</code></td><td>Receives external provider events, currently Clerk webhooks.</td><td>Signed provider webhooks</td><td>Member, organization, and membership synchronization records</td></tr><tr><td>Workers service</td><td><code>apps/workers/</code></td><td>Runs Bull processors, scheduled jobs, and Bull Board queue UI.</td><td>Redis queue jobs, cron definitions, MongoDB records</td><td>Ledger entries, job status updates, email sends, OpenAI batch updates</td></tr><tr><td>Domain services</td><td><code>services/*</code></td><td>Implements application business logic by domain.</td><td>Authenticated requests, worker jobs, webhook events</td><td>Domain model reads/writes, queued work, external API calls</td></tr><tr><td>Mongoose model loader</td><td><code>models/index.js</code></td><td>Registers every <code>*.model.js</code> file under <code>services/</code>.</td><td>Service model definitions</td><td>Registered MongoDB models</td></tr><tr><td>Auth middleware</td><td><code>middleware/auth.js</code></td><td>Enforces authentication, organization context, role checks, and member/org hydration.</td><td>Clerk identity and request context</td><td>Authorized request context or rejected request</td></tr><tr><td>Queue library</td><td><code>lib/queues/</code></td><td>Defines Bull queues and worker processors.</td><td>Enqueued jobs, Redis configuration</td><td>Worker execution, job lifecycle updates</td></tr><tr><td>OpenAI integration</td><td><code>lib/openai/</code>, <code>services/openai/</code>, <code>services/ledger/</code></td><td>Provides general AI endpoints and simulation outcome generation.</td><td>Prompts, simulation context, ledger history, images/audio where applicable</td><td>Structured AI responses, ledger values, auxiliary AI outputs</td></tr><tr><td>Email integration</td><td><code>lib/sendGrid/</code>, <code>lib/emails/</code></td><td>Renders email templates and sends transactional email through SendGrid.</td><td>Notification records, template props</td><td>Email delivery requests and delivery status</td></tr><tr><td>Object storage</td><td><code>lib/spaces.js</code>, <code>lib/s3.js</code></td><td>Uploads files to DigitalOcean Spaces or S3-compatible storage.</td><td>Uploaded files or image buffers</td><td>Public or stored object URLs</td></tr><tr><td>MongoDB</td><td>External</td><td>Primary system of record for users, organizations, classrooms, scenarios, submissions, jobs, ledgers, notifications, cron jobs, and variables.</td><td>Mongoose reads/writes</td><td>Persisted application state</td></tr><tr><td>Redis</td><td>External</td><td>Queue backing store for Bull.</td><td>Queue job payloads and metadata</td><td>Worker-readable jobs and queue state</td></tr><tr><td>Clerk</td><td>External</td><td>User authentication, organizations, memberships, and webhook events.</td><td>User sessions, org changes, membership events</td><td>Auth claims, webhook events</td></tr><tr><td>SendGrid</td><td>External</td><td>Transactional email provider.</td><td>Rendered email content and recipients</td><td>Delivered email or provider error</td></tr><tr><td>OpenAI</td><td>External</td><td>AI simulation and auxiliary AI capabilities.</td><td>Structured prompts and request payloads</td><td>JSON simulation results or AI-generated outputs</td></tr></tbody></table><h2 id="domain-model-map" tabindex="-1">Domain Model Map <a class="header-anchor" href="#domain-model-map" aria-label="Permalink to &quot;Domain Model Map&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">erDiagram</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Organization ||--o{ Member : contains</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Organization ||--o{ Classroom : owns</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Organization ||--o{ StoreType : defines</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Organization ||--o{ ClassroomTemplate : defines</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Organization ||--o{ VariableDefinition : defines</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Classroom ||--o{ Enrollment : has</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Classroom ||--o{ Store : contains</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Classroom ||--o{ Scenario : contains</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Classroom ||--o{ ScenarioOutcome : has</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Member ||--o{ Enrollment : joins</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Member ||--o{ Store : owns</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Member ||--o{ Submission : submits</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  StoreType ||--o{ Store : templates</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Store ||--o{ VariableValue : has</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  VariableDefinition ||--o{ VariableValue : describes</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario ||--o{ Submission : receives</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario ||--o{ ScenarioOutcome : resolves</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario ||--o{ SimulationJob : creates</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario ||--o{ SimulationBatch : groups</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Submission ||--o{ VariableValue : has</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  ScenarioOutcome ||--o{ VariableValue : has</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SimulationJob ||--o{ LedgerEntry : produces</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SimulationBatch ||--o{ SimulationJob : contains</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Store ||--o{ LedgerEntry : records</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Member ||--o{ Notification : receives</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  CronJob ||--o{ WorkerExecution : schedules</span></span></code></pre></div><blockquote><p>Note: The diagram expresses logical relationships used by the application. Exact schema fields and cardinality are defined in the Mongoose models under <code>services/**/*.model.js</code>.</p></blockquote><h2 id="api-request-data-flow" tabindex="-1">API Request Data Flow <a class="header-anchor" href="#api-request-data-flow" aria-label="Permalink to &quot;API Request Data Flow&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sequenceDiagram</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  autonumber</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Browser as Student/Instructor Browser</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Clerk as Clerk</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant API as API Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Auth as Auth Middleware</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Service as Domain Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Mongo as MongoDB</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Redis as Redis/Bull</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant External as External Provider</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Browser-&gt;&gt;Clerk: Authenticate user and select organization</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk--&gt;&gt;Browser: Session token and org context</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Browser-&gt;&gt;API: HTTPS request to /v1/* with session</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Auth: Validate request context</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Auth-&gt;&gt;Clerk: Resolve user when needed</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Auth-&gt;&gt;Mongo: Hydrate or create Member/Organization records</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Auth--&gt;&gt;API: Authorized request context</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Service: Route to controller/service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Service-&gt;&gt;Mongo: Read or write domain records</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  opt Async work required</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Service-&gt;&gt;Redis: Enqueue Bull job</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  opt External operation required</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Service-&gt;&gt;External: Call OpenAI, SendGrid, Clerk, or storage</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Service--&gt;&gt;API: Domain result</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API--&gt;&gt;Browser: JSON response</span></span></code></pre></div><h3 id="api-flow-description" tabindex="-1">API Flow Description <a class="header-anchor" href="#api-flow-description" aria-label="Permalink to &quot;API Flow Description&quot;">​</a></h3><ol><li>A student or instructor authenticates through Clerk and receives a session token and organization context.</li><li>The browser sends an HTTPS request to the API service under <code>/v1</code>.</li><li>The API service runs Clerk middleware and route-specific authorization checks.</li><li><code>middleware/auth.js</code> validates the identity, resolves organization context, checks roles, and ensures local <code>Member</code> and <code>Organization</code> records exist when required.</li><li>The request is routed through <code>services/index.js</code> into the appropriate domain controller.</li><li>Domain services read from and write to MongoDB through Mongoose models.</li><li>If the request requires asynchronous processing, the service enqueues a Bull job in Redis.</li><li>If the request requires an external provider, the service calls the relevant integration, such as OpenAI, SendGrid, Clerk, or object storage.</li><li>The API service returns the domain result as JSON.</li></ol><h2 id="core-simulation-data-flow" tabindex="-1">Core Simulation Data Flow <a class="header-anchor" href="#core-simulation-data-flow" aria-label="Permalink to &quot;Core Simulation Data Flow&quot;">​</a></h2><p>The simulation flow is the most important cross-component workflow. It begins with instructor scenario management and ends with student-visible ledger entries.</p><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sequenceDiagram</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  autonumber</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Instructor as Instructor</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant API as API Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Scenario as Scenario Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Mongo as MongoDB</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant OutcomeQ as scenario-outcome-processing Queue</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Worker as Workers Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant JobService as Job Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant SimQ as simulation or simulation-batch Queue</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant OpenAI as OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Ledger as Ledger Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Student as Student</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Instructor-&gt;&gt;API: Create classroom, variables, store types, and scenario</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Scenario: Persist classroom/scenario configuration</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario-&gt;&gt;Mongo: Save Classroom, VariableDefinition, StoreType, Scenario</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Student-&gt;&gt;API: Create store and submit decisions</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Scenario: Validate membership, scenario, and submission payload</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario-&gt;&gt;Mongo: Save Store, VariableValue, Submission</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Instructor-&gt;&gt;API: Enter or publish scenario outcome</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Scenario: Save global outcome</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario-&gt;&gt;Mongo: Save ScenarioOutcome and outcome variables</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Scenario-&gt;&gt;OutcomeQ: Enqueue outcome processing job</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  OutcomeQ-&gt;&gt;Worker: Process outcome job</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Worker-&gt;&gt;Mongo: Load scenario, classroom, stores, submissions, policy, history</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Worker-&gt;&gt;JobService: Create simulation jobs</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  JobService-&gt;&gt;Mongo: Save SimulationJob records</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  alt Direct simulation mode</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    JobService-&gt;&gt;SimQ: Enqueue one job per student/store</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    SimQ-&gt;&gt;Worker: Process simulation job</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;OpenAI: Send simulation context and schema</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    OpenAI--&gt;&gt;Worker: Structured simulation result</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;Ledger: Create ledger entry</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Ledger-&gt;&gt;Mongo: Save LedgerEntry and job status</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  else Batch simulation mode</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    JobService-&gt;&gt;SimQ: Enqueue simulation batch</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;OpenAI: Submit OpenAI Batch request</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;Mongo: Save SimulationBatch status</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;OpenAI: Poll or retrieve batch results</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    OpenAI--&gt;&gt;Worker: Batch output records</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Worker-&gt;&gt;Ledger: Create ledger entries from batch output</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Ledger-&gt;&gt;Mongo: Save LedgerEntry records and job statuses</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Student-&gt;&gt;API: View results and leaderboard</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API-&gt;&gt;Mongo: Read LedgerEntry and class summary data</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API--&gt;&gt;Student: Simulation results, narrative, rankings, and history</span></span></code></pre></div><h3 id="simulation-flow-description" tabindex="-1">Simulation Flow Description <a class="header-anchor" href="#simulation-flow-description" aria-label="Permalink to &quot;Simulation Flow Description&quot;">​</a></h3><ol><li>The instructor creates or configures classroom data, including store types, variable definitions, and scenarios.</li><li>Students enroll in the classroom, create stores, and submit weekly scenario decisions.</li><li>The instructor enters the scenario outcome. This outcome applies globally, while each student impact depends on store setup, submission choices, and ledger history.</li><li>The scenario outcome controller persists the outcome and enqueues a <code>scenario-outcome-processing</code> job.</li><li>The workers service loads the scenario, classroom, enrolled stores, submissions, missing-submission policy, and relevant history.</li><li>Missing submissions are handled according to classroom policy. The worker can create default submissions, forward previous decisions, use AI-generated defaults, skip entries, or require instructor review depending on configured behavior.</li><li><code>JobService</code> creates <code>SimulationJob</code> records for each student/store that should receive a result.</li><li>In direct mode, jobs are processed through the <code>simulation</code> queue. Each job sends a structured prompt to OpenAI and writes one <code>LedgerEntry</code>.</li><li>In batch mode, the system creates a <code>SimulationBatch</code>, submits work to the OpenAI Batch API, tracks provider status, ingests output, and writes ledger entries.</li><li>Students and instructors retrieve ledger entries, summaries, history, and leaderboard data through the API.</li></ol><h2 id="webhook-data-flow" tabindex="-1">Webhook Data Flow <a class="header-anchor" href="#webhook-data-flow" aria-label="Permalink to &quot;Webhook Data Flow&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sequenceDiagram</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  autonumber</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Clerk as Clerk</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Webhooks as Webhooks Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Verify as Svix Verification</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Controller as Clerk Webhook Controller</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Mongo as MongoDB</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk-&gt;&gt;Webhooks: Send signed user/org/membership event</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks-&gt;&gt;Verify: Verify Svix headers and payload</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Verify--&gt;&gt;Webhooks: Trusted event or reject</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks-&gt;&gt;Controller: Dispatch event by type</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Controller-&gt;&gt;Mongo: Create, update, or deactivate Member/Organization records</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Controller--&gt;&gt;Webhooks: Processing result</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks--&gt;&gt;Clerk: 2xx response</span></span></code></pre></div><h3 id="webhook-flow-description" tabindex="-1">Webhook Flow Description <a class="header-anchor" href="#webhook-flow-description" aria-label="Permalink to &quot;Webhook Flow Description&quot;">​</a></h3><ol><li>Clerk sends signed webhook events to the webhooks service under <code>/v1/webhooks/clerk</code>.</li><li>The webhook middleware verifies the event signature using Svix.</li><li>Trusted events are routed to the Clerk webhook controller.</li><li>User, organization, and membership events synchronize local <code>Member</code> and <code>Organization</code> records in MongoDB.</li><li>The webhooks service returns a success response to Clerk after processing.</li></ol><h2 id="queue-and-worker-data-flow" tabindex="-1">Queue and Worker Data Flow <a class="header-anchor" href="#queue-and-worker-data-flow" aria-label="Permalink to &quot;Queue and Worker Data Flow&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart LR</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API[API Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain[Domain Services]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Redis[(Redis)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers[Workers Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Mongo[(MongoDB)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  OpenAI[OpenAI]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SendGrid[SendGrid]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph Queues[Bull Queues]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    EmailQ[email-sending]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    SimulationQ[simulation]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    BatchQ[simulation-batch]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    OutcomeQ[scenario-outcome-processing]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    PdfQ[pdf-generation\\ncurrently disabled]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    SmsQ[sms\\ncurrently disabled]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    PushQ[push\\ncurrently disabled]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Domain</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; EmailQ</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; OutcomeQ</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; SimulationQ</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Domain --&gt; BatchQ</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  EmailQ --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  OutcomeQ --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SimulationQ --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  BatchQ --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  PdfQ -. optional .-&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SmsQ -. optional .-&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  PushQ -. optional .-&gt; Redis</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Redis --&gt; Workers</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; SendGrid</span></span></code></pre></div><h3 id="queue-flow-description" tabindex="-1">Queue Flow Description <a class="header-anchor" href="#queue-flow-description" aria-label="Permalink to &quot;Queue Flow Description&quot;">​</a></h3><ul><li><code>email-sending</code> processes notification email delivery through SendGrid.</li><li><code>scenario-outcome-processing</code> starts scenario closeout work after an instructor saves an outcome.</li><li><code>simulation</code> processes individual simulation jobs in direct mode.</li><li><code>simulation-batch</code> submits, tracks, and ingests OpenAI Batch API work in batch mode.</li><li><code>pdf-generation</code>, <code>sms</code>, and <code>push</code> workers exist in the codebase but are currently disabled or not part of the active production flow based on worker registration.</li></ul><p>The workers service also supports scheduled jobs through Mongo-backed cron definitions and worker registry helpers.</p><h2 id="notification-and-email-data-flow" tabindex="-1">Notification and Email Data Flow <a class="header-anchor" href="#notification-and-email-data-flow" aria-label="Permalink to &quot;Notification and Email Data Flow&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sequenceDiagram</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  autonumber</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Service as Domain Service</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Mongo as MongoDB</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Redis as email-sending Queue</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Worker as Email Worker</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant Renderer as React Email Renderer</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant SendGrid as SendGrid</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  participant User as Recipient</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Service-&gt;&gt;Mongo: Create Notification record</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Service-&gt;&gt;Redis: Enqueue email job</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Redis-&gt;&gt;Worker: Deliver queued email job</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Worker-&gt;&gt;Renderer: Render template with props</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Renderer--&gt;&gt;Worker: HTML/text email</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Worker-&gt;&gt;SendGrid: Send email request</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SendGrid--&gt;&gt;User: Deliver email</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SendGrid--&gt;&gt;Worker: Provider response</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Worker-&gt;&gt;Mongo: Update notification or job status when applicable</span></span></code></pre></div><h2 id="object-storage-data-flow" tabindex="-1">Object Storage Data Flow <a class="header-anchor" href="#object-storage-data-flow" aria-label="Permalink to &quot;Object Storage Data Flow&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart LR</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Browser[Browser or API Client]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API[API Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Multer[Multer / Upload Handler]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Sharp[Sharp Image Processing\\nwhen used]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Spaces[DigitalOcean Spaces\\nS3-Compatible Storage]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Mongo[(MongoDB)]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Browser --&gt;|multipart upload or file payload| API</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Multer</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Sharp</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Multer --&gt; Spaces</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Sharp --&gt; Spaces</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Spaces --&gt;|object URL/key| API</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt;|resource metadata| Browser</span></span></code></pre></div><h2 id="data-stores-and-persistence" tabindex="-1">Data Stores and Persistence <a class="header-anchor" href="#data-stores-and-persistence" aria-label="Permalink to &quot;Data Stores and Persistence&quot;">​</a></h2><h3 id="mongodb" tabindex="-1">MongoDB <a class="header-anchor" href="#mongodb" aria-label="Permalink to &quot;MongoDB&quot;">​</a></h3><p>MongoDB is the primary system of record. Mongoose models are registered through <code>models/index.js</code>, which loads model files from <code>services/**/*.model.js</code>.</p><p>Core persisted entities include:</p><ul><li>Organizations and members.</li><li>Classrooms and enrollments.</li><li>Store types, stores, variable definitions, and variable values.</li><li>Scenarios, scenario outcomes, and submissions.</li><li>Simulation jobs, simulation batches, and ledger entries.</li><li>Notifications.</li><li>Cron job definitions.</li></ul><h3 id="redis" tabindex="-1">Redis <a class="header-anchor" href="#redis" aria-label="Permalink to &quot;Redis&quot;">​</a></h3><p>Redis is used as the Bull queue backing store. It stores queue jobs, processing state, retries, delays, and job metadata for asynchronous workloads.</p><h3 id="object-storage" tabindex="-1">Object Storage <a class="header-anchor" href="#object-storage" aria-label="Permalink to &quot;Object Storage&quot;">​</a></h3><p>DigitalOcean Spaces or another S3-compatible service stores uploaded files and generated or processed objects when those features are used.</p><h2 id="external-dependencies" tabindex="-1">External Dependencies <a class="header-anchor" href="#external-dependencies" aria-label="Permalink to &quot;External Dependencies&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Provider</th><th>Purpose</th><th>Data Exchanged</th></tr></thead><tbody><tr><td>Clerk</td><td>Authentication, organizations, membership state, webhooks</td><td>User identity, organization IDs, roles, membership events</td></tr><tr><td>OpenAI</td><td>Simulation processing and auxiliary AI endpoints</td><td>Simulation context, prompts, structured output requests, AI responses</td></tr><tr><td>SendGrid</td><td>Transactional email</td><td>Recipient address, rendered template content, delivery metadata</td></tr><tr><td>DigitalOcean App Platform</td><td>Docker hosting for API, webhooks, and workers</td><td>Runtime configuration, application traffic, logs</td></tr><tr><td>DigitalOcean Spaces or S3-compatible storage</td><td>File and object storage</td><td>Uploaded files, generated objects, object keys/URLs</td></tr><tr><td>MongoDB provider</td><td>Primary database</td><td>Application records and operational state</td></tr><tr><td>Redis provider</td><td>Queue storage</td><td>Bull job payloads and processing metadata</td></tr></tbody></table><h2 id="security-and-control-boundaries" tabindex="-1">Security and Control Boundaries <a class="header-anchor" href="#security-and-control-boundaries" aria-label="Permalink to &quot;Security and Control Boundaries&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart TB</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph ClientBoundary[Client Boundary]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Browser[Student/Instructor Browser]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph IdentityBoundary[Identity Provider Boundary]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Clerk[Clerk]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph AppBoundary[SCALE LXP Application Boundary]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    API[API Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Webhooks[Webhooks Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Workers[Workers Service]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Services[Domain Services]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph DataBoundary[Data Persistence Boundary]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Mongo[(MongoDB)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Redis[(Redis)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    Storage[(Object Storage)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph VendorBoundary[External Processing Boundary]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    OpenAI[OpenAI]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    SendGrid[SendGrid]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Browser --&gt;|HTTPS + Clerk session| API</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt;|auth/session validation| Clerk</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk --&gt;|signed webhook| Webhooks</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  API --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Webhooks --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Workers --&gt; Services</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; Storage</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Services --&gt; SendGrid</span></span></code></pre></div><p>Important control points:</p><ul><li>Browser traffic should use HTTPS.</li><li>Clerk provides authentication and organization context.</li><li>Application middleware enforces role and organization authorization.</li><li>MongoDB stores application data and should be protected with provider encryption, network restrictions, and least-privilege credentials.</li><li>Redis stores queue payloads and should be treated as sensitive because jobs may contain identifiers or processing context.</li><li>OpenAI receives simulation context required to produce ledger outputs.</li><li>SendGrid receives recipient and message data required for transactional email.</li><li>Object storage may contain uploaded or generated files and should use restricted credentials and appropriate bucket permissions.</li></ul><h2 id="end-to-end-data-flow-summary" tabindex="-1">End-to-End Data Flow Summary <a class="header-anchor" href="#end-to-end-data-flow-summary" aria-label="Permalink to &quot;End-to-End Data Flow Summary&quot;">​</a></h2><ol><li><strong>Identity creation and synchronization:</strong> Users authenticate through Clerk. Clerk webhooks synchronize user, organization, and membership changes into MongoDB through the webhooks service.</li><li><strong>Classroom setup:</strong> Instructors use the API to create organizations, classrooms, enrollments, store types, variable definitions, and scenarios. These records are stored in MongoDB.</li><li><strong>Student setup:</strong> Students join classes, create stores, and save variable values. Store and enrollment data is persisted in MongoDB and scoped to the classroom and organization.</li><li><strong>Weekly submissions:</strong> Students submit scenario decisions through the API. Submissions and their variable values are stored in MongoDB.</li><li><strong>Outcome entry:</strong> Instructors enter global scenario outcomes. The API stores the outcome and enqueues outcome processing in Redis.</li><li><strong>Job creation:</strong> Workers load the scenario, outcome, submissions, stores, class policy, and ledger history, then create simulation jobs or batches in MongoDB and Redis.</li><li><strong>AI processing:</strong> Workers send required simulation context to OpenAI. Results return as structured data and are validated or converted into ledger entries.</li><li><strong>Ledger publication:</strong> Ledger entries are stored in MongoDB and become available to students and instructors through the API.</li><li><strong>Notifications:</strong> Domain services create notifications and enqueue email jobs. Workers render templates and send messages through SendGrid.</li><li><strong>Ongoing operations:</strong> Workers process scheduled jobs, retries, queue monitoring, and background maintenance. Administrators can inspect worker state through Bull Board when enabled.</li></ol><h2 id="deployment-view" tabindex="-1">Deployment View <a class="header-anchor" href="#deployment-view" aria-label="Permalink to &quot;Deployment View&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart LR</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  subgraph DigitalOcean[DigitalOcean App Platform]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    APIContainer[API Container\\nstart:api]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    WebhookContainer[Webhooks Container\\nstart:webhooks]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    WorkerContainer[Workers Container\\nstart:workers]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Mongo[(MongoDB)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Redis[(Redis)]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Clerk[Clerk]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  OpenAI[OpenAI]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  SendGrid[SendGrid]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  Spaces[DigitalOcean Spaces]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; Clerk</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; SendGrid</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  APIContainer --&gt; Spaces</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WebhookContainer --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WebhookContainer --&gt; Clerk</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WorkerContainer --&gt; Mongo</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WorkerContainer --&gt; Redis</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WorkerContainer --&gt; OpenAI</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  WorkerContainer --&gt; SendGrid</span></span></code></pre></div><h2 id="operational-notes" tabindex="-1">Operational Notes <a class="header-anchor" href="#operational-notes" aria-label="Permalink to &quot;Operational Notes&quot;">​</a></h2><ul><li>All three primary apps share the same repository and model definitions.</li><li>The API and workers both connect to MongoDB because worker processors need direct access to simulation, job, and ledger data.</li><li>Queue payloads should remain minimal and should generally reference MongoDB record IDs instead of duplicating large or sensitive records.</li><li>Direct simulation mode processes one job per student/store. Batch mode groups work through OpenAI Batch API and tracks the batch lifecycle in MongoDB.</li><li>The webhooks app is intentionally separated from the API app so provider events can be scaled, secured, and monitored independently.</li><li>Email rendering is separated from email sending so templates can be previewed and tested independently.</li><li>Disabled workers and unused integrations should not be represented as active production dependencies unless enabled in deployment and worker registration.</li></ul><h2 id="source-reference-map" tabindex="-1">Source Reference Map <a class="header-anchor" href="#source-reference-map" aria-label="Permalink to &quot;Source Reference Map&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Area</th><th>Key Paths</th></tr></thead><tbody><tr><td>API app</td><td><code>apps/api/index.js</code></td></tr><tr><td>Webhooks app</td><td><code>apps/webhooks/index.js</code>, <code>services/webhooks/</code></td></tr><tr><td>Workers app</td><td><code>apps/workers/index.js</code>, <code>services/workers/</code></td></tr><tr><td>Main service router</td><td><code>services/index.js</code></td></tr><tr><td>Auth middleware</td><td><code>middleware/auth.js</code></td></tr><tr><td>Queue definitions and workers</td><td><code>lib/queues/</code></td></tr><tr><td>Simulation jobs</td><td><code>services/job/</code>, <code>lib/queues/simulation-worker.js</code>, <code>lib/queues/simulation-batch-worker.js</code>, <code>lib/queues/outcome-processing-worker.js</code></td></tr><tr><td>Ledger generation</td><td><code>services/ledger/</code></td></tr><tr><td>OpenAI integration</td><td><code>lib/openai/</code>, <code>services/openai/</code></td></tr><tr><td>Email integration</td><td><code>lib/sendGrid/</code>, <code>lib/emails/</code>, <code>services/notifications/</code></td></tr><tr><td>Object storage</td><td><code>lib/spaces.js</code>, <code>lib/s3.js</code></td></tr><tr><td>Model registration</td><td><code>models/index.js</code></td></tr><tr><td>Domain models</td><td><code>services/**/*.model.js</code></td></tr></tbody></table>`,62)])])}const k=a(t,[["render",l]]);export{E as __pageData,k as default};
