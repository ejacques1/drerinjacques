# Build Your Own Testimonial System With AI

This is the working build guide for the YouTube video and future training. It records the real workflow used for the Dr. Erin Jacques website while arranging the steps in the clearest order for a beginner.

## What the finished system does

The system has five connected parts:

1. A public form where someone rates an experience and submits a written or video testimonial.
2. Supabase storage for the testimonial record, photo, video, training connection, approval status, and display locations.
3. A private dashboard where the owner reviews, approves, features, organizes, and places each testimonial.
4. A public Wall of Love that shows only approved testimonials.
5. Reusable testimonial sections that can appear on the homepage, a workshop page, or another sales page.

## Before recording

Prepare these accounts and materials:

- The existing website repository in GitHub
- A Vercel project for the live website
- A Supabase project for the database, storage, and dashboard login
- A Resend account with a verified sending domain
- Access to the existing Senja account
- A folder for the exported testimonial CSV, photos, videos, and screenshots

Never show API keys, database secrets, customer email addresses, or private consent information on screen.

## Step 1: Study the current testimonial workflow

Before asking AI to build anything, show it the system being replaced.

Review in Senja:

- The collection form and every question it asks
- The star-rating step
- Written, video, and image testimonials
- The review and approval process
- Tags or forms used to identify a workshop or offer
- The public wall and other widgets
- Photo behavior: uploaded photo, Gravatar, then initials
- Display controls such as featured stories, order, and page placement

Create a short list of the features that must be preserved. Senja is the functional reference; the new system should use the business's own branding and language.

## Step 2: Export and protect the existing testimonials

Do this before cancelling or changing the old service.

1. Export the testimonial records from Senja.
2. Download every customer photo, video, and image attachment that should be retained.
3. Save screenshots of the existing wall, collection form, and settings.
4. Keep the original export unchanged as a backup.
5. Create a separate working copy for cleaning or import preparation.
6. Check that names, testimonial text, ratings, dates, tags, permissions, and media references are present.

The testimonials are the valuable asset. The platform is the container.

## Step 3: Give AI the existing website project

Open the existing website repository in Codex. Ask it to inspect the site before making changes.

The starting request should explain:

- Match the current website's branding and layout.
- Add the testimonial system without replacing unrelated pages.
- Build locally first.
- Store submissions privately.
- Require approval before anything becomes public.
- Support one testimonial appearing in several places.
- Keep private keys and customer contact information out of public code.
- Wait to replace the existing live Senja wall until the new system has real approved content.

## Step 4: Create the Supabase project

Supabase holds the database records, uploaded media, and private dashboard authentication. Vercel continues to host the website.

During project setup:

1. Create or select the Supabase project.
2. Connect the GitHub account.
3. Select and authorize the specific website repository.
4. Set the working directory to `.` when the repository's `supabase/` folder is at the root.
5. Enable production deployment from `main`.
6. Turn automatic branching off unless paid preview databases are wanted.

The GitHub connection does not invent database tables. It allows migration files committed under `supabase/migrations/` to be applied when they reach the configured production branch.

## Step 5: Connect Supabase to Vercel

Connect the Supabase project to the existing Vercel website project.

Use these settings for this project:

- Production environment: on
- Preview environment: off
- Development environment: off
- Public variable prefix: `NEXT_PUBLIC_`

This syncs the Supabase connection values into Vercel. It does not make secret keys safe to use in browser code; privileged operations must remain in server functions.

## Step 6: Create the database and storage structure

Ask AI to create versioned SQL migration files locally, commit them, and push them through GitHub.

The structure needs:

- Testimonials and approval status
- Ratings
- Trainings or offers
- A many-to-many link between testimonials and trainings
- Public destinations and display order
- Consent and contact fields that remain private
- A public photo bucket
- A private video bucket
- Row-level security
- Submission rate limiting

Store each testimonial once. Placement records determine whether it appears on the full wall, homepage, one or more training pages, or another sales page.

## Step 7: Build the public collection form

The form should feel simple to the customer and should not require an account.

Recommended flow:

1. Select a required 1–5 star rating.
2. Choose a written or video testimonial.
3. Answer guided questions about the experience and result.
4. Enter name and email.
5. Optionally add a photo; show the initials avatar that will be used if no photo is selected.
6. Add the workshop, service, or organization when relevant.
7. Review the testimonial.
8. Grant publication permission and submit.
9. Show a clear confirmation screen.

Uploaded photos take priority. If none is uploaded, the system can try the Gravatar associated with the submitted email and then fall back to initials. The email address itself must never be displayed publicly.

The general form is:

`https://drerinjacques.com/share-your-story/`

A workshop-specific link uses a training slug:

`https://drerinjacques.com/share-your-story/?training=gating-workshop`

## Step 8: Build the private review dashboard

The private dashboard must let the owner:

