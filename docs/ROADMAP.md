# Roadmap

1. Apply the migration to an isolated local Supabase stack and run `npx supabase test db`.
2. Connect the owner's development/demo Supabase project and verify signup, email confirmation, login, logout, session restoration and password recovery.
3. Confirm participant data fields, age/eligibility requirements, parent-contact requirements and privacy/consent wording with the organization.
4. Confirm competition application statuses and workflow.
5. Implement application submission through a narrow transactional PostgreSQL RPC, then build the participant dashboard.
6. Build administrator workflows, FAQ management UI and chatbot functionality in later approved phases.
