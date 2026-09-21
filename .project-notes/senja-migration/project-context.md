# Senja migration and YouTube walkthrough

The user supplied a tentative YouTube outline, preserved in original-video-outline.md. Keep it as context, not as a completed migration or a final script.

The user wants to see the real steps so the eventual script can reflect what actually happened. Explain each stage, preserve useful prompts and decisions, and record verified results as work proceeds.

Working interpretation: build an owned testimonial system into the existing website. Confirm whether “recreating my own website” means this testimonial workflow or a broader website rebuild before making substantial changes.

Initial website inspection on 2026-09-20:
- The existing website uses HTML pages, Node API functions, and Vercel configuration.
- index.html includes a Senja widget at lines 1059–1060. preview-new-home/index.html also includes it.
- The build excludes dot-prefixed folders, so these project notes are excluded from the generated public assets.
- No website code has been changed for this request.

Verified Senja account inventory on 2026-09-20:
- The account has 61 proof items: 30 approved and 31 unapproved.
- The homepage uses the saved `All Testimonials` widget with ID `7b98730e-c5f3-4579-99d1-b9e1ceff3467`; this matches the embed in index.html.
- The widget uses manual selection: 28 approved testimonials are selected.
- It is a three-column masonry display with large spacing, customer photos, Gravatar fallback, initials fallback, dates/likes, ratings, video excerpts, testimonial titles, image attachments, highlights, and shortened long testimonials with Read more/Read less.
- It limits the display to 64 testimonials and includes a Load more control.
- Verified colors include primary `#6701e6`, background `#ffffff`, text `#374151`, rating `#fbbf24`, highlight `#ffcd3640`, and fallback avatar `#c9eed9`; font is DM Sans.
- Three other saved displays exist: Testimonials (masonry), Video Testimonials (carousel), and Success Images (avatars).
- Content includes written testimonials, video testimonials with transcripts, image-based success stories, generated case-study drafts, approval state, source/form metadata, dates, ratings, tags, languages, photos, and highlights.
- Senja's Forms page and Invite a customer dialog currently show no selectable form. Collection must therefore be designed as a new workflow rather than copied from a currently active form.
- No settings or account data were changed during inspection.

Recommended first implementation milestone:
- Create a branded public submission page with written/video choice, guided questions, identity/contact fields, consent, and a confirmation state.
- Choose persistent database and media storage before wiring submissions; the current repository has no general-purpose testimonial database or media store.

Milestone 1 completed locally on 2026-09-20:
- Added `/share-your-story/` as a branded, responsive multi-step prototype.
- It supports written/video selection, identity and context fields, optional photo/video inputs, guided testimonial prompts, publication consent, review, validation, and confirmation.
- The preview deliberately does not transmit or save information yet.
- Verified the complete written flow in a local browser and confirmed the project build succeeds.
- Next milestone: connect persistent records and media storage, then build the private approval view.

Milestone 2 foundation prepared locally on 2026-09-20:
- Selected Supabase as the proposed combined database, media-storage, and dashboard-authentication service; the existing site remains hosted on Vercel.
- Added `supabase/migrations/202609200001_testimonial_system.sql`.
- The model stores each testimonial once, connects it to multiple trainings, and independently assigns it to multiple public destinations with ordering.
- Row-level security keeps testimonial contact and consent data unavailable to browsers. Public displays will receive only approved safe fields through a server endpoint.
External foundation completed on 2026-09-20:
- Created the paid Supabase project `Dr. Erin Jacques site` in the Leveraging AI organization.
- Connected `ejacques1/drerinjacques` with working directory `.`, production branch `main`, and automatic branching disabled.
- Connected the existing Vercel `drerinjacques` project for Production credential sync only.
- Applied and verified the testimonial schema, photo/video buckets, and database-backed submission rate limiter.
- Verified the expected Supabase environment-variable names in Vercel without revealing values.

Proposed walkthrough sequence:
1. Inspect the existing Senja wall and collection form; identify required features.
2. Export and back up existing testimonial text and media using available account features; verify permissions and completeness.
3. Define submission, storage, media, private review, and approved public display requirements.
4. Build a local preview matching the existing website.
5. Implement collection and private approval, then the public wall and reusable sections.
6. Import actual testimonials and verify content and media.
7. Test submission through approval and public display, including mobile.
8. Review the finished result before publishing.

Record actual steps, results, limitations, and ongoing service costs. Do not describe planned functionality as implemented or assume self-hosting eliminates all recurring costs.