- See submissions that need review
- Approve or hide a story
- Feature a story
- Correct or organize its public presentation
- Connect it to one or more trainings
- Choose one or more display destinations
- Set display order
- Search and filter the library

Selecting a destination does not approve a testimonial. The owner must approve it and save the changes.

The live dashboard is:

`https://drerinjacques.com/testimonials-admin/`

## Step 9: Configure secure dashboard email

Supabase email codes protect the private dashboard. The built-in Supabase email sender has a low test limit, so configure Resend as custom SMTP before relying on it.

In Resend:

1. Add and verify the website's sending domain.
2. Create an API key for the project.
3. Copy it when shown; it will become the SMTP password.

In Supabase Custom SMTP, enter:

- Sender name: the business name
- Sender email: an address on the verified domain, such as `login@domain.com`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the Resend API key

Configure the authentication email template to show the one-time code. Accept the configured Supabase code length rather than assuming it is always six digits.

For the Dr. Erin Jacques project, the approved dashboard emails are `drerintj@gmail.com` and `info@erinjacques.com`.

## Step 10: Build the public displays

Create one safe public endpoint that returns only approved, consented display information. It must omit customer emails, consent records, private storage paths, and unpublished stories.

Build:

- A full Wall of Love
- A reusable homepage section
- A reusable training-page section
- Optional filters for programs or workshops
- Written, video, rating, photo, Gravatar, and initials displays

The full wall is:

`https://drerinjacques.com/testimonials/`

The Email Signup Page Workshop embeds its approved stories near the bottom of:

`https://drerinjacques.com/gating-workshop/`

## Step 11: Connect each workshop to its own link

Give each workshop or offer a stable slug. Put that slug in the testimonial link sent to attendees.

Example follow-up journey:

1. The attendee receives the workshop resource link.
2. The workshop page includes a final invitation to share their experience.
3. The follow-up email also contains the workshop-specific testimonial link.
4. The training slug is attached to the submission automatically.
5. After approval, the story can appear on that workshop page, the full wall, the homepage, or several destinations at once.

## Step 12: Import the Senja library

After the new workflow is working:

1. Map the Senja export columns to the new database fields.
2. Match each photo, video, and attachment to the correct person.
3. Preserve the original wording, rating, date, and permission status.
4. Assign the appropriate training, tag, and destination.
5. Import a small test batch first.
6. Compare the imported records with the Senja originals.
7. Import the remainder only after the test batch is correct.
8. Keep uncertain records private until their permissions are confirmed.

## Step 13: Test the complete journey

Run the system as both customer and owner:

1. Open a workshop-specific collection link.
2. Select a rating and submit a testimonial without uploading a photo.
3. Confirm the initials or Gravatar preview works.
4. Confirm the record reaches the private dashboard as needing review.
5. Sign in using the emailed code.
6. Approve the testimonial and select its destinations.
7. Confirm it appears on the full wall and selected workshop page.
8. Hide it and confirm it disappears.
9. Test a photo and video submission.
10. Test the pages on a phone.

## Step 14: Replace Senja only after verification

Keep the existing Senja embed live until the imported testimonials and new displays have been checked. Then replace the Senja section on the homepage, verify the live site again, and retain the export backup.

Only after that should the old subscription be cancelled.

## Suggested YouTube structure

1. Why testimonial systems are valuable
2. What Senja currently does for the business
3. Export and protect the customer stories
4. Show AI the existing website and desired workflow
5. Connect GitHub, Supabase, and Vercel
6. Create versioned database migrations
7. Build the collection form
8. Build the private approval dashboard
9. Configure Resend email login
10. Build the wall and reusable page sections
11. Import the existing testimonials
12. Demonstrate submission, approval, and publication from beginning to end
13. Replace the old embed and explain ongoing costs

## Screenshots and recordings to capture

- Senja collection form, wall, and export area
- The two-step GitHub authorization process
- Supabase GitHub integration settings
- Supabase-to-Vercel Production environment sync
- A migration file in `supabase/migrations/`
- The Resend domain verification page without exposing DNS secrets unnecessarily
- The Supabase Custom SMTP field names without exposing the API key
- Rating and avatar-preview steps on the collection form
- A pending submission in the dashboard
- Approval, training assignment, destinations, and display order
- The approved story on the wall and workshop page
- A mobile view of the form and public display

## Current project status

Completed:

- Supabase database, storage, authentication, and rate limiting
- GitHub production migration connection
- Vercel Production credential connection
- Resend custom SMTP for the Dr. Erin Jacques dashboard
- Public written/video submission flow
- Required star rating and photo/initials/Gravatar preview
- Private review and placement dashboard
- Public testimonial wall
- Email Signup Page Workshop-specific collection link and embedded display

Still to do:

- Export and back up the complete Senja library
- Clean and map the exported records and media
- Import and verify a small batch, then the complete library
- Connect the new testimonial display to the homepage
- Replace the remaining Senja embed after verification
- Perform final mobile and end-to-end testing with the imported content
