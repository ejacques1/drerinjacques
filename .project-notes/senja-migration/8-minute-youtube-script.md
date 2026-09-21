# YouTube Script: Build a Testimonial System With AI

**Target length:** 8–10 minutes

**Working title:** Build Your Own Testimonial System With AI

**Thumbnail:** BUILD IT WITH AI

## Opening pattern taken from Erin's existing videos

1. Open on the problem and visible result.
2. Explain why the result matters.
3. Tell viewers what they will accomplish.
4. Introduce Erin and remove the technical objection.
5. Preview a short plan with a payoff at each stage.
6. Move directly into the first build.

## 0:00 — Hook and visible result

**[OPEN ON ERIN. THEN CUT QUICKLY BETWEEN THE FORM, DASHBOARD, AND WALL.]**

What if your customers could share their experience through one simple link—and you could decide exactly which stories appear on your website?

That is what I built here.

A customer chooses a rating, answers a few questions, and can add a photo or video. Their testimonial comes into a private review page. I approve it once, and then I can place it on my homepage, a workshop page, or a full wall of testimonials.

And I built the entire system with AI, directly inside my existing website.

## 0:30 — What viewers will do

**[KEEP THE FINISHED SYSTEM ON SCREEN.]**

In this video, I am going to show you how to build one too.

We will prompt AI to create the first version, connect a database so the form can save real submissions, put the system online, and then test the complete journey from customer submission to published testimonial.

So you are not leaving with a mockup. You are leaving with the process for building a working testimonial system of your own.

## 0:55 — Who I am

**[RETURN TO ERIN. OPTIONAL LOWER THIRD: DR. ERIN JACQUES · PROFESSOR & AI STRATEGIST.]**

By the way, if we have not met, I am Dr. Erin Jacques. I am a professor and AI strategist, and I teach people without technical backgrounds how to build practical AI applications for their work and businesses.

You do not need to write the code we are using today. Your job is to explain the experience you want, review what AI creates, and test whether it works.

## 1:15 — Preview the wins

**[ON SCREEN: BUILD IT · SAVE IT · PUBLISH IT · TEST IT.]**

Here is the plan.

First, we will build the form and see it working on the computer. That is our first win.

Then we will connect Supabase and save a real submission. Second win.

Then GitHub and Vercel will put it online. Third win.

Finally, we will submit, approve, and publish one testimonial from beginning to end.

Let us build it.

## 1:40 — Decide what the experience should include

**[SHOW SIMPLE REFERENCE IMAGES: STAR RATING, GUIDED QUESTIONS, CUSTOMER DETAILS, AND A TESTIMONIAL WALL.]**

Before prompting AI, decide what should happen for the customer and for the business owner.

For the customer, I want a star rating, guided questions, written or video responses, and an optional photo. If they do not upload a photo, I want them to see the initials that will represent them.

For the owner, I want every new story to wait for review. Once it is approved, I want to choose where it appears.

You can use screenshots or rough sketches to show AI the experience you have in mind. You are giving it a reference, then asking it to create something that fits your own website and branding.

## 2:15 — Prompt AI to build the first version

**[OPEN THE EXISTING WEBSITE PROJECT IN CODEX.]**

I opened my existing website project in Codex and started with this prompt.

**[SHOW THIS PROMPT ON SCREEN AND MAKE IT AVAILABLE BELOW THE VIDEO.]**

> Inspect my existing website before making changes. Create a branded testimonial system with three parts: a customer submission form, a private review dashboard, and a public testimonial wall. Start the form with a required one-to-five-star rating. Let customers submit a written or video testimonial, answer guided questions, and optionally add a photo. If no photo is selected, preview their initials. Nothing should appear publicly until I approve it. One testimonial should be able to appear on multiple pages or connect to multiple trainings. Build a local preview first and do not publish anything yet.

**[SHOW CODEX WORKING, THEN OPEN THE LOCAL FORM.]**

Here is the first payoff: a real form I can click through before connecting any outside services.

At this point I test the customer experience. I check the questions, choose a rating, try it without a photo, and look at it on a phone. If something feels confusing, this is when I tell AI to change it.

## 3:20 — Explain the three connections

**[SHOW A SIMPLE DIAGRAM: CODEX → GITHUB → VERCEL, WITH SUPABASE CONNECTED TO THE SITE.]**

The form looks real, but it cannot remember a submission yet, and nobody else can reach it. That is what the connections solve.

Supabase is the filing cabinet. It stores the testimonials, ratings, photos, approval status, and page assignments.

GitHub stores the website project and keeps a history of every change.

