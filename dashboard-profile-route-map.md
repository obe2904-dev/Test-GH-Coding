# `/dashboard/profile` Route Map

This is the active route behind `https://social-media-saas-psi.vercel.app/dashboard/profile`.

## Route entry

- [src/App.tsx](src/App.tsx#L203) maps `path="profile"` to `BusinessProfilePage` inside the dashboard router.
- [src/App.tsx](src/App.tsx#L56) and [src/App.tsx](src/App.tsx#L57) lazy-load `BusinessProfilePage`.

## Active page code

- [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1) is the page rendered at `/dashboard/profile`.
- It handles business profile editing, website scraping, extraction, and unified website analysis.

## Direct edge functions used by the page

- [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1003) calls `start-scrape-job` for the two-step scrape flow.
- [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1068) calls `extract-from-scrape` for the AI extraction step.
- [src/pages/dashboard/BusinessProfilePage.tsx](src/pages/dashboard/BusinessProfilePage.tsx#L1135) calls `analyze-and-distribute-website` for the unified scrape + AI analysis + persistence flow.

## Related hooks and helpers

- [src/pages/dashboard/businessProfile/hooks/useWebsiteAnalysis.ts](src/pages/dashboard/businessProfile/hooks/useWebsiteAnalysis.ts#L1) is currently disabled in the repo and is not part of the active `/dashboard/profile` route.
- [src/pages/dashboard/businessProfile/services/profileService.ts](src/pages/dashboard/businessProfile/services/profileService.ts#L1) persists profile data and also writes menu/source data, but it is a service layer rather than the route entry point.

## Nearby but different route

- [src/App.tsx](src/App.tsx#L210) maps `path="brand"` to `BrandProfilePage` from `BrandProfilePageV5`.
- That page uses a different edge-function chain: `menu-overview-summary` first, then `brand-profile-generator-v5`.

## UI entry points that route here

- [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx#L253)
- [src/components/layout/TopBar.tsx](src/components/layout/TopBar.tsx#L280)
- [src/pages/dashboard/DashboardOverviewPage.tsx](src/pages/dashboard/DashboardOverviewPage.tsx#L326)
- [src/components/post-creation/GenerateStep.tsx](src/components/post-creation/GenerateStep.tsx#L1146)
- [src/components/post-creation/PublishStep.tsx](src/components/post-creation/PublishStep.tsx#L1467)
- [src/components/post-creation/BusinessSetupModal.tsx](src/components/post-creation/BusinessSetupModal.tsx#L43)

## Short summary

`/dashboard/profile` is the business profile page, not the brand-v5 page. Its active edge-function surface is the scrape/extract/analyze trio:

1. `start-scrape-job`
2. `extract-from-scrape`
3. `analyze-and-distribute-website`

The separate `/dashboard/brand` route is where the V5 brand-profile generator lives.