# UI/UX Improvements Plan

## 1. Visual Consistency
*   **Card Components:** Ensure `UserCard.js` (Dashboard) and `SearchResultCard.js` (Search/Matches) are visually identical and functionally equivalent.
    *   *Action:* Create a shared `ProfileCard` component to replace both, ensuring consistent button styling, icons, and behavior.
*   **Button Styling:** Standardize button variants (primary, secondary, danger, outline) across the app using CSS variables from `themes.css`.
    *   *Current Issue:* Some buttons use hardcoded styles or Bootstrap classes mixed with custom CSS.
*   **Icons:** Use a consistent icon set (e.g., Lucide React or FontAwesome). Currently, there's a mix (e.g., `⭐` vs `☆` vs SVG icons).

## 2. Feedback & Interaction
*   **Toast Notifications:** Replace all browser-native `alert()` and `confirm()` calls with the custom `Toast` component.
    *   *Target Areas:* Admin actions (delete), Form submissions (save profile), Dynamic Scheduler (run jobs).
*   **Loading States:** Implement skeleton loaders for Profile cards and Tables instead of simple text "Loading...".
*   **Error Handling:** Display user-friendly error messages in the UI instead of generic "Something went wrong" or console logs.

## 3. Mobile Responsiveness (Android Focus)
*   **Navigation:**
    *   **Sidebar:** On mobile, the sidebar should be an overlay that can be swiped away or closed with a backdrop click.
    *   **TopBar:** Ensure the hamburger menu is always accessible and touch targets are large (>44px).
*   **Tables:** Admin tables (User Management) break on small screens.
    *   *Solution:* Use a card-based layout for mobile rows or allow horizontal scrolling with sticky columns.
*   **Forms:**
    *   **Inputs:** Ensure input fields have `font-size: 16px` to prevent iOS zoom (and general readability).
    *   **Keyboards:** Use correct `inputmode` (e.g., `numeric`, `email`, `tel`) for mobile keyboards.

## 4. Theme System
*   **Dark Mode:** Verify all components support the `dark` theme. Check for hardcoded white backgrounds or black text.
*   **Contrast:** Ensure text contrast ratios meet WCAG AA standards, especially in the `light-pink` and `light-gray` themes.

## 5. Accessibility (a11y)
*   **ARIA Labels:** Add `aria-label` to icon-only buttons (like Favorites/Shortlist).
*   **Focus Management:** Ensure modals trap focus and focus is restored when closed.
*   **Semantic HTML:** Use `<button>` instead of `div` or `span` for interactive elements.
