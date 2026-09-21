# Step 3: Build the private testimonial dashboard

## What the dashboard does

The dashboard gives the site owner one place to:

- See stories waiting for review
- Approve, hide, or feature a testimonial
- Connect one testimonial to one or several trainings
- Place the same testimonial on the homepage, testimonial wall, training pages, or another sales page
- Set a display-order number for each location
- Search and filter the testimonial library
- Add a new training without leaving the review screen

## Tutorial demonstration

Use the local preview first. It contains sample stories and saves changes only in the browser, so viewers can safely test the workflow without changing the live database.

Demonstrate this sequence:

1. Open a story marked **Needs review**.
2. Read the submitted story and recommendation.
3. Choose **Approve** or **Hide**.
4. Optionally mark it **Featured**.
5. Select every training the story supports.
6. Select every website location where it should appear.
7. Enter a display-order number when placement order matters.
8. Save the changes.

## Live security

The deployed dashboard uses a Supabase email code. We initially tried one-click magic links, but Gmail's security scanning consumed both one-time links before they could be used. For the tutorial, configure the Supabase **Magic link or OTP** email template to display `{{ .Token }}`, then have the dashboard verify that code with `verifyOtp`. Do not assume the code has six digits: this project is configured for eight, and Supabase supports configurable lengths.

The server checks the signed-in email against `TESTIMONIAL_ADMIN_EMAILS` before returning testimonial records or accepting edits. The current approved addresses are `drerintj@gmail.com` and `info@erinjacques.com`. Contact information and consent data are never available through the public browser key alone.

For testimonial portraits, an uploaded photo takes priority. When no photo was uploaded, the server normalizes and SHA-256 hashes the customer's email and requests the matching Gravatar. If no Gravatar exists, the interface displays the customer's initial. The collection form discloses this fallback beside the email field; the email address itself is never placed in the image URL or shown publicly.

Supabase's built-in email service is limited to two emails per hour for this project, and that field cannot be increased while using the built-in sender. Configure custom SMTP before relying on frequent production sign-ins. During setup, avoid repeatedly requesting test messages or the quota will delay verification.

## Files

- `testimonials-admin/index.html` contains the private dashboard interface.
- `testimonials-admin/styles.css` contains its responsive design.
- `testimonials-admin/app.js` runs the local demonstration and the live authenticated workflow.
- `api/testimonial-admin.js` authenticates administrators and reads or updates Supabase.
