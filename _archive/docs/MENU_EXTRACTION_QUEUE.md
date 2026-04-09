# Menu Extraction Queue System

## Problem Solved

**Original Issue**: When detecting 7+ menus simultaneously, the system would:
- Create 7 concurrent extraction jobs
- Run 7 concurrent operations updates → 409 database conflicts
- Overwhelm polling system with multiple intervals
- Create infinite loop of re-extractions

**Root Cause**: Concurrent extractions competing for shared resources (database, polling, operations table).

## Solution: Sequential Processing Queue

Instead of extracting all menus simultaneously, we now process them **one at a time** using a queue system.

## How It Works

### 1. Queue-Based Architecture

```typescript
// When user clicks "Extract" on multiple menus:
User clicks → Add to queue → Process sequentially

// State management:
const [extractionQueue, setExtractionQueue] = useState<Array<{cardId, sourceUrl}>>([])
const [isProcessingQueue, setIsProcessingQueue] = useState(false)
```

### 2. Queue Processor (Automatic)

```typescript
useEffect(() => {
  if (isProcessingQueue || extractionQueue.length === 0) return
  
  const next = extractionQueue[0]
  await extractMenuInternal(next.cardId, next.sourceUrl)
  
  setExtractionQueue(prev => prev.slice(1)) // Remove completed item
}, [extractionQueue, isProcessingQueue])
```

**Key Points:**
- Processes ONE menu at a time
- Automatically moves to next item when current completes
- No concurrent database operations
- No polling conflicts

### 3. User Experience

**Visual Feedback:**

1. **Progress Banner** (top of page):
   ```
   🔄 Udtrækker menu... 6 i kø
   Menuer behandles én ad gangen for at sikre kvalitet.
   ```

2. **Queue Position Badge** (on each card):
   ```
   ⏸️ Menukort    I kø #3
   ```

3. **Status Icons**:
   - 📋 = Pending (not yet queued)
   - ⏸️ = In queue (waiting)
   - ⏳ = Extracting (currently processing)
   - ✅ = Extracted (completed)
   - ❌ = Error (failed)

### 4. Flow Diagram

```
User clicks "Find menukort"
   ↓
7 menus detected
   ↓
User clicks "Hent" on all 7
   ↓
All 7 added to queue: [menu1, menu2, menu3, menu4, menu5, menu6, menu7]
   ↓
Queue processor starts:
   
   Processing menu1... [menu2, menu3, menu4, menu5, menu6, menu7] waiting
   ↓ (90 seconds)
   ✅ menu1 complete
   
   Processing menu2... [menu3, menu4, menu5, menu6, menu7] waiting
   ↓ (90 seconds)
   ✅ menu2 complete
   
   Processing menu3... [menu4, menu5, menu6, menu7] waiting
   ↓ (90 seconds)
   ✅ menu3 complete
   
   ... continues until queue empty
   
   ✅ All menus extracted!
   → Operations update runs ONCE
```

## Benefits

### ✅ No More Conflicts
- **Before**: 7 concurrent operations updates → 409 conflicts
- **After**: 1 operations update after all complete

### ✅ Reliable Polling
- **Before**: 7 polling intervals running simultaneously
- **After**: 1 polling interval at a time

### ✅ Better Resource Usage
- **Before**: 7 API calls to OpenAI simultaneously
- **After**: 1 API call at a time (more manageable)

### ✅ Clear Progress
- **Before**: No indication of what's happening
- **After**: User sees queue position and progress

### ✅ No Infinite Loops
- **Before**: Failed extractions triggered re-extractions
- **After**: Queue processes once, no re-triggering

## Code Changes

### File: `MenuPage.tsx`

**1. Added Queue State** (lines 45-47):
```typescript
const [extractionQueue, setExtractionQueue] = useState<Array<{cardId: string; sourceUrl: string}>>([])
const [isProcessingQueue, setIsProcessingQueue] = useState(false)
```

**2. Added Queue Processor** (lines 68-88):
```typescript
useEffect(() => {
  const processQueue = async () => {
    if (isProcessingQueue || extractionQueue.length === 0) return
    
    setIsProcessingQueue(true)
    const next = extractionQueue[0]
    
    try {
      await extractMenuInternal(next.cardId, next.sourceUrl)
    } finally {
      setExtractionQueue(prev => prev.slice(1))
      setIsProcessingQueue(false)
    }
  }
  processQueue()
}, [extractionQueue, isProcessingQueue])
```

