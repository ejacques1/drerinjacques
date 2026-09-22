# STOP SENDING PEOPLE PDFs — BUILD THIS WITH CODEX

**Working title:** Stop Sending People PDFs—Build This Instead With AI

**Alternate title:** Turn Any PDF Into an Email List With Codex

**Thumbnail:** PDF → EMAIL LIST

**Target runtime:** 8–10 minutes

**Follow-along page:** https://drerinjacques.com/gating-workshop

**Audience:** Coaches, trainers, consultants, realtors, teachers, and other experts who already have a PDF, Word document, checklist, guide, or resource list.

---

## 0:00 — Hook: the real request

**[OPEN ON THE SCREENSHOT OF THE TRAINER'S MESSAGE. HIGHLIGHT: “CAN YOU MAKE THIS FILE SO PEOPLE HAVE TO PUT IN AN EMAIL TO GET IT?”]**

My trainer sent me this message: “Can you make this file so people have to put in an email to get it?”

She already had the valuable part—the content. But every time she sent someone the file, they downloaded it and disappeared. She had no way to know who opened it, follow up with them, or continue helping them.

And most of us have something like this sitting on our computer: a PDF, checklist, guide, template, or resource list.

So in this video, I’m going to show you how to use Codex to turn that file into a webpage that gives people a preview, collects their email, and then unlocks the rest—so the content you already created can start building your audience.

## 0:35 — The three-part plan

**[ON SCREEN: 1. TURN IT INTO A PAGE · 2. PUBLISH IT · 3. ADD THE EMAIL GATE]**

We’re going to do this in three parts.

First, we’ll turn your file into a webpage.

Second, we’ll publish it so anyone can access it.

Third, we’ll add an email gate that unlocks the rest.

By the end, you’ll have one link you can share—and every person who opens the full guide can join your email list.

## 0:55 — Who I am

**[RETURN TO ERIN. USE A SIMPLE LOWER THIRD.]**

By the way, if we haven’t met, I’m Dr. Erin Jacques. I’m a professor and AI strategist, and I teach people without technical backgrounds how to build practical AI applications for their work and businesses.

I am not going to write a single line of code in this video, and neither are you. We’re going to describe what we want in plain English, let Codex build it, and test each part before we share it.

I also created a follow-along page with every step and prompt. Keep it open while you build yours.

**[SHOW: drerinjacques.com/gating-workshop]**

Let’s get into it.

---

## 1:25 — Show the finished experience

**[OPEN ONE OF THE FINISHED EXAMPLES FROM THE FOLLOW-ALONG GUIDE.]**

Here is what we’re building.

Someone opens one link and starts reading the resource in the browser. When they reach the email gate, they enter their address. The rest of the guide unlocks on the same page, and their email is added to your list automatically.

The file becomes easier to read on a phone, and it begins building an audience instead of disappearing into someone’s downloads folder.

## 1:55 — What each service does

**[SHOW FOUR SIMPLE LABELS: CODEX · GITHUB · VERCEL · SYSTEME.IO]**

We’re using four tools, and each has one job.

Codex builds and updates the page.

GitHub stores the website files and keeps a history of the changes.

Vercel publishes the page and gives it a live link.

Systeme.io saves and tags the email addresses.

Codex will handle the technical work. You will create the accounts, approve the connections, and decide how the finished page should look.

---

## 2:25 — Step 1: Create the project folder

**[SHOW: CREATE A DESKTOP FOLDER CALLED “MY SIGNUP PAGE,” THEN COPY ONE DOCUMENT INTO IT.]**

Create a folder on your Desktop called **My Signup Page**. Put a copy of the PDF or Word document you want to share inside it.

Use one document for this first build. One guide, one folder, one clear result.

## 2:50 — Step 2: Create the GitHub repository

**[SHOW: github.com/new.]**

In GitHub, create a new private repository. Give it a simple name, turn on **Add a README**, and create it.

When the repository opens, copy the full address from your browser. Save it somewhere because we will give that link to Codex once.

GitHub is where the project will live after Codex builds it.

## 3:20 — Step 3: Connect GitHub to Vercel

**[SHOW: VERCEL → ADD NEW PROJECT → IMPORT THE GITHUB REPOSITORY.]**

Inside Vercel, connect GitHub and import the repository you just created. Select **Other** for the framework and leave the build command empty.

When you deploy it the first time, you may see a 404 page. That is expected. The repository only has a README right now; Codex has not created the website yet.

The win here is that GitHub and Vercel are connected. Once Codex pushes the page, Vercel will publish it automatically.

## 3:55 — Step 4: Prepare Systeme.io

**[SHOW THE SETTINGS, BUT NEVER SHOW THE API KEY.]**

In Systeme.io, create a tag called **Download**. Then create or copy your public API key.

That key works like a password, so do not paste it into Codex, GitHub, or a document.

Instead, open your Vercel project, go to **Settings**, then **Environment Variables**. Create one named `SYSTEME_API_KEY`, paste the key as the value, select Production, and save it.

Codex only needs to know the name of the variable. It never needs to see the key itself.

---

## 4:35 — Step 5: Open the folder in Codex

**[SHOW: CODEX PROJECT MENU → EDIT PROJECT → ADD FOLDER → MY SIGNUP PAGE → SAVE.]**

Open Codex and add the **My Signup Page** folder to your project.

The document is now inside the folder Codex can work with. Before asking it to build, we’ll connect that folder to the GitHub repository.

Paste this prompt and replace the bracketed section with your repository link.

### Prompt 1 — Connect the folder

```text
Check whether you can access my GitHub repository at [PASTE YOUR REPOSITORY LINK], install any missing tools, and guide me through any sign-in I need to complete. Connect this folder to that existing repository, keeping the document already here, and confirm you’re ready to build.
```

**[SHOW CODEX CHECKING THE REPOSITORY. COMPLETE ANY SIGN-IN OR PERMISSION REQUEST.]**

When Codex says it is ready, keep using this same folder and the same conversation.

## 5:25 — Step 6: Build the signup page

Now we give Codex the actual job.

This prompt points it to one of my finished examples, tells it to use the document in the folder, and explains exactly how the email gate should work.

Replace the bracketed line with your name or business.

### Prompt 2 — Create the page

```text
Look at https://drerinjacques.com/blackwell as an example of the email signup and unlock I want. Create a page for the document in this folder using my own information.

My name or business: [YOUR NAME]

People should enter their email to unlock the document. Save them in Systeme.io with the Download tag before unlocking, including existing contacts. My key is already in Vercel as SYSTEME_API_KEY; keep it private and keep the document protected until signup.

Show me a preview so I can see how the page looks.
```

**[SPEED UP CODEX WORKING, THEN OPEN THE LOCAL PREVIEW.]**

This is the first big payoff. The file is now a real webpage.

Read through it before publishing. Compare it with the original document. Check the headings, lists, links, and how it looks on a phone.

If you want a different color, title, or layout, tell Codex in plain English. Keep making changes until the preview feels like yours.

## 6:45 — Why the gate must be real

There is one detail in that prompt that matters: the document must stay protected until signup.

Some pages only hide the second half with styling. That means the content is already sitting in the browser, and someone can still find it without entering an email.

We are asking Codex to keep the protected content behind the server and release it only after a successful signup.

That turns the form from decoration into a real email gate.

## 7:15 — Step 7: Publish it

When the preview is ready, publish it with one final prompt.

### Prompt 3 — Publish the page

```text
Push the changes to the existing GitHub repository.
```

**[SHOW CODEX PUSHING THE CHANGES, THEN VERCEL DEPLOYING.]**

Vercel detects the GitHub update and publishes the website. Open the Production URL when the deployment finishes.

That is now a real link you can send to someone.

---

## 7:50 — Test the complete journey

**[SHOW THIS AS ONE CONTINUOUS TEST.]**

Do not stop when the page looks finished. Test the entire journey.

Open the live page and use an email address you control. Confirm that the guide unlocks. Then open Systeme.io, find the contact, and confirm the **Download** tag was added.

Test it again with an email already on your list. It should gain the Download tag without losing its other tags.

Finally, open a fresh private browser and confirm the protected part of the guide cannot be reached before signup.

Now you know the page works for a new person, an existing contact, and someone trying to bypass the gate.

## 8:35 — Close

**[RETURN TO ERIN.]**

We started with a file sitting on a computer. Codex turned it into a webpage. GitHub stored it, Vercel published it, and Systeme.io turned each unlock into someone you can continue helping.

That is the real value. You are not simply giving away a PDF. You are turning knowledge you already created into a way to build an audience you can reach again.

Every prompt and step is on the follow-along page linked below. Choose one useful file, follow the process, and build your own version.

If you want to learn how to build practical applications like this with AI, subscribe. And if you want hands-on help building and launching your own tools, join us inside the AI-Powered Web Apps community.

---

## Production notes

- The trainer message is the opening visual. Keep her identity hidden unless permission to show it has been confirmed.
- Do not change the hook into a generic explanation of lead magnets.
- Reveal the three-step plan before Erin's introduction.
- Keep the finished page visible during the first 90 seconds so viewers understand the payoff.
- Move quickly through account screens; spend more time on the page transformation and final test.
- Use Codex throughout. Do not show or mention Claude Code in this version.
- Use the three prompts exactly as they appear on the live follow-along guide.
- Never show the Systeme.io API key. If it appears in a recording, revoke it and create a new one.
- Blur real email addresses and private account information.
- If runtime must be shortened, reduce the account-setup narration before cutting the final end-to-end test.
