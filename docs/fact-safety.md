# Fact Safety Rules

## Publishing Rule

A post cannot enter the publishing list until it has at least one allow-listed NTU official source and an operator marks those sources as verified. The API enforces this rule for both `approved` and `published` status updates.

## Generation Rule

The model receives only the official source pack in `server/src/generation/officialSources.ts`. It must use only the claims in that pack and return the source IDs it used. If it omits valid source IDs, the platform falls back to a cautious local draft.

## Automatic Blocks

The fact safety guard blocks a draft if its title or body includes unsupported:

- Campus systems or locations such as `STARS`, `BDE`, `The Hive`, `North Spine`, `LWN Library`, or `CareerAxis`.
- Dates, times, or year-specific details.
- Registration, deadline, opening-hour, course-rule, quota, or fee details.

An operator cannot override a blocked draft. Remove the unsupported detail or add it through a future reviewed official source, then regenerate and verify again.

## Current Official Sources

- NTU Student Life: `https://www.ntu.edu.sg/life-at-ntu/student-life`
- NTU International Students: `https://www.ntu.edu.sg/life-at-ntu/student-life/student-activities-and-engagement/inclusion-and-integration/int-students`
- NTU Academic Calendars: `https://www.ntu.edu.sg/admissions/matriculation/academic-calendars`
- NTU Clubs & Societies: `https://www.ntu.edu.sg/life-at-ntu/student-life/student-activities-and-engagement`
- NTU Library Services: `https://www.ntu.edu.sg/education/libraries/services`
- NTU Library Spaces: `https://www.ntu.edu.sg/education/libraries/about-ntu-library`
- NTU Accommodation: `https://www.ntu.edu.sg/life-at-ntu/accommodation`
- NTU Undergraduate Housing Application: `https://www.ntu.edu.sg/life-at-ntu/accommodation/undergraduate-housing/application`
- NTU Career Services: `https://www.ntu.edu.sg/life-at-ntu/student-life/student-services/onestop/bond-management/seeking-employment`
- NTU Student Wellbeing Services: `https://www.ntu.edu.sg/life-at-ntu/student-life/campus-life-and-wellbeing/ntu-wellbeing/student-wellbeing-services`
- NTU Residential Education: `https://www.ntu.edu.sg/life-at-ntu/student-life/campus-life-and-wellbeing/residential-education`
- NBS Undergraduate Life: `https://www.ntu.edu.sg/business/admissions/ugadmission/undergraduate-student-life`
- NBS Undergraduate Programmes: `https://www.ntu.edu.sg/business/admissions/ugadmission`

Treat each source as time-sensitive. Before publishing a factual post, open the attached source links and verify that the specific wording remains current.
