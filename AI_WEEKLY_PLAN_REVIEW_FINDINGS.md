# AI Weekly Plan Review Findings

## Scope
Reviewed the live weekly-plan flow, calendar visibility, Udgiv popup wiring, badge states in Design, database backing, and deployment branch alignment for the Social Media Manager / P2G project.

## Findings

### 1. Idea-to-post line of sight is mostly wired
The weekly-plan flow uses `weekly_plan_idea_id` as the stable link between the weekly plan idea and the created post. The create flow restores draft text and photo content from the database using that key, and the weekly-plan overview uses the same key to decide whether a post has already been created and whether the card should switch to `Gå til opslag →`.

### 2. Calendar visibility is incomplete for new ideas
The calendar page currently queries only `published` and `scheduled` posts. That means draft rows do not appear in `/dashboard/calendar`, so new ideas are not visible there until they are scheduled or published.

### 3. Udgiv popup existed but was not triggered
The popup component for scheduled posts was already present, including controls to change time and post now. The missing part was the click trigger in Udgiv: clicking a post loaded it into the editor, but did not set the modal state. This is now fixed.

### 4. Design badge states are present
The weekly-plan cards already support the two badge states that were requested:
- `Lav opslag →` for posts that have not yet been created
- `Gå til opslag →` for posts that already have a created post with caption data

### 5. Database backing is in place
The posts table and related hooks already store and read the relevant columns, including `idea_source`, `suggestion_id`, `weekly_plan_idea_id`, and `weekly_plan_slot_date`. The live flow is not only local UI state.

## What I deployed
I deployed the Udgiv popup fix using the repository's deployment script:

- Command: `./deploy-to-vercel.sh "Fix Udgiv post popup trigger"`
- Commit on `main`: `99033a7`
- Pushed to `vercel-test`: yes
- Result: deployment triggered successfully on the branch Vercel watches

## Open Questions

1. Should drafts also appear in the calendar, or is it enough that only scheduled and published posts are visible there?
2. Should the Udgiv popup open for both the idea list and the selected-date list, or only for scheduled posts?
3. Should the `Gå til opslag →` badge appear as soon as the post draft exists, or only after a caption is present and the post is considered complete?
4. Do you want a direct live-site verification after the Vercel deployment finishes, or is the branch push sufficient for now?

## Notes
The live weekly-plan page was reachable and showed the expected row states and badges before the popup fix. The deployment was pushed to `vercel-test`, not just `main`, so it should follow the project's active Vercel branch setup.
