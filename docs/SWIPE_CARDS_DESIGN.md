# Swipe Cards Feature - Design & Strategy Document

**Branch:** `feature/swipe-cards`  
**Created:** January 18, 2026  
**Status:** Planning

---

## Overview

Add swipe gesture capabilities to SearchResultCard on the Search page, enabling users to quickly interact with profiles using intuitive swipe actions similar to popular dating apps.

---

## Swipe Actions Mapping

| Gesture | Direction | Action | Visual Feedback | Icon |
|---------|-----------|--------|-----------------|------|
| Swipe Right | → | **Favorite** | Green overlay + ⭐ | Star |
| Swipe Left | ← | **Exclude/Pass** | Red overlay + 🚫 | Block |
| Swipe Up | ↑ | **Shortlist** | Purple overlay + 📋 | Clipboard |

---

## Implementation Phases

### Phase 1: Core Swipe Gesture Infrastructure
**Goal:** Build the foundational swipe detection and card movement system

**Deliverables:**
1. **SwipeableCard Component** - Wrapper component with touch/mouse gesture detection
2. **Gesture Detection Hook** - `useSwipeGesture` custom hook
3. **Card Transform Logic** - Real-time card position/rotation based on drag
4. **Threshold Detection** - Determine when swipe is "committed"

**Technical Details:**
- Use touch events (`touchstart`, `touchmove`, `touchend`) for mobile
- Use mouse events (`mousedown`, `mousemove`, `mouseup`) for desktop
- Track delta X/Y from start position
- Apply CSS transforms for smooth movement
- Rotation: slight tilt based on horizontal movement (max ±15°)
- Thresholds: 100px horizontal = commit, 80px vertical = commit

**Files to Create:**
- `/frontend/src/components/SwipeableCard.js`
- `/frontend/src/components/SwipeableCard.css`
- `/frontend/src/hooks/useSwipeGesture.js`

---

### Phase 2: Swipe Actions Integration
**Goal:** Connect swipe gestures to existing action handlers

**Deliverables:**
1. **Action Callbacks** - Wire swipe completion to favorite/exclude/shortlist handlers
2. **Overlay Indicators** - Show action icon during swipe
3. **Card Stack Mode** - Optional single-card view with stack behind
4. **Undo Capability** - Toast with undo option after swipe action

**Technical Details:**
- Reuse existing handlers: `handleFavorite`, `handleExclude`, `handleShortlist`
- Overlay opacity scales with swipe distance (0% at start, 100% at threshold)
- Color coding: Green (right), Red (left), Purple (up)
- After action, card animates off-screen in swipe direction
- Next card slides into view (if in stack mode)

**Files to Modify:**
- `/frontend/src/components/SearchPage.js` - Add swipe mode toggle
- `/frontend/src/components/SearchResultCard.js` - Wrap with SwipeableCard

---

### Phase 3: Animations, Haptics & Polish
**Goal:** Create a delightful, polished user experience

**Deliverables:**
1. **Spring Animations** - Smooth return-to-center when swipe cancelled
2. **Exit Animations** - Card flies off screen with physics
3. **Haptic Feedback** - Vibration on mobile when threshold crossed
4. **Sound Effects** - Optional subtle sounds (can be disabled)
5. **Accessibility** - Keyboard alternatives, screen reader support
6. **Settings** - Enable/disable swipe mode in preferences

**Technical Details:**
- Use CSS transitions with `cubic-bezier` for spring effect
- Haptic: `navigator.vibrate(50)` on threshold cross
- Keyboard: Arrow keys for swipe actions in focus mode
- ARIA labels for screen readers
- Preference stored in localStorage + user preferences API

**Files to Modify:**
- `/frontend/src/components/UnifiedPreferences.js` - Add swipe settings
- `/frontend/src/themes/themes.css` - Animation keyframes

---

## Component Architecture

```
SearchPage.js
├── SwipeCardContainer (new)
│   ├── SwipeableCard (wrapper)
│   │   ├── SwipeOverlay (action indicator)
│   │   └── SearchResultCard (existing)
│   └── CardStack (optional background cards)
└── SwipeModeToggle (grid/swipe view switch)
```

---

## State Management

```javascript
// Swipe state for each card
const [swipeState, setSwipeState] = useState({
  cardId: null,
  deltaX: 0,
  deltaY: 0,
  isDragging: false,
  direction: null, // 'left' | 'right' | 'up' | null
  committed: false
});

// Swipe mode preference
const [swipeMode, setSwipeMode] = useState(false); // grid vs swipe view
```

