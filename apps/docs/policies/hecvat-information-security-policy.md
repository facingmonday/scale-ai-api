# SCALE LXP Information Security Policy

**Document owner:** Security / Engineering Leadership  
**Approved by:** [Insert approver]  
**Effective date:** [Insert date]  
**Review cadence:** At least annually and upon material changes to systems, vendors, risks, or regulatory obligations  
**Applies to:** SCALE LXP personnel, contractors, systems, services, production environments, and third parties with authorized access to SCALE LXP data or systems

## 1. Purpose

This Information Security Policy defines the administrative, technical, and operational safeguards used to protect SCALE LXP systems and data. It is intended to support institutional security reviews, including the Higher Education Community Vendor Assessment Toolkit (HECVAT), by documenting how SCALE LXP governs information security, protects customer data, manages risk, and responds to security events.

SCALE LXP is a classroom-based supply chain simulation platform. The platform supports instructors and students through class management, scenario configuration, student submissions, AI-assisted simulation processing, ledger generation, dashboards, and email notifications.

## 2. Scope

This policy applies to:

- Production, staging, development, and administrative systems that support SCALE LXP.
- Application services, APIs, background workers, queues, databases, authentication integrations, email integrations, and AI integrations.
- Customer data, student data, instructor data, operational data, logs, secrets, configuration, and support data.
- Employees, contractors, service providers, and vendors who access SCALE LXP systems or data.

The current SCALE LXP technical environment includes Node.js, Express, MongoDB, Clerk, SendGrid, OpenAI, Bull/Redis queues, Docker, and DigitalOcean App Platform.

## 3. Security Governance

SCALE LXP maintains an information security program appropriate to the size, maturity, and risk profile of the organization. Security responsibilities are assigned to designated leadership responsible for:

- Approving and maintaining security policies.
- Reviewing security risks and remediation plans.
- Overseeing access control, vulnerability management, incident response, vendor risk, and data protection practices.
- Ensuring personnel understand their security responsibilities.
- Reviewing material security changes before deployment where appropriate.

Security policies and procedures are reviewed at least annually and updated when there are significant changes to the business, technology stack, threat landscape, or applicable legal and contractual obligations.

## 4. Risk Management

SCALE LXP performs risk management activities to identify, evaluate, and address risks to confidentiality, integrity, availability, and privacy. Risk management activities include:

- Maintaining an inventory of material systems, services, data stores, and vendors.
- Reviewing risks associated with application changes, infrastructure changes, new vendors, and new data processing activities.
- Prioritizing remediation based on likelihood, impact, exploitability, and data sensitivity.
- Tracking accepted risks, remediation owners, target dates, and status.
- Reviewing high-risk findings with management.

Risk treatment may include remediation, mitigation, transfer, acceptance, or avoidance. Accepted risks must be documented and approved by appropriate leadership.

## 5. Data Classification and Handling

SCALE LXP classifies data based on sensitivity and business impact. At minimum, SCALE LXP recognizes the following data categories:

- **Public:** Information approved for public release.
- **Internal:** Operational information intended for authorized personnel.
- **Confidential:** Customer, student, instructor, class, organization, business, security, or support data not intended for public disclosure.
- **Restricted:** Secrets, credentials, authentication tokens, encryption keys, highly sensitive security data, and other data requiring strict access controls.

Personnel must handle data according to its classification. Confidential and Restricted data must be accessed only for authorized business purposes, stored in approved systems, transmitted through approved encrypted channels, and shared only with authorized recipients.

## 6. Access Control

Access to SCALE LXP systems and data is granted based on least privilege, role-based need, and authorization by appropriate personnel.

SCALE LXP access control requirements include:

- Unique user accounts for workforce and administrative access.
- Role-based access control for application users.
- Separation between student/member and instructor/admin capabilities.
- No super admin role in the application model unless a future operational requirement is formally approved and documented.
- Multi-factor authentication for administrative and workforce systems where supported.
- Timely removal or disabling of access when personnel leave or no longer require access.
- Periodic review of privileged and sensitive access.
- Prohibition on shared accounts except for approved service accounts with documented ownership and controls.

Production access is limited to authorized personnel with a business need. Administrative actions should be logged where technically feasible.

