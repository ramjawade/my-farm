# Spec Delta

## Purpose

The design system is the shared visual language of MyFarm: colour, type, spacing and the look and states of the common UI components. It keeps every screen consistent with the approved prototype and readable in Marathi, Hindi and English.

## ADDED Requirements

### Requirement: Design tokens drive colour, spacing, radius and elevation
The app SHALL define its colours, spacing steps, corner radii, shadows, layers and motion duration as named design tokens whose light values match the prototype design system. Shared styles and shared components SHALL take these values from the tokens rather than from literal colour codes.

#### Scenario: Page background and text use the token palette
- **WHEN** any signed-in screen loads in the default (light) appearance
- **THEN** the page background is the prototype's light background (#eef1ec), body text is the prototype foreground (#18231a), and cards use the surface colour (#ffffff) with the line colour (#dde3d8) as their border

#### Scenario: Brand colour is the prototype leaf green
- **WHEN** a primary button, active chip, active segment or link is shown
- **THEN** its accent colour is the prototype leaf green (#2f7a3f), not the previous Material green (#2e7d32)

#### Scenario: Dark values exist but are inactive
- **WHEN** the app loads on a device set to dark mode
- **THEN** the app still renders in the light palette (switching to dark is out of scope for this capability version)

### Requirement: No colour is hard-coded outside the token layer
Every colour the app renders SHALL come from a design token, including component styles, inline template styles, colours chosen in code (activity types, crop icons, weather severity, chart series, map drawing layers) and shadows or overlays. Colour literals (hex, `rgb()`/`rgba()`, `hsl()`, and named colours other than `transparent`, `currentColor` and `inherit`) SHALL appear only in the token definitions and Bootstrap build configuration. An automated check SHALL fail the lint step when a colour literal appears anywhere else.

#### Scenario: Data colours follow the tokens
- **WHEN** the token value for an activity type, temperature band, chart series or map drawing colour changes
- **THEN** every place that shows it (badges, icons, charts, map polygons) changes with it, without any other code edits

#### Scenario: A literal colour is added
- **WHEN** a developer adds a colour such as `#3182ce` or `rgba(0,0,0,.1)` to a component style, template or TypeScript file
- **THEN** `npm run lint` fails and names the file and line

#### Scenario: Issue references are not colours
- **WHEN** a comment contains an issue reference such as `#242`
- **THEN** the colour check does not report it

### Requirement: Typography follows the prototype with Devanagari support
Headings, page titles and key numbers SHALL use the display typeface (Bricolage Grotesque). Body text, labels and controls SHALL use the body typeface (Figtree). Both SHALL fall back to a Devanagari typeface (Mukta) so Marathi and Hindi text renders in a matching style. The base body size SHALL be 14 px. The previous typeface (Outfit) SHALL NOT be used anywhere in the app.

#### Scenario: English screen
- **WHEN** a screen is shown in English
- **THEN** headings render in Bricolage Grotesque, body text in Figtree, and no element uses Outfit

#### Scenario: Marathi text
- **WHEN** a screen shows Marathi text such as "पीक जोडा"
- **THEN** the Devanagari glyphs render in Mukta rather than a system fallback font

#### Scenario: Fonts fail to load
- **WHEN** the web fonts cannot be downloaded (offline or blocked)
- **THEN** text still renders using the system sans-serif fallback and remains readable

### Requirement: Buttons follow the design system
Buttons SHALL have a default (surface with a line border), primary (leaf fill), warning (sun fill), danger (rose fill) and link variant. They SHALL have 8 px corners and semibold labels. Buttons SHALL NOT use gradient fills or lift on hover. Every variant SHALL show a visible keyboard focus ring.

#### Scenario: Primary action
- **WHEN** a primary button such as "Save" is shown
- **THEN** it has a solid leaf-green fill with white text, 8 px corners and no gradient

#### Scenario: Keyboard focus
- **WHEN** a user tabs onto any button
- **THEN** a visible focus ring appears around it

### Requirement: Cards are flat surfaces
Cards SHALL be flat: a surface fill, a 1 px line border, 12 px corners and 16 px padding. They SHALL NOT use translucent or blurred (glass) backgrounds or move on hover. Card titles SHALL use the display typeface.

#### Scenario: Hovering a clickable card
- **WHEN** a user hovers a clickable card on desktop
- **THEN** the card does not move or lift, and only its border or background tint indicates it is interactive

### Requirement: Status is shown with soft pill badges in five tones
Status badges SHALL be small pills with a soft background and ink-coloured text in one of five tones: leaf (success), sun (warning), sky (info), rose (danger) and muted (neutral).

#### Scenario: Neutral badge
- **WHEN** a neutral status such as "Fallow" or "Draft" is shown
- **THEN** it renders as a muted pill with the surface2 background, muted text and a line border

#### Scenario: Warning badge
- **WHEN** a warning status such as "Overdue" is shown
- **THEN** it renders as a pill with the sun-soft background and sun-coloured text

### Requirement: Chips and segmented controls show their selected state
Filter chips and segmented controls SHALL visibly distinguish the selected option and SHALL expose the selection to assistive technology. A selected chip uses the leaf-soft fill with a leaf border. A selected segment uses the leaf fill with white text.

#### Scenario: Selecting a chip
- **WHEN** a user selects a filter chip
- **THEN** the chip shows the leaf-soft fill and leaf border, and it is announced as pressed or selected

### Requirement: Form fields share one layout and error style
Form fields SHALL show a small semibold muted label above the control. Controls SHALL have 8 px corners and a line border with a leaf focus ring. Optional help text SHALL appear below in muted text, and an error message SHALL appear in rose below the control and be associated with it for screen readers.

#### Scenario: Invalid field
- **WHEN** a required field is submitted empty
- **THEN** the control shows a rose border, a rose error message appears below it, and the message is announced by screen readers

### Requirement: Toasts and dialogs follow the design system
Toast messages SHALL appear as small rounded surfaces near the bottom of the screen, tinted by kind (success, warning, error, info). Confirmation dialogs SHALL appear centred on wider screens and as a bottom sheet anchored to the bottom edge on phone-width screens. Both have a dimmed backdrop, and focus is trapped while they are open.

#### Scenario: Confirm on phone
- **WHEN** a destructive action asks for confirmation on a screen narrower than 576 px
- **THEN** the confirmation slides up as a bottom sheet with rounded top corners over a dimmed backdrop

#### Scenario: Confirm on desktop
- **WHEN** the same confirmation appears on a wide screen
- **THEN** it appears as a centred dialog with 14 px corners

### Requirement: Empty states use one shared pattern
Lists and sections with no content SHALL use one empty-state pattern: a round leaf-soft icon, a short display-font title, one line of muted help text, and an optional primary action.

#### Scenario: Empty list
- **WHEN** a list has no items, such as no activities yet
- **THEN** it shows the empty-state block with an icon, a title, help text and, where relevant, an action button