---

## CSS Transform Formula

```javascript
// During drag
const rotation = (deltaX / 20) * (deltaY > 0 ? 1 : -1); // Max ±15°
const scale = 1 - Math.abs(deltaX) / 1000; // Slight shrink
const opacity = 1 - Math.abs(deltaX) / 500; // Fade slightly

const transform = `
  translateX(${deltaX}px) 
  translateY(${deltaY}px) 
  rotate(${rotation}deg) 
  scale(${scale})
`;
```

---

## Swipe Thresholds

| Direction | Threshold | Action Triggered |
|-----------|-----------|------------------|
| Right (→) | deltaX > 100px | Favorite |
| Left (←) | deltaX < -100px | Exclude |
| Up (↑) | deltaY < -80px | Shortlist |
| Down (↓) | deltaY > 80px | Cancel/Return |

---

## Visual Overlays

### Right Swipe (Favorite)
```css
.swipe-overlay-right {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.9));
  /* Green gradient with ⭐ icon */
}
```

### Left Swipe (Exclude)
```css
.swipe-overlay-left {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.9));
  /* Red gradient with 🚫 icon */
}
```

### Up Swipe (Shortlist)
```css
.swipe-overlay-up {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(124, 58, 237, 0.9));
  /* Purple gradient with 📋 icon */
}
```

---

## Mobile Considerations

1. **Touch Sensitivity** - Lower thresholds on mobile (80px horizontal, 60px vertical)
2. **Prevent Scroll** - Disable page scroll while swiping card
3. **Velocity Detection** - Fast swipes commit even if below threshold
4. **Multi-touch** - Ignore if more than one finger
5. **Edge Swipes** - Avoid conflict with browser back gesture

---

## Accessibility

1. **Keyboard Controls:**
   - `→` Arrow: Favorite
   - `←` Arrow: Exclude  
   - `↑` Arrow: Shortlist
   - `Enter`: View profile
   - `Escape`: Cancel swipe

2. **Screen Reader:**
   - Announce action on swipe completion
   - "Added to favorites", "Excluded", "Added to shortlist"

3. **Reduced Motion:**
   - Respect `prefers-reduced-motion` media query
   - Instant transitions instead of animations

---

## Testing Checklist

### Phase 1
- [ ] Card follows finger/mouse during drag
- [ ] Card rotates slightly based on horizontal movement
- [ ] Card returns to center when released below threshold
- [ ] Works on touch devices (iOS Safari, Android Chrome)
- [ ] Works with mouse on desktop

### Phase 2
- [ ] Right swipe triggers favorite action
- [ ] Left swipe triggers exclude action
- [ ] Up swipe triggers shortlist action
- [ ] Overlay appears with correct color/icon
- [ ] Card animates off-screen after action
- [ ] Undo toast appears with working undo

### Phase 3
- [ ] Spring animation feels natural
- [ ] Haptic feedback works on mobile
- [ ] Keyboard controls work
- [ ] Screen reader announces actions
- [ ] Reduced motion preference respected
- [ ] Swipe mode toggle in preferences

---

## Performance Considerations

1. **Use `transform` only** - Avoid layout-triggering properties
2. **`will-change: transform`** - Hint to browser for GPU acceleration
3. **Debounce state updates** - Don't update React state on every pixel
4. **Passive event listeners** - For touch events
5. **Virtualization** - Only render visible cards in stack

---

## Rollout Strategy

1. **Phase 1** - Internal testing, dev environment only
2. **Phase 2** - Beta users opt-in via preferences
3. **Phase 3** - Gradual rollout to all users
4. **Default Off** - Users must enable swipe mode initially
5. **Feedback Collection** - Track usage metrics

---

## Dependencies

- No external libraries required (vanilla JS/React)
- Optional: `react-spring` for advanced animations (Phase 3)
- Optional: `use-gesture` library if vanilla implementation is complex

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 2-3 hours | Core swipe infrastructure |
| Phase 2 | 2-3 hours | Action integration + overlays |
| Phase 3 | 2-3 hours | Polish + accessibility |

**Total:** 6-9 hours

---

## Success Metrics

1. **Engagement** - % of users who try swipe mode
2. **Retention** - % who continue using after first try
3. **Speed** - Actions per minute vs button clicks
4. **Satisfaction** - User feedback/ratings

---

## Approval

- [ ] Design reviewed
- [ ] Strategy approved
- [ ] Ready for Phase 1 implementation

---

*Document created by Cascade AI - January 18, 2026*