## 7. Authentication and Authorization

SCALE LXP uses Clerk for user authentication and organization membership management. Application authorization is enforced by backend services and middleware that validate identity, organization scope, class membership, and role permissions before allowing access to protected resources.

Authentication and authorization controls include:

- Authentication required for protected application routes.
- Authorization checks for organization-scoped, classroom-scoped, and role-scoped resources.
- Administrative capabilities restricted to authorized instructor/admin users.
- Student/member users restricted to their own authorized class, store, submission, results, and leaderboard views.
- Webhook verification for trusted external event sources where supported.
- Session and token handling aligned with the authentication provider's security features.

## 8. Passwords, Secrets, and Key Management

Personnel must not store secrets, passwords, API keys, tokens, or private keys in source code, issue trackers, documentation, chat, or other unauthorized locations.

Secrets management requirements include:

- Store secrets only in approved secret management systems, deployment environment variables, or managed platform configuration.
- Scope service credentials to the minimum required permissions.
- Rotate credentials when compromise is suspected, when personnel with access leave, or on a defined risk-based schedule.
- Remove unused credentials promptly.
- Restrict access to production secrets to authorized personnel.
- Review source control history and dependency configuration for accidental secret exposure when risk indicators are identified.

## 9. Encryption

SCALE LXP protects data in transit and at rest using encryption appropriate to the system and data sensitivity.

Encryption requirements include:

- Use TLS for external application traffic and API communications.
- Use encrypted connections for administrative access where supported.
- Use platform or database encryption at rest for production data stores where supported by the hosting and database providers.
- Protect credentials, tokens, and secrets through approved storage mechanisms.
- Avoid transmitting Confidential or Restricted data through unencrypted or unauthorized channels.

Encryption controls are reviewed when hosting, database, or vendor architecture changes.

## 10. Secure Software Development

SCALE LXP follows secure software development practices for application and infrastructure changes. Engineering practices include:

- Source code maintained in version control.
- Peer review for material code changes.
- Branch protection or equivalent review controls where feasible.
- Testing appropriate to the risk of the change.
- Separation of development, staging, and production environments where feasible.
- Secure handling of configuration and environment variables.
- Review of authentication, authorization, input validation, data access, and logging behavior for security-sensitive changes.
- Dependency management and remediation of known vulnerable packages based on severity and exploitability.

Security-sensitive changes, including changes to authentication, authorization, data access, ledger processing, background jobs, or external integrations, should receive additional review.

## 11. Change Management

SCALE LXP manages changes to production systems to reduce the risk of unauthorized, untested, or disruptive modifications.

Change management expectations include:

- Documenting material changes through pull requests, tickets, commits, or release notes.
- Reviewing and approving changes before production deployment.
- Testing changes before release according to risk.
- Maintaining rollback or remediation procedures for failed deployments.
- Documenting emergency changes after implementation, including the reason, approver, impact, and follow-up actions.

## 12. Vulnerability and Patch Management

SCALE LXP identifies and remediates vulnerabilities in application code, dependencies, infrastructure, and third-party services using a risk-based approach.

Vulnerability management activities include:

- Monitoring dependency and platform security advisories.
- Running dependency, static analysis, or other security checks where feasible.
- Prioritizing remediation based on severity, exploitability, exposure, and data sensitivity.
- Applying vendor patches and runtime updates according to risk.
- Tracking remediation actions for high-risk findings.
- Performing security testing or third-party review when warranted by customer, institutional, or product risk.

Target remediation timeframes should be defined by severity. Critical and actively exploited vulnerabilities affecting production systems should be addressed as soon as practicable.

## 13. Logging and Monitoring

SCALE LXP maintains logs to support troubleshooting, security monitoring, auditability, and incident investigation. Logging practices should balance operational needs with data minimization and privacy requirements.

Logging and monitoring controls include:

- Capture application, authentication, authorization, administrative, job processing, and error events where feasible.
- Restrict log access to authorized personnel.
- Avoid logging secrets, credentials, full tokens, or unnecessary sensitive personal data.
- Monitor production health, job failures, queue processing, and application errors.
- Review security-relevant alerts and anomalies based on severity.
- Retain logs according to operational, contractual, legal, and security needs.

