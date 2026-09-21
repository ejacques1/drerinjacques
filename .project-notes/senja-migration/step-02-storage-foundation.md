# Step 2: Set up the storage foundation

## Why this comes before the dashboard

Every page needs the same source of truth. The submission page writes to it, the private dashboard reviews it, and the public pages read only approved records from it.

## Selected foundation

Use one Supabase project for:

- Postgres database records
- Photo and video storage
- Private dashboard authentication

Keep the website and server functions on Vercel.

## How testimonial placement works

A testimonial is stored once. It can then be connected to:

- Zero, one, or several trainings through `testimonial_trainings`
- Zero, one, or several public locations through `testimonial_destinations`

Destinations can be the homepage, the full testimonial wall, a training page, or another sales page. Moving a testimonial changes its destination records; it does not duplicate or erase the original testimonial.

## Files created

`supabase/migrations/202609200001_testimonial_system.sql` defines:

- Trainings
- Testimonials and approval status
- Many-to-many training assignments
- Many-to-many page destinations and display order
- Row-level security that prevents browsers from reading contact or consent data directly
- Separate photo and private video storage buckets

## Required connection values

These will be stored as deployment environment variables and never committed:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## Next implementation action

Create the Supabase project and connect the correct GitHub repository during setup. For a beginner, doing this now removes a later setup step and prepares database preview branches and versioned migration workflows. Explain that connecting GitHub only grants the integration access; it does not change the repository or apply database migrations by itself.

## YouTube tutorial order

Connect GitHub before creating the database tables. Once the connection is active, create each SQL change locally as a migration file inside `supabase/migrations/`, commit it, and push it to the production branch. Supabase then applies the migration automatically, so the viewer does not need to copy and paste that SQL into the SQL Editor.

The simple explanation for viewers is: **create the SQL file locally, push it to GitHub, and the GitHub integration sends that database change to Supabase.**

The GitHub connection is a two-step process in the Supabase interface:

1. Connect the GitHub account to Supabase.
2. Select the specific `ejacques1/drerinjacques` repository in GitHub and authorize Supabase to access it.

After authorization, configure the integration with working directory `.`, production deployment enabled, production branch `main`, and automatic branching disabled to avoid preview-branch compute charges.

Then apply the migration and add the validated submission API and signed media uploads.

## Verified connection settings

- GitHub repository: `ejacques1/drerinjacques`
- Working directory: `.`
- Production migrations: enabled for `main`
- Automatic branching: disabled to avoid preview-branch compute costs
- Existing Vercel project: `drerinjacques`
- Vercel credential sync: Production enabled; Preview and Development disabled
- Public variable prefix: `NEXT_PUBLIC_`

The Supabase environment variables were verified in Vercel without revealing their values.

## Submission wiring

- `api/testimonials.js` validates submissions and writes them as `pending` records.
- Photos and videos use short-lived signed upload tokens; the Supabase secret key stays server-side.
- The browser uses only the publishable key for the signed upload operation.
- A honeypot, minimum form-completion time, file type/size validation, and database-backed rate limit reduce automated abuse.