Vercel takes the project from GitHub and publishes it as a real website.

You can think of it this way: Supabase saves it, GitHub protects it, and Vercel publishes it.

## 3:55 — Connect Supabase and GitHub

**[SHOW THE SUPABASE GITHUB CONNECTION SCREEN.]**

Inside Supabase, create a project and connect GitHub. There are two parts: connect your GitHub account, then select and authorize the repository for this website.

My `supabase` folder is at the top level of the project, so the working directory is a period. I use `main` as the production branch. I turn automatic branching off because I do not need separate paid preview databases for this project.

This connection gives us a cleaner workflow. AI can create each database change as a migration file inside the project. When that file reaches GitHub, Supabase can apply it without me copying and pasting the SQL by hand.

## 4:45 — Ask AI to create the database

**[SHOW A MIGRATION FILE BRIEFLY. DO NOT DWELL ON THE SQL.]**

Now I give AI the second prompt.

**[SHOW THIS PROMPT ON SCREEN.]**

> Connect this testimonial system to Supabase. Create versioned migration files for testimonials, ratings, trainings, approval status, and display locations. Store each testimonial once, but allow it to appear on several pages. Keep customer contact information and consent private. Add secure photo and video storage, submission validation, and rate limiting. Then connect the form and dashboard to the database and test them locally.

I do not need to write or explain the SQL myself. I need to review the plan, let AI create it, and test the result.

**[SUBMIT A CLEARLY LABELED TEST TESTIMONIAL.]**

Now the form is doing more than looking good. The submission is saved. That is our second win.

## 5:40 — Connect Supabase and Vercel

**[SHOW THE SUPABASE-TO-VERCEL CONNECTION.]**

Next, connect the Supabase project to the existing Vercel project. For this build, I turn on Production and leave Preview and Development off.

That gives the live website the connection information it needs. Private keys remain behind the website in server-side functions; they never appear on the public page.

Then I ask AI to commit and push the tested project to GitHub. Vercel detects the change and publishes it.

**[OPEN THE LIVE FORM URL.]**

That is our third win: the form now has a real link that can be sent to anyone.

## 6:25 — Review and place a testimonial

**[OPEN THE PRIVATE DASHBOARD WITH A TEST SUBMISSION WAITING.]**

Every new testimonial arrives in the private dashboard as “Needs review.” Customers do not create an account and they do not log in. They only use the public submission link.

Inside the dashboard, I can approve or hide the story, feature it, connect it to a specific workshop, and choose where it should appear.

The testimonial is stored once. Its placement settings tell the website whether to show it on the full wall, the homepage, a workshop page, or several of those places at the same time.

## 7:10 — Complete end-to-end demonstration

**[SHOW THIS AS ONE CONTINUOUS, QUICK DEMONSTRATION.]**

Now let us run the complete system.

I open the public link as a customer. I choose a rating, select a written testimonial, answer the questions, enter my details, and submit it.

Then I open the private dashboard as the website owner. The new story is waiting for review. I approve it, connect it to this workshop, select the testimonial wall, and save the changes.

**[OPEN THE WALL AND WORKSHOP PAGE.]**

The same approved story now appears in both places. If I hide it later, it disappears from every public location without deleting the original submission.

That is the final win: one working journey from customer response to published proof.

## 8:10 — Closing

**[RETURN TO ERIN.]**

We started with a description and a few visual references. AI turned that into a working form. Supabase gave it a place to save information. GitHub preserved the project, and Vercel gave us a live link.

The important part is that you did not need to begin by understanding databases or writing code. You needed to understand the experience you wanted to create and test each win as you built it.

If you want to learn how to build practical tools like this with AI, subscribe. I share the prompts, connections, and real decisions behind the applications I build.

## Optional community call to action

If you want help building tools like this for your own business, join my AI-Powered Web App Community. The link is below.

## Production notes

- Stay on Erin's face for the first question, then reveal the finished form, dashboard, and wall quickly.
- Return to Erin for the introduction. This is the trust beat; use only a simple lower third.
- Keep **Build it · Save it · Publish it · Test it** visible during the plan.
- Show setup screens quickly. The payoffs deserve more screen time than account settings.
- Put both prompts in the description or a downloadable follow-along page.
- Do not require or mention a Senja account.
- Do not teach Resend. It is an owner-side production email detail and is not part of the customer testimonial workflow.
- Customers never log in. The dashboard is private to the website owner.
- Blur all API keys, database secrets, customer email addresses, and private consent information.
- If the runtime is long, shorten the connection explanations before cutting the final end-to-end demonstration.