## 14. Incident Response

SCALE LXP maintains an incident response process for identifying, triaging, containing, investigating, remediating, and communicating security incidents.

The incident response process includes:

- Designated incident owners and escalation contacts.
- Severity classification based on data sensitivity, scope, customer impact, service impact, and regulatory or contractual obligations.
- Containment steps such as credential rotation, access revocation, disabling affected services, or blocking malicious activity.
- Investigation and evidence preservation appropriate to the incident.
- Customer, institutional, vendor, legal, or regulatory notification when required.
- Post-incident review and corrective action tracking.

Personnel must promptly report suspected security incidents, unauthorized access, data exposure, credential compromise, malware, phishing, or suspicious activity.

## 15. Business Continuity, Disaster Recovery, and Availability

SCALE LXP maintains practices intended to preserve service availability and recover from disruptions affecting critical systems.

Availability and recovery practices include:

- Use of managed hosting and database providers for production infrastructure.
- Monitoring of application availability and background job processing.
- Backup or restoration capabilities for critical production data where supported by the database and hosting architecture.
- Defined recovery expectations for material systems.
- Review of service disruptions and corrective actions.
- Vendor dependency review for critical services such as hosting, authentication, email, database, queueing, and AI processing.

Recovery time objectives (RTOs) and recovery point objectives (RPOs) should be documented and reviewed as institutional or contractual requirements mature.

## 16. Data Retention and Disposal

SCALE LXP retains data only as long as needed for educational, operational, contractual, legal, security, or support purposes.

Retention and disposal requirements include:

- Define retention expectations for customer data, class data, student submissions, ledger entries, logs, backups, and support records.
- Delete or de-identify data when it is no longer required and deletion is contractually, legally, and technically permitted.
- Securely dispose of credentials, tokens, and temporary exports when no longer needed.
- Follow customer or institutional data deletion requests according to contract terms and applicable law.
- Ensure backups age out according to provider capabilities and retention settings.

## 17. Privacy and Student Data Protection

SCALE LXP is designed for educational use and may process student, instructor, class, organization, and simulation data. SCALE LXP protects personal data through access controls, purpose limitation, data minimization, and contractual safeguards.

Privacy requirements include:

- Collect and process data only for authorized educational, operational, support, security, and service improvement purposes.
- Limit student access to their own authorized data and permitted class-level views.
- Limit instructor access to classes and students they are authorized to manage.
- Do not sell student personal information.
- Do not use customer data for unrelated advertising purposes.
- Support institutional requests related to access, correction, deletion, or export where contractually and legally applicable.
- Review new data uses, analytics, AI processing, or vendor integrations for privacy impact.

## 18. Artificial Intelligence and Data Processing

SCALE LXP uses OpenAI to calculate simulation outcomes based on store configuration, scenario data, outcome data, student submissions, and ledger history. AI processing is used to support educational simulation outcomes and narrative feedback.

AI processing requirements include:

- Send only the data reasonably necessary to perform the simulation task.
- Do not include unnecessary secrets, credentials, or unrelated personal data in AI prompts.
- Use structured outputs where feasible to support deterministic processing.
- Review AI-generated outputs through application workflows and instructor controls where appropriate.
- Maintain instructor authority over scenario outcomes and ledger overrides.
- Evaluate material changes to AI providers, models, prompts, or data use for security and privacy impact.

## 19. Vendor and Third-Party Risk Management

SCALE LXP relies on third-party service providers for hosting, authentication, email delivery, database or infrastructure services, AI processing, development tooling, and related business operations.

Vendor risk management expectations include:

- Maintain an inventory of critical vendors and subprocessors.
- Review vendor security, privacy, availability, and compliance posture based on risk.
- Execute appropriate contracts, data protection terms, or security addenda where required.
- Limit vendor access and data sharing to authorized purposes.
- Review critical vendors periodically or when material service changes occur.
- Remove vendor access or data integrations when no longer needed.

Material vendors may include DigitalOcean, MongoDB or managed database providers, Clerk, SendGrid, OpenAI, GitHub or source control providers, and monitoring or support tooling.

