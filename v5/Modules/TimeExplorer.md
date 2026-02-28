# Isometry v5 Time Explorer Specification

## Overview

Time Explorer provides temporal navigation controls including histogram, slider, zoom, and replay for time-based filtering.

## Time Fields

| Field | Use Case |
|-------|----------|
| `created_at` | When card was created |
| `modified_at` | Last modification |
| `due_at` | Task deadlines |
| `event_start` | Calendar event start |
| `event_end` | Calendar event end |
| `completed_at` | Task completion |

## UI Components

### Timeline Histogram
- Bar chart showing card density over time
- Brush selection for range filtering
- Zoom in/out for granularity

### Range Slider
- Dual-handle for start/end date
- Snap to day/week/month/year
- Quick presets (Today, This Week, Last 30 Days)

### Playback Controls
- Animate through time periods
- Speed control
- Step forward/back

### Granularity Selector
- Hour / Day / Week / Month / Quarter / Year
- Auto-adjust based on range

## Interaction Patterns

1. **Brush histogram** → Set date range filter
2. **Click bar** → Zoom to that period
3. **Play button** → Animate card appearance over time
4. **Scroll wheel on histogram** → Zoom in/out

## SQL Patterns

```sql
-- Histogram buckets
SELECT strftime('%Y-%m', created_at) as month, COUNT(*)
FROM cards WHERE deleted_at IS NULL
GROUP BY month ORDER BY month;

-- Range filter
WHERE created_at BETWEEN ? AND ?
```

## Key Principles

1. **Time is a first-class LATCH dimension**
2. **Multiple time fields** (created, modified, due, event)
3. **Scrubbing reveals temporal patterns**
