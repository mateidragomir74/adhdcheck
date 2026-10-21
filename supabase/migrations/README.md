# supabase/migrations

Owner: Person 3 (backend). Tables and row-level security go here as numbered SQL files
(`supabase migration new <name>` creates one). Do not create a cloud project or log in from a
shared machine without agreeing it in the team channel; the project is created in the Frankfurt
region (`research/03-tech-stack.md`, section 1). No key or connection string in any file here.

## Applying a migration on the live project (read before any deploy)

The live project's migration history (`supabase_migrations`) records only three versions, while the later migrations
here were applied by hand. A `supabase db push` would therefore try to run migrations that already exist and fail, or
worse. Never run `supabase db push` on this project. Apply each new migration by hand (the SQL editor, or the
`apply_migration` call of the Supabase tool), once, BEFORE merging the code that needs it. For
`20261022110000_minigames_and_link_grace.sql` (PC-02): apply it first; the new upload code sends `minigames`, and
without the column `save_session` keeps working but drops the field.
