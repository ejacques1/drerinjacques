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

The deployed dashboard uses Supabase passwordless email sign-in. The server checks the signed-in email against `TESTIMONIAL_ADMIN_EMAILS` before returning testimonial records or accepting edits. Contact information and consent data are never available through the public browser key alone.

## Files

- `testimonials-admin/index.html` contains the private dashboard interface.
- `testimonials-admin/styles.css` contains its responsive design.
- `testimonials-admin/app.js` runs the local demonstration and the live authenticated workflow.
- `api/testimonial-admin.js` authenticates administrators and reads or updates Supabase.
