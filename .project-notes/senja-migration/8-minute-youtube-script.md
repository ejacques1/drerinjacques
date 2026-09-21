# YouTube Script: Build Your Own Testimonial System With AI

**Target length:** About 8 minutes  
**Working title:** I Built My Own Testimonial System With AI  
**Thumbnail:** BUILD IT WITH AI

## 0:00 — Hook

**ON CAMERA**

Businesses pay every month for tools that collect customer testimonials and display them on a website. Those tools can be useful—but I wanted to know whether AI could help me build a testimonial system directly into a website I already own.

So that is what we are doing today.

## 0:20 — What viewers will build

**SHOW THE FINISHED FORM, DASHBOARD, AND WALL AS EACH ITEM IS NAMED**

We are going to do four things:

1. Prompt AI to build the system.
2. Connect the services it needs.
3. Create the collection and approval process.
4. Display approved testimonials on the website.

By the end, customers will have one link where they can share their experience, and you will control what appears publicly and where it appears.

## 0:45 — Decide what the system needs

**SHOW EXAMPLE SCREENSHOTS OF A RATING, CUSTOMER DETAILS, AND A TESTIMONIAL WALL**

Before I prompted AI, I looked at how testimonial tools usually work.

Most begin with a rating. Then they guide the customer through a few questions, collect their name and email, and give them the option to add a photo or video. The business owner reviews the submission before it appears on a public testimonial wall.

Those are the features I wanted. I also wanted to connect each testimonial to a specific workshop or training, because the same story might belong on that workshop page, the homepage, and a larger testimonial wall.

You do not need to copy another company's design. You need to understand the workflow you want AI to create.

## 1:25 — Give AI the first prompt

**SCREEN RECORDING: OPEN THE EXISTING WEBSITE PROJECT IN CODEX**

I opened my existing website project in Codex and gave it the job.

**SHOW THIS PROMPT ON SCREEN**

> Inspect my existing website before making changes. Build a branded testimonial system that includes a customer submission form, private review dashboard, and public testimonial display. Customers should be able to submit written or video testimonials, select a star rating, answer guided questions, and optionally add a photo. Nothing should appear publicly until I approve it. One testimonial must be able to appear on multiple pages or connect to multiple trainings. Build and test a local preview first.

This prompt describes the result, the important rules, and how the system should fit into the website. I do not have to tell AI how to write every line of code.

## 2:10 — Connect the services

**SHOW A SIMPLE DIAGRAM: GITHUB → VERCEL, SUPABASE, AND RESEND**

The website needs four connected services.

GitHub stores the website code and records every change. Vercel publishes the website. Supabase stores the testimonials, photos, videos, approval status, and login information. Resend sends the secure email code used to enter the private dashboard.

If your website is already connected to GitHub and Vercel, you do not need to create them again.

## 2:40 — Connect GitHub to Supabase

**SHOW THE SUPABASE GITHUB CONNECTION SCREEN**

Inside Supabase, I first connected my GitHub account. Then I selected the specific website repository and authorized it. Those are two separate steps.

Because the `supabase` folder is at the top level of my repository, I entered a period for the working directory. I selected `main` as the production branch and turned automatic branching off because I did not need paid preview databases for this project.

This connection matters because AI can create the database instructions as files inside the project. When those files are pushed to GitHub, Supabase can apply them. I do not have to copy and paste every new SQL command manually.

## 3:25 — Connect Supabase to Vercel

**SHOW THE VERCEL CONNECTION SETTINGS**

Next, I connected the Supabase project to my existing Vercel project. I turned on Production and left Preview and Development off.

That places the Supabase connection values in the live website environment. Secret values still stay in server-side code; they are never placed in the public page.

## 3:50 — Ask AI to create the foundation

**SHOW THE DATABASE MIGRATION FILE AND LOCAL PREVIEW**

Then I gave AI the next job.

**SHOW THIS PROMPT ON SCREEN**

> Create the Supabase database and storage foundation for the testimonial system. Store each testimonial once, but allow it to connect to multiple trainings and display locations. Keep contact information and consent private. Add secure photo and video storage, approval status, display order, and submission rate limiting. Create the SQL as versioned migration files in the repository.

AI created the database structure and the code that safely sends form submissions to it.

## 4:25 — Build the customer experience

**DEMONSTRATE THE FORM**

The customer starts by choosing a one-to-five-star rating. Then they choose a written or video testimonial and answer a few focused questions.

They add their name and email, and they can upload a photo if they want. If they do not choose one, the form shows the initials avatar that can represent them. The system can also check for a Gravatar connected to their email.

At the end, they review what they wrote, give permission to publish it, and submit it. They never need to create an account.

## 5:05 — Build the approval dashboard

**OPEN A PENDING TESTIMONIAL IN THE DASHBOARD**

Every new testimonial arrives in a private dashboard as “Needs review.”

From here, I can approve it, hide it, feature it, connect it to a training, and choose where it should appear. I can place the same testimonial on the full testimonial wall, the homepage, and a workshop page without creating three separate copies.

Checking a location does not automatically publish the testimonial. I still have to approve it and save my changes.

## 5:40 — Set up secure email login

**SHOW RESEND AND SUPABASE SMTP FIELDS—DO NOT SHOW THE API KEY**

The dashboard uses a secure code sent by email. Supabase's built-in email service is fine for early testing, but it has a low sending limit, so I connected Resend for reliable email delivery.

I verified my sending domain in Resend and created an API key. Then, in Supabase's custom SMTP settings, I used `smtp.resend.com` as the host, `465` as the port, `resend` as the username, and the API key as the password.

Never display or paste your API key into a public page, a video, or GitHub.

## 6:20 — Display the approved testimonials

**SHOW THE WALL AND WORKSHOP PAGE**

Finally, AI created the public testimonial wall and reusable testimonial sections for other pages.

Only approved testimonials with publication permission are returned to the public website. Email addresses and private information are never included.

For a specific workshop, I can send a link with that workshop's name built into it. The testimonial is automatically connected to the correct training, and after I approve it, I can display it at the bottom of that workshop page.

## 6:55 — Demonstrate the complete journey

**SHOW THE STEPS QUICKLY AS A CONTINUOUS DEMO**

Here is the complete workflow.

I open the customer link, select a rating, answer the questions, and submit a testimonial. Then I sign into the private dashboard, open the new submission, approve it, and select the testimonial wall and workshop page.

When I refresh those pages, the approved story appears. If I hide it later, it disappears from every public location without deleting the original record.

## 7:30 — Closing lesson

**ON CAMERA**

AI did not create the customer relationship or the result behind the testimonial. It helped me build the system that collects, organizes, and displays those stories.

The process came down to four things: describe the system clearly, connect the services, test the customer and approval workflows, and decide where each approved story belongs.

If you want to build practical tools like this directly into your own website, subscribe. I will continue showing you the real prompts, connections, and decisions behind the tools I build with AI.

## Optional closing call to action

If you want more help building practical tools with AI, join my AI-Powered Web App Community. The link is below.

## Editing notes

- Keep the four outcomes visible on screen during the opening.
- Use screenshots for setup screens and short recordings for the customer journey.
- Blur customer information, project secrets, DNS values when appropriate, and all API keys.
- Put the two longer prompts on screen and provide them in the video description or a downloadable resource.
- Avoid explaining the Senja export in this video; make migration and import a separate follow-up.
- If the runtime is long, shorten the SMTP explanation before cutting the complete end-to-end demonstration.
