-- TEMPORARY WORKAROUND: Run brand profile generator TWICE
-- First run: Generates segments and saves them
-- Second run: Uses those segments in persona

-- Run 1: Generate and save strategic segments
SELECT 'Run 1: Generating strategic segments...' as status;

-- (Execute brand-profile-generator-v5 via API or UI)

-- Wait 60 seconds...

-- Run 2: Regenerate using those segments  
SELECT 'Run 2: Regenerating persona with strategic segments...' as status;

-- (Execute brand-profile-generator-v5 again with forceRegenerate=true)

-- This is inefficient but works until we refactor the code flow
