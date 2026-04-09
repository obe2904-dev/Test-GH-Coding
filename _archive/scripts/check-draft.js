// Run this in browser console to see what's in localStorage
const draft = localStorage.getItem('post2grow_draft_recovery');
if (draft) {
  const parsed = JSON.parse(draft);
  console.log('Draft photoContent:', parsed.photoContent);
  if (parsed.photoContent?.uploadedMedia?.[0]) {
    const media = parsed.photoContent.uploadedMedia[0];
    console.log('Media url:', media.url);
    console.log('Media originalUrl:', media.originalUrl);
    console.log('Media file:', media.file);
  }
}
