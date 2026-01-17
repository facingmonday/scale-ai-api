To draft a SOC 2 readiness checklist that’s actually useful for SCALE (and not a generic blob), I need to pin down scope and audit target. I’ll ask two quick scoping questions, then I’ll generate a checklist organized by Trust Services Criteria, with concrete evidence examples and an execution timeline.

[1 tool called]

### SOC 2 Readiness Checklist (SCALE) — Type I, all TSC in scope

#### 1) Define scope (system description + boundaries)

- **System inventory**: products/services in scope, environments (prod/stage/dev), data stores, major integrations, subprocessors.
- **Data inventory**: data types (PII/PHI/PCI/etc.), sources, where it’s stored/processed, retention, deletion, transfer regions.
- **Architecture**: network diagram, data flow diagrams, trust boundaries, admin paths, third parties.
- **Roles**: control owners, backup owners, escalation paths.
- **SOC 2 narrative**: draft system description (services, infrastructure, software, people, procedures, data).

#### 2) Governance & risk management (common criteria)

- **Security org**: named security leader, defined responsibilities, steering cadence.
- **Policies approved**: information security, acceptable use, access control, encryption, SDLC, vendor risk, incident response, DR/BCP, privacy.
- **Risk assessment**: documented risk register, annual review, treatment plans, residual risk sign-off.
- **Training**: onboarding + annual security training; role-based training (eng, support, HR).
- **Internal audit readiness**: control matrix, evidence list, walkthroughs, gap log.

#### 3) People controls (HR + access lifecycle)

- **Background checks** (as applicable) and documented hiring standards.
- **Onboarding/offboarding**: standardized access provisioning, approvals, least privilege; removal within defined SLA.
- **Access reviews**: periodic reviews for privileged roles and sensitive systems; documented remediation.
- **Separation of duties**: production access restrictions; break-glass process with logging.

#### 4) Identity, authentication, and authorization

- **SSO/MFA**: enforced for workforce and admin access; strong password and session policies.
- **Privileged access**: separate admin accounts; just-in-time where possible; no shared accounts.
- **Service accounts/keys**: inventory, rotation, scoped permissions, secrets stored in a vault.
- **Logging**: authentication/authorization events captured and retained.

#### 5) Asset management, endpoint, and configuration

- **Asset inventory**: endpoints, servers, SaaS apps; ownership and criticality.
- **Device security**: MDM, disk encryption, screen lock, patching, malware protection, secure baseline.
- **Secure configuration**: hardened images, CIS-aligned baselines where feasible, IaC and drift detection.

#### 6) SDLC & change management (Processing Integrity-heavy)

- **Documented SDLC**: requirements, design review, threat modeling (for high-risk changes), coding standards.
- **Code review**: required PR reviews; branch protection; segregation of dev/prod changes.
- **CI/CD**: build integrity, signed artifacts where feasible, protected secrets, least-privilege runners.
- **Testing**: unit/integration tests; release gates; rollback procedures.
- **Change approvals**: normal vs emergency change process; evidence of approvals.

#### 7) Vulnerability management

- **Scanning**: SAST/DAST/dependency scanning; container/image scanning if applicable.
- **Pen test**: annual (or risk-based) external pen test; remediation tracking.
- **Patch management**: defined SLAs by severity; exception process.
- **Bug bounty / intake**: vuln reporting channel; triage and disclosure policy.

#### 8) Security monitoring, logging, and incident response

- **Centralized logs**: app, infra, auth, admin actions; time sync; retention policy.
- **Alerting**: detection rules for high-risk events (privilege changes, anomalous logins, data exfil signals).
- **Incident response plan**: severity levels, roles, comms templates, legal/privacy triggers, tabletop exercises.
- **Post-incident**: RCA format, corrective actions tracked to closure.

#### 9) Data protection & confidentiality controls

- **Encryption**: in transit (TLS) and at rest; key management (KMS/HSM), rotation, access controls.
- **Data classification**: labeled handling rules; restricted data pathways.
- **Secrets management**: no secrets in code; rotation; access auditing.
- **DLP / egress** (as needed): controls for exports, sharing, support tooling, and admin downloads.
- **Customer data segregation**: logical controls; tenant isolation; documented.

#### 10) Privacy program (Privacy criteria)

- **Privacy notice**: accurate disclosures (collection, use, sharing, retention, subprocessors, regions).
- **Lawful basis/consent**: where applicable; cookie consent if relevant.
- **DSAR process**: intake, identity verification, response SLAs, deletion/rectification workflows.
- **Data retention & deletion**: schedules; secure disposal; backups handling.
- **Privacy impact assessments**: for new products/features involving personal data.

#### 11) Availability program (Availability criteria)

- **SLIs/SLOs**: uptime targets, error budgets, monitoring coverage.
- **BCP/DR**: RTO/RPO defined; DR architecture; annual test; documented results.
- **Backups**: frequency, encryption, access controls, restore testing evidence.
- **Capacity management**: load testing, autoscaling policies, incident playbooks.
- **Change-related availability**: maintenance windows, customer comms, status page process.

#### 12) Third-party / vendor risk management

- **Vendor inventory**: all subprocessors and critical vendors; data shared and purpose.
- **Due diligence**: SOC reports, ISO certs, questionnaires; risk rating; remediation follow-up.
- **Contracts**: DPAs, security addendums, breach notification terms, subprocessor terms.
- **Ongoing monitoring**: annual refresh for critical vendors; offboarding process.

#### 13) Physical security (if offices / on-prem exist)

- **Access controls**: badge access, visitor logs, cameras (as applicable).
- **Media handling**: secure disposal; device storage rules.
- **Work-from-home**: policy and expectations.

#### 14) Evidence readiness (Type I focus)

- **Control matrix**: each control mapped to TSC points; owner; frequency; system.
- **Evidence pack**: screenshots/config exports, policy approvals, ticket samples, logs, training records.
- **Walkthrough scripts**: for auditors (how a control works, where evidence lives).
- **Exceptions log**: known gaps, compensating controls, remediation timeline.

#### 15) Final pre-audit steps (2–4 weeks before)

- **Management review**: sign-off on system description, controls, and scope.
- **Dry run**: internal mock audit; close gaps; verify evidence is reproducible.
- **Audit liaison**: single point of contact; evidence request workflow; secure data room.

If you share what SCALE’s primary hosting stack is (AWS/GCP/Azure), identity provider (Okta/Google/Entra), and biggest subprocessors, I can tailor this into a control-by-control matrix with the exact evidence artifacts auditors will ask for.