## 20. Personnel Security and Training

SCALE LXP personnel and contractors with access to company systems or customer data must understand and follow security responsibilities.

Personnel security practices include:

- Security expectations communicated during onboarding.
- Role-appropriate access provisioning.
- Confidentiality obligations for personnel and contractors.
- Security awareness training appropriate to role and risk.
- Prompt offboarding and access removal.
- Reporting obligations for suspected incidents, phishing, lost devices, unauthorized access, or policy violations.

## 21. Endpoint and Device Security

Personnel devices used to access SCALE LXP systems must be protected against unauthorized access and compromise.

Endpoint security expectations include:

- Use supported operating systems and keep devices patched.
- Enable screen lock and local authentication.
- Use disk encryption where supported.
- Protect devices from malware and unauthorized software.
- Do not store customer exports or Restricted data locally unless necessary and approved.
- Report lost, stolen, or compromised devices promptly.

## 22. Network and Infrastructure Security

SCALE LXP uses managed hosting and platform services to reduce infrastructure management risk. Infrastructure security expectations include:

- Restrict production administrative access to authorized personnel.
- Use secure protocols for administrative access.
- Restrict inbound and outbound access based on service need where supported.
- Segregate environments and services where feasible.
- Store production configuration securely.
- Review infrastructure and deployment configuration for material changes.
- Monitor provider security notices and apply required updates or configuration changes.

## 23. Backup and Recovery

SCALE LXP maintains backup and restoration practices for critical data based on provider capabilities and business requirements.

Backup requirements include:

- Identify critical data stores requiring backup or restore capability.
- Protect backups from unauthorized access.
- Encrypt backups where supported.
- Test restore procedures periodically or after material architecture changes.
- Document backup retention periods and recovery expectations.
- Ensure deleted data ages out of backups according to retention settings and technical feasibility.

## 24. Acceptable Use

Personnel must use SCALE LXP systems, data, devices, and accounts responsibly and only for authorized business purposes.

Prohibited activities include:

- Unauthorized access to systems or data.
- Sharing credentials or bypassing access controls.
- Storing secrets in unauthorized systems.
- Introducing malicious code.
- Exfiltrating customer, student, instructor, or company data.
- Using production data in local or development environments unless approved and protected.
- Connecting unapproved third-party tools to production systems or customer data.

## 25. Physical and Environmental Security

SCALE LXP primarily relies on managed cloud and platform providers for physical security of production infrastructure. Provider physical security controls are evaluated as part of vendor risk management.

For company-managed workspaces or devices, personnel must take reasonable precautions to protect devices, printed material, credentials, and confidential information from unauthorized access, loss, or theft.

## 26. Compliance and Institutional Reviews

SCALE LXP supports customer and institutional security reviews, including HECVAT, by maintaining security documentation and providing reasonable evidence of implemented controls.

Relevant evidence may include:

- Security policies and review history.
- Architecture and data flow summaries.
- Vendor and subprocessor inventory.
- Access control procedures and review evidence.
- Change management evidence.
- Vulnerability management records.
- Incident response procedures.
- Backup and recovery documentation.
- Privacy and data retention documentation.

SCALE LXP will review institutional security requirements and contractual obligations before committing to additional controls, certifications, data processing terms, or service-level obligations.

## 27. Exceptions

Exceptions to this policy must be documented, risk-assessed, time-bound where practical, and approved by appropriate leadership. Exceptions should include:

- Description of the exception.
- Business justification.
- Affected systems, data, or users.
- Compensating controls.
- Expiration or review date.
- Approval record.

## 28. Enforcement

Violations of this policy may result in access revocation, disciplinary action, contract termination, legal action, customer notification, or other remediation depending on severity, impact, and applicable obligations.

## 29. Policy Review and Maintenance

This policy must be reviewed at least annually and when material changes occur to SCALE LXP systems, vendors, data processing activities, security risks, or legal and contractual obligations. Updates must be approved by designated leadership and communicated to affected personnel.

## 30. Revision History

| Version | Date | Description | Owner |
| --- | --- | --- | --- |
| 1.0 | [Insert date] | Initial HECVAT information security policy draft | Security / Engineering Leadership |
