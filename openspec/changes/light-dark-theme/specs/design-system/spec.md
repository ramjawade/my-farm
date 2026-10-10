# Spec Delta

## MODIFIED Requirements

### Requirement: Design tokens drive colour, spacing, radius and elevation
The app SHALL define its colours, spacing steps, corner radii, shadows, layers and motion duration as named design tokens whose light values match the prototype design system and whose dark values match the prototype's dark palette. Shared styles and shared components SHALL take these values from the tokens rather than from literal colour codes, so that both palettes work on every screen.

#### Scenario: Page background and text use the token palette
- **WHEN** any signed-in screen loads in the light appearance
- **THEN** the page background is the prototype's light background (#eef1ec), body text is the prototype foreground (#18231a), and cards use the surface colour (#ffffff) with the line colour (#dde3d8) as their border

#### Scenario: Brand colour is the prototype leaf green
- **WHEN** a primary button, active chip, active segment or link is shown
- **THEN** its accent colour is the prototype leaf green (#2f7a3f) in the light appearance, not the previous Material green (#2e7d32)

#### Scenario: Dark appearance uses the dark palette
- **WHEN** the app's theme resolves to dark
- **THEN** the page background is the prototype's dark background (#0f1611), body text is the dark foreground (#e8efe8), cards use the dark surface (#17211a) with the dark line colour (#2a3a2d), and accents use the dark palette's leaf green (#5fbf72)
