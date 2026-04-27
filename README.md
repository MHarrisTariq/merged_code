## all merge code

This folder is the single place where you can keep **all platforms** together for easier deployment.

### Structure

- `platforms/`: put each platform/project in its own subfolder
  - Example: `platforms/ai-ml-sub-plan/`
  - Example: `platforms/al-ml-booking-management/`
- `shared/`: shared libraries, configs, and assets used by multiple platforms

### How to use

1. Copy or move each existing platform folder into `platforms/` (optionally rename to clean, lowercase names).
2. Put anything common (env templates, docker compose, shared utils) into `shared/`.
3. Add a root deploy entrypoint (example: `docker-compose.yml`) here once your platforms are organized.

