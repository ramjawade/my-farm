## MODIFIED Requirements

### Requirement: Names in the farmer's language
Each predefined crop SHALL show its name in the app's current language (Marathi, Hindi or English). A custom crop SHALL show the name the farmer typed. Search SHALL match the name in the current language, the English name, and the other names farmers commonly use for the crop (such as "kanda" or "pyaz" for Onion, or "til" for Sesame, written in English letters or in Marathi or Hindi), ignoring case and extra spaces. Typing one of those other names exactly SHALL NOT offer to add a new crop.

#### Scenario: Marathi names
- **WHEN** the app language is Marathi
- **THEN** Onion shows as कांदा and Pomegranate as डाळिंब

#### Scenario: Search in either language
- **WHEN** the language is Marathi and the farmer searches "onion" or "कांदा"
- **THEN** Onion is found in both cases

#### Scenario: Search by another common name
- **WHEN** the language is English and the farmer searches "kanda" or "til"
- **THEN** Onion is found for "kanda" and Sesame for "til", and "Add new crop" is not offered