**3. Split Extraction Function** (lines 309-334):
```typescript
// Public function: Adds to queue
const handleExtractMenu = async (cardId: string, sourceUrl: string) => {
  if (extractionQueue.some(item => item.cardId === cardId)) return
  setExtractionQueue(prev => [...prev, { cardId, sourceUrl }])
}

// Private function: Does actual extraction (called by queue processor)
const extractMenuInternal = async (cardId: string, sourceUrl: string) => {
  // ... actual extraction logic
}
```

**4. Updated UI Feedback** (lines 863-876):
```typescript
{(activeExtractions.size > 0 || extractionQueue.length > 0) && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
    {activeExtractions.size > 0 && `Udtrækker menu... `}
    {extractionQueue.length > 0 && `${extractionQueue.length} i kø`}
  </div>
)}
```

**5. Queue Position Badges** (lines 923-930):
```typescript
{extractionQueue.some(q => q.cardId === card.id) && (
  <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
    I kø #{extractionQueue.findIndex(q => q.cardId === card.id) + 1}
  </span>
)}
```

## Performance

### Time Comparison

**Concurrent (Before)**:
- 7 menus × 90 seconds = ~90 seconds total (if all succeed)
- High risk of failures due to conflicts
- May need to retry failed menus individually

**Sequential (After)**:
- 7 menus × 90 seconds = ~630 seconds (10.5 minutes) total
- Very low risk of failures
- Predictable completion time

**Trade-off**: Slower total time, but **much more reliable** and no risk of infinite loops or database conflicts.

### Why This Is Better

1. **Reliability > Speed**: 10 minutes with 100% success is better than 90 seconds with 50% failure rate requiring retries
2. **User Visibility**: User knows exactly what's happening and can leave page open
3. **Resource Management**: Doesn't overwhelm OpenAI API or database
4. **Predictable Costs**: No duplicate API calls from retries

## Advanced: Optional Parallel Processing

If you want to process 2-3 menus concurrently (middle ground), modify the queue processor:

```typescript
const MAX_CONCURRENT = 2 // Process up to 2 at once

useEffect(() => {
  const processQueue = async () => {
    const available = MAX_CONCURRENT - activeExtractions.size
    if (available <= 0 || extractionQueue.length === 0) return
    
    const batch = extractionQueue.slice(0, available)
    
    for (const item of batch) {
      extractMenuInternal(item.cardId, item.sourceUrl)
      setExtractionQueue(prev => prev.filter(q => q.cardId !== item.cardId))
    }
  }
  processQueue()
}, [extractionQueue, activeExtractions])
```

**Recommendation**: Start with sequential (MAX_CONCURRENT = 1). Only increase if you verify it works reliably.

## Testing

### Test Scenario 1: Multiple Menus
1. Go to Menu page
2. Click "Find menukort"
3. System finds 7 menus
4. Click "Hent" on all 7 rapidly
5. **Expected**: All 7 added to queue, processed one at a time
6. **Watch for**: Queue position badges, progress banner

### Test Scenario 2: Error Handling
1. Add menu with invalid URL
2. Extract it (will fail)
3. **Expected**: Queue moves to next item, doesn't get stuck

### Test Scenario 3: Page Refresh
1. Start extracting 5 menus
2. After 2 complete, refresh page
3. **Expected**: 2 menus marked extracted, 3 still pending
4. Click "Hent" again on pending menus

## Monitoring

Add these console logs to track queue behavior:

```typescript
// In queue processor:
console.log(`📊 Queue status: ${extractionQueue.length} waiting, ${activeExtractions.size} active`)

// In handleExtractMenu:
console.log(`➕ Added to queue: ${sourceUrl} (position #${extractionQueue.length + 1})`)

// When extraction completes:
console.log(`✅ Completed: ${sourceUrl}, ${extractionQueue.length} remaining`)
```

## Troubleshooting

**Problem**: Queue seems stuck
- **Check**: Browser console for errors
- **Action**: Refresh page, queue will reset

**Problem**: Want to cancel queue
- **Action**: Refresh page (queue is in-memory only)

**Problem**: Want to prioritize one menu
- **Solution**: Refresh page, extract only that menu

**Problem**: Too slow with many menus
- **Solution**: Consider increasing MAX_CONCURRENT to 2 (see Advanced section)

## Future Enhancements

1. **Persistent Queue**: Store queue in database/localStorage to survive page refresh
2. **Cancel/Reorder**: Add UI to remove items from queue or change order
3. **Priority System**: Let users mark certain menus as high-priority
4. **Background Processing**: Extract in service worker so user can close page
5. **Batch Actions**: "Extract All" button that queues everything automatically

