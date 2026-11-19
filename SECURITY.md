# Security Policy

Uganda Weather is a weather app for Uganda serving forecasts, alerts, air quality, marine safety data, and hybrid offline and cloud weather guidance for 152 districts. We take the security of the application and its users seriously.

## Reporting a vulnerability

Please do not report security vulnerabilities through public GitHub issues.

The preferred way to report a vulnerability is to open a private security advisory on GitHub for this repository (Security tab, "Report a vulnerability"). If you are unable to use that method, reach out through [mcraftportfolio.dev](https://www.mcraftportfolio.dev/).

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Steps to reproduce, including any affected endpoints, pages, or components
- Any proof-of-concept code or requests
- The version or commit hash you tested against

## Scope

The following are in scope for security reports:

- The live Uganda Weather web application
- The Next.js API routes and any backend services it depends on directly (caching, cron jobs, push notification dispatch)

The following are generally out of scope unless they demonstrate a concrete impact on Uganda Weather itself:

- Third-party weather data providers and other upstream services the app consumes
- Vulnerabilities that require physical access to a user's device
- Issues in dependencies that have no demonstrated exploit path within this application

## Response expectations

Uganda Weather is a small, independently maintained project. We will do our best to acknowledge reports promptly and keep you updated as we investigate, but we cannot commit to a service-level agreement or guaranteed response time. Please be patient, and thank you for helping keep the project and its users safe.
