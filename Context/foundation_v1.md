# LouNgak AI — Product Foundation & Handover

> **Document purpose:** This is the product and project handover for a fresh Claude session. Read it before proposing or making implementation changes. It captures the agreed vision, hackathon context, existing project baseline, product requirements, architecture direction, scope boundaries and open decisions.
>
> **Document status:** Product foundation v1.0 — 31 October 2026  
> **Project:** LouNgak AI  
> **Repository:** https://github.com/brajalairen/LouNgak-AI  
> **Initial geography:** Manipur, India  
> **Primary application:** Agricultural and environmental intelligence, with early warning and field verification at its core.

---

## 0. Instructions for the new Claude session

You are joining an ongoing product-design and engineering effort. The user may provide this document together with the existing repository. Treat this document as the **agreed product direction**, but treat the repository as the source of truth for what is actually implemented.

### First task: inspect, do not immediately rewrite

1. Read this entire document.
2. Read the repository `README.md`, `docs/architecture.md`, relevant module READMEs, configuration files and tests.
3. Inspect the actual source code and current Git state. Do not assume the README describes the latest code perfectly.
4. Produce an implementation audit with four categories:
   - **Implemented and verified:** Confirmed in code and/or tests.
   - **Partially implemented:** Some supporting code exists, but the full product capability is incomplete.
   - **Proposed / agreed:** Required by this foundation but not yet implemented.
   - **Future / exploratory:** Not part of the immediate MVP.
5. Identify reusable components, obsolete assumptions, architectural constraints, risks and gaps.
6. Propose a phased implementation plan with dependencies, acceptance criteria and a realistic MVP cut.
7. **Do not modify files until the user has reviewed the audit and implementation plan**, unless the user explicitly asks you to proceed immediately.

### Freedom to redesign

The previous LouNgak AI repository is a **starting point, source of reusable technology and proof of concept—not a strict constraint**. This is a new, more ambitious product direction built on lessons and useful components from the earlier work.

- You may redesign the UI/UX, navigation, workflows, architecture, data models and technology choices where there is a clear benefit.
- You may replace or remove old features or components when they do not serve the new product, but explain the trade-off and migration implications first.
- Do not preserve code merely because it already exists or because time was invested in it.
- Conversely, do not rewrite working components without a reason. Reuse is encouraged when it improves reliability and saves time.
- Keep the original repository history and working state safe. Inspect branches and remotes before any destructive action. Use a development branch and small, reviewable commits.
- Never overwrite the original project history, delete data, rotate credentials, or change deployment configuration without the user's explicit approval.

### Truthfulness and engineering discipline

- Never claim a feature is implemented until the code and a meaningful test/demo confirm it.
- Label all synthetic data, mock records, placeholder thresholds and simulated workflows visibly.
- Never invent field observations, crop distribution, pest outbreaks, beneficiaries, impact figures or official warnings.
- Keep provenance, timestamps, data completeness and limitations visible.
- Do not present an NDVI anomaly as a disease diagnosis, a weather forecast as a confirmed hazard, or a heuristic score as a calibrated probability.
- Do not let a language model invent risk scores, thresholds, official warnings or pesticide prescriptions.
- If information is unavailable, show it as unavailable rather than silently estimating it.

---

# 1. Executive product definition

## 1.1 What LouNgak AI is

**LouNgak AI is an AI-powered agricultural and environmental intelligence platform that combines satellite imagery, weather information, geospatial analysis and regional agricultural knowledge to identify potential risks, issue explainable early warnings, and connect those warnings to field inspection and community action.**

Short positioning:

> **From geospatial observation to early warning and informed action.**

LouNgak AI is Manipur-first, with a long-term vision of becoming a configurable community-oriented GeoAI platform that can support agricultural resilience, environmental monitoring and relevant disaster preparedness across India.

## 1.2 Core purpose

The central problem is that agricultural officers and extension workers have limited time and cannot continuously inspect every farm or agricultural area. Farmers may notice local problems, but reports can be delayed or geographically isolated. Satellite, weather and geospatial data can reveal signals, but they are difficult to interpret and rarely connect automatically to practical field action.

LouNgak AI aims to bridge this gap through one connected workflow:

**Monitor → Detect → Explain → Prioritise → Report → Assign → Inspect → Verify → Learn.**

The platform should help answer:

1. Where might attention be needed?
2. What evidence suggests a concern?
3. Which crop, farms, H3 cells or communities may be affected?
4. How urgent is the situation, and how reliable is the evidence?
5. Who should review or inspect it?
6. What was actually observed on the ground?
7. What changed after verification?

## 1.3 What LouNgak AI is not

LouNgak AI is not intended to be:

- A generic chatbot with an agriculture theme.
- A satellite imagery viewer with no decision workflow.
- A replacement for agricultural officers, agronomists, IMD, CWC, NDMA or other authorities.
- An automated disease-diagnosis or pesticide-prescription system.
- An independently authoritative nationwide flood/disaster forecasting service.
- A full farm ERP, agricultural marketplace, loan/insurance approval system or government-benefit eligibility engine.

It is a **decision-support and early-warning platform**. Human review and field verification remain central to consequential decisions.

---

# 2. Hackathon context: Hack for Social Cause under VBYLD 2027

The initial product expansion and presentation are being prepared for **Hack for Social Cause**, an initiative under **Viksit Bharat Young Leaders Dialogue (VBYLD) 2027**, presented through the MY Bharat portal.

The information below is based on the portal screenshots supplied by the user on 30 October 2026. The live portal should be checked for any subsequent changes or conflicting FAQ text.

## 2.1 Programme purpose and message

The portal describes Hack for Social Cause as an initiative for young people aged 18–29 to build scalable, technology-driven solutions for social good, combining technical knowledge with practical implementation.

The overarching theme shown in the portal is:

> **Think Global, Hack Local – Technology for Social Transformation.**

The portal encourages participants to adapt and contextualise ideas to state-specific issues and align them with relevant United Nations Sustainable Development Goals (SDGs). The thematic areas are indicative, not restrictive.

## 2.2 Recommended theme selection for LouNgak AI

**Primary theme: AI, GIS & Emerging Technologies.**

This is the strongest fit because LouNgak AI combines geospatial analysis, satellite remote sensing, GIS, data analytics, rule-based intelligence, AI-assisted language interaction and spatial decision support.

**Supporting themes:**

- **Rural Development & Livelihoods:** Better access to agricultural information, prioritised field inspections and support for rural livelihoods.
- **Environment & Sustainability:** Vegetation, water and land-change monitoring, and climate-related agricultural resilience.
- **Disaster Mitigation, Kumbh Mela (as labelled in the portal):** Relevant hazard awareness and agricultural/community exposure information, without attempting to become a general disaster command system.

Do not claim the project belongs equally to every theme. Lead with AI, GIS & Emerging Technologies and explain the rural/environmental social application.

## 2.3 Other themes shown on the portal

The portal displays eleven indicative themes:

1. Rural Development & Livelihoods.
2. Education & Skill Development.
3. Healthcare, Wellbeing & Service Delivery.
4. Governance & Civic Technology.
5. Environment & Sustainability.
6. Digital Inclusion.
7. AI, GIS & Emerging Technologies.
8. Digital Safety & Cyber Fraud Awareness.
9. Elderly Care & Healthy Ageing.
10. Assistive Technology & Accessibility.
11. Disaster Mitigation, Kumbh Mela.

These are context, not a checklist of features to add.

## 2.4 Social problem and beneficiaries

### Problem statement

Farmers and agricultural authorities often have limited access to timely, localised and understandable information about crop conditions and environmental risks. Agricultural officers cannot inspect every farm continuously. Weather, satellite and geospatial information may be available, but translating it into localised, evidence-backed inspection priorities and community advisories is difficult.

LouNgak AI aims to make geospatial intelligence more accessible and actionable by identifying potentially concerning areas, explaining the evidence, enabling farmer reports and connecting priority alerts to human field inspection and verification.

### Primary beneficiaries

- **Farmers and rural communities:** Local alerts, crop knowledge, weather information, accessible explanations and a way to report suspected problems.
- **Agricultural officers and extension workers:** Geographical monitoring, inspection prioritisation, assignment and verification workflows, and structured reports.
- **District/state authorities and planning institutions:** Regional situation awareness and evidence-backed summaries to support human decisions.

Avoid claiming that the platform has already reduced crop loss, improved income or reached a specific number of beneficiaries unless measured evidence exists.

## 2.5 SDG alignment

Use a focused, credible SDG story.

### Primary SDGs

- **SDG 2 — Zero Hunger:** Contribute to small-scale food producer support and resilient agricultural practices through monitoring, early warning and access to agricultural information. Relevant targets to reference include 2.3 and 2.4.
- **SDG 13 — Climate Action:** Support local preparedness and adaptive capacity for climate-related hazards through climate and agricultural risk information. Relevant target: 13.1.

### Supporting SDGs

- **SDG 11 — Sustainable Cities and Communities:** Relevant hazard awareness and support for local resilience and preparedness.
- **SDG 15 — Life on Land:** Vegetation and land-cover change monitoring and evidence for sustainable land-management decisions.
- **SDG 6 — Clean Water and Sanitation:** Include only when water-resource/surface-water monitoring is part of the demonstrated scope.

Do not state that LouNgak AI achieves an SDG. State the specific contribution it may make and propose measurable indicators.

Official SDG reference: https://sdgs.un.org/goals

## 2.6 Portal eligibility and submission information shown in screenshots

The supplied portal screenshot showed the following eligibility information:

- Indian nationals.
- Age 18–29 years as of **17 August 2026**.
- Currently enrolled in an AICTE-registered higher education institution (college, university or polytechnic).
- Team of up to three students; members may be from the same or different institutions.
- All team members must register individually on the MY Bharat portal.
- One member must be designated Team Lead and is responsible for submitting the entry and documents.

The screenshot's submission checklist listed:

1. **Problem statement:** State-specific problem, target beneficiaries, identification and current gaps.
2. **Presentation deck:** Concise 6–7 slide proposal covering problem, solution, impact and implementation.
3. **Working prototype:** Link to a code repository (GitHub/GitLab) or public source code.
4. **Demo video:** Short video, shown as 3–5 minutes, demonstrating the team, problem context, prototype, user interaction and impact.
5. **Team self-declaration:** Team/member details and signed self-certification.
6. **Identity proof:** ID proof for every team member.

### Four-stage programme and dates shown in the portal timeline

| Stage | Dates | Description shown |
|---|---|---|
| Stage 1 — Registration & submission | 1 September–31 October 2026 | Registration of teams and submission of entries on MY Bharat Portal. |
| Stage 2 — State-level hackathons and demonstrations | 7 November–5 December 2026 | Mentoring and jury evaluation; three teams shortlisted to the next round. |
| Stage 3 — Shortlisting for National Finalist | 5–15 December 2026 | IIT Bombay screening; top ten teams from each State/UT progress, with mentoring of national finalists. |
| Stage 4 — National Showcase | 10–12 January 2027 | National showcase in New Delhi; the portal describes the top five teams being selected for awards. |

The portal's About page also identifies the following partners/governance participants:

- Ministry of Youth Affairs & Sports (MoYAS): organiser and policy leadership.
- IIT Bombay: national knowledge partner providing mentoring and technical guidance.
- State Nodal Institutions (SNI): state-level hackathons and mentorship.
- MY Bharat Portal: registration and programme management.

**Deadline note:** The supplied timeline screenshot displays 31 October 2026 as the submission end date. If another portal section or FAQ displays a different date, verify the logged-in submission page and follow the live portal's current instruction. Do not rely on an old screenshot if the portal changes.

## 2.7 Hackathon presentation and demonstration strategy

The portal screenshot lists a 3–5-minute demo video. The team has also discussed a possible 7–8-minute live explanation/demo slot. Treat these as different constraints:

- Prepare the submission video within the portal's stated 3–5-minute range unless the portal changes it.
- If a live slot of 7–8 minutes is allocated, use the longer narrative below and adjust to the official slot.

### Suggested 6–7 slide deck

1. **LouNgak AI — From Geospatial Observation to Early Warning and Action:** Product identity and one-sentence proposition.
2. **The social problem:** Limited field-inspection capacity, fragmented information, delayed reporting and the difficulty of interpreting satellite/weather data.
3. **Our solution:** One connected process: monitor, detect, explain, prioritise, report, inspect and verify.
4. **Technology and innovation:** Satellite imagery, GIS/H3, weather, crop knowledge, deterministic rules, AI-assisted explanation and field feedback.
5. **Working prototype:** Actual map, current implemented analysis, one alert, farmer report and officer workflow. Clearly mark simulated data.
6. **Social impact and SDGs:** Farmers, officers and rural communities; SDG 2 and 13 primary, SDG 11/15 supporting.
7. **Implementation and vision:** Manipur pilot, measurable outcomes, next milestones and potential Indian expansion.

### Suggested live demonstration narrative

Tell one end-to-end story rather than opening every module:

1. Show Manipur and the geographical monitoring map.
2. Show an actual available satellite/weather assessment and explain its limits.
3. Open one LouNgak Watch alert and show why it was generated.
4. Show a farmer submitting a suspected issue (use clearly labelled demonstration data if simulated).
5. Show the officer review queue and inspection priority rationale.
6. Assign a task, record a sample field inspection and show the verification outcome (label simulated records clearly).
7. Show the updated situation view or report and close with the social-impact purpose.

The live demo must prioritise a working coherent workflow over many unfinished screens.

---

# 3. Product strategy and scope

## 3.1 Agreed strategic direction

The agreed direction is **Option 2 as the product identity, with Option 3 as the longer-term ambition**:

- **Core identity:** Agricultural and Environmental Intelligence Platform.
- **Central operational purpose:** An early-warning and field-response system.
- **Initial application:** Agriculture and climate/weather-related risks affecting agricultural areas.
- **Adjacent scope:** Relevant environmental and hazard information affecting agriculture and nearby rural communities.
- **Long-term vision:** A broader community-oriented GeoAI platform for resilience and disaster preparedness, configurable for other Indian states.

Do not turn the initial product into a general-purpose disaster-management command centre. Hazard capabilities must have a credible connection to agriculture or nearby rural communities.

## 3.2 Three product pillars

### Pillar 1 — Geospatial Intelligence

- Satellite and weather data ingestion.
- H3-based geographical monitoring.
- Agricultural land/land-cover context.
- Crop and growth-stage context where known.
- NDVI and other justified remote-sensing indicators.
- Water-extent and environmental observations where supported.
- Historical analysis and data provenance.

### Pillar 2 — Early Warning and Reporting

- Separate weather, pest, disease, crop-health, water/flood and environmental/community hazard alerts.
- Deterministic, evidence-based rule evaluation.
- Official warning/advisory integration where available and permitted.
- Farmer-initiated issue reporting.
- Explainable alert priority and evidence status.
- Localised community communication.

### Pillar 3 — Field Operations and Verification

- Officer review of system-generated alerts and farmer reports.
- Inspection prioritisation and queue management.
- Hierarchical task assignment.
- Field visit and observation capture.
- Officer-submitted verification outcome.
- Inspection history, situation updates and reporting.

Crop Atlas is a shared agricultural knowledge resource. The AI Assistant is a shared interface across the platform. Situation Monitor and Situation Reports present intelligence from the pillars.

## 3.3 Product modules and navigation

Use modules as functional sections within **one integrated application**, not separate products.

Recommended main modules:

1. **Overview:** Role-specific home dashboard.
2. **Situation Monitor / Agricultural Intelligence:** Map-first geographical picture, H3 cells, agricultural land, imagery, weather and relevant environmental layers.
3. **LouNgak Watch:** Alert centre with independent alert categories and a combined situation summary.
4. **Crop Atlas:** Detailed crop profiles and regional agricultural knowledge.
5. **Field Operations:** Review, priority queue, assignments, inspections and verification.
6. **Situation Reports:** Consolidated evidence-backed reports.
7. **AI Assistant:** Natural-language interface to supported platform functions.

Do not create an independent top-level menu item for every small capability. For example, water analysis can initially be a layer/capability inside Situation Monitor, with related events appearing in LouNgak Watch.

---

# 4. User groups, dashboards and permissions

## 4.1 Two primary dashboards within one application

The agreed design is **two primary dashboards, not one universal dashboard and not two separate applications**.

### Dashboard A — Community & Farmer

Audience:

- Farmers.
- Rural community members.
- General public visitors.

Purpose: Simple, accessible agricultural and local-risk information.

Core functions:

- Public local advisories and alerts.
- Weather information.
- Crop Atlas and basic agricultural knowledge.
- Relevant nearby/community alerts.
- Ask LouNgak AI using supported languages.
- Submit a suspected agricultural/environmental issue.
- Optional farmer account and profile.
- Optional farm registration and crop preferences.
- View own report/inspection progress where permitted.

Design principles:

- Mobile-first, lightweight and accessible.
- Plain language by default; explain technical terms.
- Avoid raw NDVI, radar or model parameters unless the user opens a detailed explanation.
- Show practical next steps and when to contact a local agricultural officer.
- General public can browse public Crop Atlas and public advisories without an account.
- Authentication is required for personal farm records and report tracking.

### Dashboard B — Agricultural Officer

Audience:

- Local/field agricultural officers.
- District agricultural officers.
- Senior/state-level authorised officers.

Purpose: Operational geographical monitoring and field-response coordination.

Core functions:

- Situation Monitor map.
- H3 grid and agricultural cell filters.
- District/area/crop filtering.
- Active alerts and evidence details.
- Farmer-submitted report review queue.
- Inspection priority queue.
- Hierarchical inspection assignment.
- Field inspection and verification records.
- Historical assessments and situation reports.
- Crop Atlas and AI Assistant access.

Design principles:

- Map-first, analytical, clear and usable on desktop; field workflows must also be mobile-friendly.
- Distinguish forecast, model-indicated, satellite-observed, farmer-reported, field-verified and official information.
- Show data freshness, completeness, spatial resolution and limitations.
- Allow authorised human override of priorities and assignments with an audit reason.
- Do not show every farm and every inspection marker by default; use contextual filters and drill-down.

## 4.2 Roles and authorisation

| Role | Access model |
|---|---|
| Public visitor | Public Crop Atlas, public advisories and general information; no access to private farm/report data. |
| Farmer/community account | Own profile, optional registered farms, relevant local alerts, own reports and permitted status updates. |
| Field officer | Assigned inspection tasks, relevant location/context, field submission and own task history. |
| District agricultural officer | Assigned district/region, review queue, local task assignment and area-level reports. |
| Senior/state-level officer | Authorised multi-district oversight, cross-district coordination and reporting. |
| Administrator | Restricted platform and data management; not a primary public product dashboard. |

Use role-based permissions and jurisdiction/assignment-based access. Exact official titles and boundaries should be configurable to match real administrative structures. Do not assume every district or officer has been formally integrated.

## 4.3 Farmer and public alert visibility

- Farmers may view relevant alerts for their surrounding area even if the alert was not generated specifically for their registered farm.
- Publicly visible alerts must not expose personal farmer identity, private farm boundaries or private report details.
- Farmers should see their own submitted report's progress: received, under review, inspection assigned (where applicable), inspected/updated and closed.
- Do not expose internal officer discussions, confidential contact details or private operational notes to farmers.

---

# 5. Geographical intelligence and monitoring model

## 5.1 Core direction: H3 hexagonal grid

The preferred geographical monitoring model is an **H3 hexagonal grid**, with administrative boundaries, agricultural monitoring clusters and optional individual farm polygons as complementary geographic objects.

H3 is a candidate/selected design direction for the grid, but the exact resolution is not yet fixed. Evaluate it empirically against source-data resolution, local farm scale, performance and usability.

### Recommended geographical hierarchy

- Country: India.
- State: Manipur initially.
- District and other administrative levels where reliable boundary data exist.
- H3 cells as standardised analysis/aggregation units.
- Spatial clusters of related/adjacent cells for alerts and inspection planning.
- Individual farm polygons when registered or otherwise reliably available.
- User-drawn polygons for custom satellite analysis.

An H3 cell is not an administrative village and is not an individual farm. Do not label a cell as a village or farm unless there is a verified spatial association.

## 5.2 Grid display and filtering

Working design direction:

- Cover the selected geographical extent with a hexagonal grid.
- Classify cells using available land-cover/agricultural information.
- Provide layer visibility and filters, including an **agricultural cells only** view.
- Allow the whole grid to be shown when a user wants geographical context.
- Avoid clutter through zoom-dependent visibility, cell outlines/opacity controls and filters.
- Use a consistent analytical resolution for comparable risk assessments. It is acceptable to change display detail or show a different H3 resolution when zooming, but do not silently compare risk values calculated at incompatible analytical resolutions.
- Exact H3 resolution and any multi-resolution strategy remain an implementation decision after testing.

H3 cell area and effective analytical scale vary with resolution. Do not choose a resolution solely because it looks attractive on a map.

## 5.3 Agricultural land mask and mixed land cover

Do not assume every hexagon is farmland.

A cell may contain agricultural land, forest, settlements, water or other cover. The system should:

- Use an appropriate, licensed and documented land-cover/agricultural mask where available.
- Estimate/record the agricultural fraction or relevant pixel coverage within a cell.
- Support cells with mixed land cover.
- Apply vegetation analysis only to appropriate valid pixels/areas.
- Mark cells as non-agricultural, mixed, unknown or insufficient-data where appropriate.
- Avoid arbitrary agricultural-percentage thresholds without documenting and validating them.

An NDVI change in a forested or built-up portion of a cell must not automatically be interpreted as a crop-health anomaly.

## 5.4 Farm polygons and H3 association

Farm registration is optional. The platform must work with H3 monitoring even if no farm is registered.

A farmer may optionally register a farm by drawing/uploading a boundary and providing crop information. An authorised officer may also register a farm through an approved workflow.

Store farm geometry separately from H3 geometry. Associate a farm with intersecting H3 cells for navigation/context, but calculate farm-specific indicators from the farm polygon where source resolution and data quality permit. Do not merely copy a whole-cell score to every farm within it.

Farm details may include:

- Farm ID and optional name.
- Boundary geometry and location.
- District/administrative association.
- Crop(s), variety where known, season and cultivation type.
- Sowing/transplanting date and growth stage when supplied.
- Registration source: farmer-declared or officer-entered.
- Verification status and timestamp.

Do not imply that farmer-supplied farm or crop information is verified unless an authorised verification process has occurred.

## 5.5 Other geographic analysis objects

Support:

- H3 cells for consistent monitoring.
- Spatial clusters for groups of concerning cells.
- Registered farm polygons for personalised assessment.
- User-drawn polygons for custom analysis.
- District/administrative boundaries for reporting and jurisdiction.

Use precise geometric intersections for administrative/farm overlays. H3 parent/child indexing is not an exact substitute for polygon intersection.

## 5.6 Weather and satellite spatial resolution

A crucial constraint: output precision cannot exceed input precision.

- Current project weather queries may use one point per monitored zone. A new H3 design must not falsely present that one point as an independent weather observation for every tiny cell.
- Use appropriately gridded forecast data if available, or explicitly associate a shared weather observation/forecast with a justified geographical scope.
- Sentinel imagery provides spatially detailed observations but cloud, revisit, pixel resolution and processing constraints remain.
- Preserve the acquisition date, valid pixel coverage and source footprint.
- A district-level official warning must remain a district-level warning; it must not be represented as an independent cell-level forecast.

---

# 6. Agricultural and environmental intelligence

## 6.1 Crop and agricultural monitoring priorities

Initial crops:

1. **Rice/paddy** — primary crop profile and monitoring target.
2. **Chak-hao** — a dedicated profile/varietal treatment under rice, with regionally verified information.
3. **Maize** — second initial crop-monitoring priority.

The knowledge catalogue may later expand to regionally important crops such as pulses, ginger, turmeric, pineapple, King Chilli, Tamenglong Orange, Kachai Lemon, passion fruit and vegetables. These are candidates for the broader Crop Atlas, not a commitment to implement all crop-specific risk rules in the MVP.

Do not assume a crop exists in a particular H3 cell/farm unless sourced, registered or otherwise supported. Unknown crop must remain unknown.

## 6.2 Crop-zone/farm mapping

For each monitored area/cell/farm, retain crop context when known:

- Crop ID and common/local/scientific names.
- Variety where available.
- Season and crop calendar context.
- Growth stage and date/source of that stage.
- Cultivation type (e.g., irrigated/rainfed) where supplied.
- Source and verification status.

The initial seven demonstration rectangles from the old project are not verified crop maps. Treat them as historical demonstration areas until their geometry and crop associations are reviewed.

## 6.3 Crop Atlas

Crop Atlas is a shared knowledge module, not merely an article list. It should provide source-backed crop information and support alert explanations and the AI assistant.

### Detailed profile structure

For priority crops, a profile should contain:

1. Crop name (English), verified local names, scientific name and aliases.
2. Crop category and short description.
3. Importance and documented cultivation context in Manipur.
4. District/agro-ecological distribution only when supported by reliable sources.
5. Varieties, including regionally important types where verified.
6. Sowing, nursery, transplanting and harvesting windows, with distinctions for region, elevation, method and season where necessary.
7. Growth stages.
8. Soil, water, temperature and other cultivation requirements.
9. Common pests: identification, symptoms, conducive conditions and trusted management information.
10. Common diseases: symptoms, risk factors and trusted management information.
11. Weather vulnerabilities and relevant crop-stage sensitivities.
12. What LouNgak can and cannot monitor remotely for this crop.
13. Related alert types and advisory rules, with rule validation status.
14. Sources, publication/effective dates, last-reviewed date and reviewer/verification status.

Do not invent crop calendars, local crop distribution, pest prevalence or thresholds. Use ICAR, KVK, state agriculture department and other credible agricultural sources; label regional gaps.

### Initial profile priorities

- Rice (general).
- Chak-hao as a dedicated rice profile/varietal entry, including regionally documented varieties only.
- Maize.

Other crops can have concise catalogue entries later, with detailed profiles added only when reliable regional material is available.

## 6.4 Existing geospatial and remote-sensing capabilities (baseline from repository README)

The supplied README describes the following existing prototype functions. Verify them in the current code before relying on them:

- Map-based selection/drawing of areas and GeoTIFF upload.
- Sentinel-2 NDVI for crop-health/vegetation condition on valid cloud-free land pixels.
- Sentinel-1 radar support for water analysis when optical imagery is too cloudy.
- NDWI/water detection and optical/radar analysis.
- Change analysis between dates.
- Satellite image scene description/grounding through an optional Falcon 0.7B vision-language model with a project LoRA adapter.
- Live weather forecasts for a point inside a selected area (README describes today through 16 days).
- Explainable results with methods, data sources, confidence/context and downloadable HTML/JSON reports for imagery analysis.

Do not interpret NDVI as disease detection. NDVI indicates vegetation vigour/condition and can change for many reasons including crop stage, harvesting, water stress, land-cover differences and cloud/pixel-quality problems.

## 6.5 Environmental intelligence scope

Environmental intelligence should initially focus on information that is useful to agriculture and nearby rural communities:

- Surface-water extent and change.
- Potential waterlogging/inundation screening.
- Vegetation and land-cover change signals.
- Weather/climate context affecting crop conditions.
- Relevant official hazard warnings and their potential agricultural exposure.

Do not expand into an unrestricted environmental monitoring catalogue during the MVP.

---

# 7. LouNgak Watch — Early-Warning Engine

## 7.1 Definition

**LouNgak Watch** is the user-facing alert and early-warning module. It consumes structured results from the backend **LouNgak Risk Intelligence Engine** and presents independent alerts with evidence, priority, geography, validity and recommended action.

The Risk Intelligence Engine is a backend subsystem; LouNgak Watch is the corresponding user-facing experience. They are related but not interchangeable.

## 7.2 Agreed risk-determination approach: hybrid rules and AI

Core principle:

> **Deterministic, versioned rules determine the risk assessment. AI helps retrieve, explain, summarise and communicate the results.**

Rules should be the primary mechanism for operational risk decisions. Rules must be traceable to agricultural literature, official advisories or expert review.

AI may:

- Explain why a rule triggered using structured evidence.
- Retrieve relevant Crop Atlas knowledge.
- Summarise official advisories.
- Produce plain-language or reviewed Manipuri explanations.
- Summarise multiple alerts for a selected area.
- Help interpret submitted imagery within declared model limitations.

AI must not:

- Invent numerical thresholds or risk scores.
- Change a deterministic rule result.
- Turn a suspected report into a confirmed diagnosis.
- Create an official warning or imply endorsement by an authority.
- Generate unsupported pesticide prescriptions or medical/agronomic certainty.

Machine-learning risk prediction may be explored later when suitable labelled local data and validation are available. Do not use ML merely to make the product appear more advanced.

## 7.3 Six separate alert categories

Keep alert categories independent; do not collapse all types into a single generic alert.

### A. Weather alerts

Potential subtypes:

- Heavy rainfall.
- Prolonged rainfall / consecutive wet days.
- Dry spell.
- Extreme temperature / heat stress context.
- Cold conditions where relevant.
- Hailstorm warning.
- Strong wind warning.
- Other authoritative severe-weather warnings.

Use official warnings and suitable forecast data. Distinguish forecast from observed weather. A heavy-rainfall forecast alone is not proof of flooding.

### B. Pest-risk alerts

Use crop-specific context, relevant weather inputs and credible pest advisories/field evidence.

Initial knowledge candidates:

- Rice: yellow stem borer, leaf folder, gall midge and relevant hopper advisories.
- Maize: fall armyworm and stem-borer-related advisories, subject to regional source validation.

Do not claim pest presence from weather or satellite data alone. Weather may indicate conducive conditions; field reports/verified observations provide different evidence.

### C. Disease-risk alerts

Use crop-specific disease knowledge, growth stage and expert-reviewed environmental thresholds where available.

Initial candidates:

- Rice blast and other regionally documented rice diseases.
- Maize diseases such as regionally documented leaf blights/rust, once sources and rules are reviewed.

Distinguish:

1. General disease information.
2. Disease-conducive conditions (model/rule indication).
3. Suspected farmer/field report.
4. Officer-observed symptoms.
5. Expert/laboratory-confirmed diagnosis, only if such verification actually exists.

NDVI cannot diagnose a disease.

### D. Crop-health alerts

Potential triggers:

- Unusual NDVI/vegetation change against a suitable historical baseline.
- Persistent vegetation anomaly where cloud and valid-pixel coverage are sufficient.
- Other justified remote-sensing indicators.

Possible explanations must remain open: normal crop-stage changes, harvesting, water stress, excess water, land-cover change or potential crop-health concerns. Recommend comparison and field verification rather than claiming a cause.

### E. Water and flood alerts

Potential capabilities:

- Rainfall-driven waterlogging screening.
- Sentinel-1 radar-derived water observations.
- Sentinel-2 water indices where imagery quality permits.
- Historical water-extent comparison.
- Exposure overlay for agricultural cells and registered farms.
- Integration/presentation of official CWC or other appropriate flood warnings.

A validated flood forecasting model is not an MVP requirement. Do not claim flood prediction without a sound model and evaluation.

### F. Environmental and community-hazard alerts

Include only relevant hazards affecting agriculture or nearby rural communities, such as:

- Official severe-weather/hazard warnings relevant to monitored areas.
- Relevant environmental change signals.
- Selected rural-community exposure information where reliable spatial data exist.

Long-term possibilities may include broader hazard layers, but general earthquake prediction, broad disaster command functions and unsupported landslide/flood prediction are out of scope.

## 7.4 Separate alerts plus combined situation summary

Agreed organisation:

- Generate separate alert records for weather, pest, disease, crop health, water/flood and environmental/community hazards.
- Provide a combined area/cell situation summary as a derived view, not as a replacement for category-specific alert records.
- Multiple signals may be linked to one situation/event for context, but preserve individual sources, categories and evidence.
- If related neighbouring cells trigger the same rule/event, spatially cluster the affected footprint to avoid notification spam. Retain cell-level evidence underneath the cluster.

## 7.5 Risk urgency and evidence status are separate dimensions

Do not use one colour or one numeric score to represent both seriousness and certainty.

### Operational priority

- **Low:** Informational; no immediate intervention expected.
- **Moderate:** Monitor conditions or gather more information.
- **High:** Inspection or action is recommended within an appropriate timeframe.
- **Urgent:** Immediate attention is warranted under an authoritative warning or a reviewed escalation rule.

Priority definitions and deadlines should be configurable by alert category and source. Avoid unsupported automatic escalation.

### Evidence status

Use explicit evidence labels such as:

- Forecast.
- Model-indicated / rule-triggered.
- Satellite-observed.
- Farmer-reported (unverified).
- Field-observed / officer-verified.
- Expert/laboratory-confirmed, only where applicable.
- Official warning (with issuing authority).

An officer-verified observation is not automatically an expert/laboratory-confirmed diagnosis.

## 7.6 Risk-rule input requirements

Depending on the rule, inputs may include:

- Crop and variety where relevant.
- Crop growth stage and season.
- Temperature.
- Relative humidity.
- Rainfall accumulation and intensity.
- Consecutive wet/dry days.
- Wind/hail/official warning data.
- Vegetation indices and valid-pixel coverage.
- Water extent, terrain and drainage context.
- Historical observations.
- Field reports and verification records.
- Geographic applicability and source resolution.

A rule should specify whether each input is mandatory, optional or contextual. Missing mandatory inputs should prevent the rule from generating an operational alert. Missing optional inputs should reduce completeness and be visible.

## 7.7 Rule registry and governance

Each rule should be version-controlled and contain:

- `rule_id` and name.
- Alert category/subtype.
- Applicable crops, varieties, growth stages and regions.
- Required/optional input variables.
- Thresholds, duration windows and evaluation logic.
- Source citation and source publication/effective date.
- Expert review/approval status.
- Rule version and effective dates.
- Limitations, exclusions and invalidation conditions.
- Test fixtures and expected outcomes.

Rules without credible sources or expert review remain `PLACEHOLDER`/`UNVALIDATED`. They must not be presented as operationally validated risk warnings. During a hackathon, use clearly labelled demonstration advisories rather than invented thresholds.

## 7.8 Alert validation and evidence-quality gate

Before publishing a system-generated alert, check:

1. Is the source available and valid?
2. Is the data fresh enough for this alert type?
3. Does the evidence cover the stated geography and time period?
4. Is the crop association known and sufficiently reliable where required?
5. Is the growth stage known where required?
6. Is the rule reviewed/approved for operational use?
7. Is the valid spatial resolution represented honestly?
8. Is the evidence sufficient for the proposed alert state and priority?
9. Does an equivalent active alert already exist?

Possible outcomes:

- Publish an alert.
- Publish a qualified watch with explicit limitations.
- Hold for human review.
- Suppress because a mandatory input is missing or a rule is unvalidated.
- Update an existing alert rather than create a duplicate.

Confidence/evidence quality must be calculated from defensible criteria (source reliability, freshness, completeness, rule validation and spatial suitability), not an arbitrary percentage invented by an LLM.

## 7.9 Alert lifecycle

Suggested lifecycle:

1. Candidate/generated.
2. Evidence validation.
3. Published/active.
4. Acknowledged.
5. Under review (if inspection/review applies).
6. Updated, resolved or closed.
7. Expired/cancelled, retaining history.

Keep `alert_status`, `priority`, `evidence_status` and inspection/task status separate. They describe different things.

Alerts should include issue time, valid-from/valid-until, source timestamp, update/cancellation history and deduplication/event linkage.

## 7.10 Official-warning integration

Where technically and legally available, LouNgak may ingest or link official information from:

- India Meteorological Department (IMD) for weather forecasts, nowcasts, warnings and agrometeorological advisories.
- Central Water Commission (CWC) for relevant official flood forecasts/warnings.
- NDMA/SACHET for relevant geo-targeted public disaster alerts.
- ICAR, KVKs and state agriculture departments for crop, pest, disease and management advisories.

Integration method (API/feed, official publication parsing, link/reference or manual authorised upload) must be chosen only after checking availability, terms, reliability and licence. Do not assume public APIs exist for every source.

Preserve original issuing authority, warning identifier if provided, issue time, validity, geography, severity, original wording/link and any translation. LouNgak's agricultural interpretation must be clearly labelled as supplementary, not the issuing authority's own statement.

---

# 8. Farmer-initiated reporting

## 8.1 Purpose

Automated monitoring will never observe every field condition. Farmers may notice symptoms or damage before a satellite signal becomes visible or before an official advisory is issued.

Farmer reporting is the second entry path into the same officer review and field-operations workflow.

There are two entry paths:

- **System-initiated:** Weather/satellite/rule/official source produces an alert.
- **Farmer-initiated:** Farmer submits a suspected issue.

Both can reach the officer review queue, but remain distinguishable by origin and evidence status.

## 8.2 Report categories

- Suspected pest problem.
- Suspected disease/symptoms.
- Crop damage or unusual crop condition.
- Waterlogging/flooding.
- Weather-related damage (e.g., hail/heavy rain/wind).
- Other agricultural/environmental concern.

## 8.3 Submission fields

Minimum useful fields:

- Report ID.
- Report category.
- Location: registered farm, selected H3 cell, map pin or permitted location capture.
- Crop (Rice, Chak-hao, Maize, other, unknown).
- Optional variety/growth stage.
- Description / observed symptoms.
- Optional photographs.
- Submission time.
- Reporter/account reference and safe contact route.
- Consent and privacy handling.
- Initial status: `UNVERIFIED` / `SUBMITTED`.

Allow a farmer to submit a report without a registered farm. The user should be able to select a point/area and crop if known.

## 8.4 Report-to-officer workflow

1. Farmer submits report.
2. System validates required fields and stores it as unverified.
3. Associate the location with H3 and administrative geography where reliable.
4. Retrieve relevant nearby alerts/weather/crop context without treating them as proof of the report.
5. Route to the appropriate officer's review queue based on jurisdiction.
6. Officer reviews, requests more information, dismisses with reason, links to an existing alert/event or creates an inspection task.
7. Farmer sees permitted progress updates, not internal officer notes.
8. Inspection outcome is linked to the report when completed.

Do not automatically label a farmer report as a verified event or official warning.

## 8.5 Farmer report tracking

Registered farmers can view status of their own reports, for example:

- Submitted / received.
- Under review.
- Inspection assigned (if applicable).
- Inspection completed / outcome recorded.
- Follow-up required.
- Closed.

Report status must not reveal private internal discussion or other farmers' information.

## 8.6 Nearby alert visibility

Farmers may view relevant public alerts for their selected/surrounding area even if they have not registered a farm or the alert is not specific to their own farm. Keep private farm data and private reports protected.

---

# 9. Field Operations — inspection assignment and verification

## 9.1 Purpose

Field Operations connects machine/system-detected signals and community reports to real-world field visits. It helps agricultural departments use limited inspection resources more effectively.

It is a core product module, not merely a status field inside LouNgak Watch.

## 9.2 Hierarchical assignment model (agreed)

Use a configurable hierarchy:

- **Senior/state-level authorised officers:** Overview and permitted coordination/assignment across multiple districts.
- **District agricultural officers:** Review local alerts and farmer reports, prioritise and assign inspections within their jurisdiction.
- **Local/field agricultural officers:** Receive assigned tasks, visit the location and submit observations/verification.

Exact officer titles and geographical responsibility must be configurable to match the actual department. Do not hard-code assumed government titles or imply official deployment/endorsement.

## 9.3 Farm registration (agreed)

- Farmer farm registration is optional.
- H3-based monitoring and area-level warnings work without registered farms.
- Farmers may optionally register a farm boundary and crop details.
- Authorised officers may also add farm records if an approved workflow is implemented.
- Farmer-supplied and officer-entered data must retain source and verification status.

## 9.4 Inspection task model

An inspection task is a separate record from an alert or farmer report.

- One alert may produce multiple inspection tasks.
- One inspection may investigate multiple related alerts/reports.
- An inspection may cover a farm polygon, H3 cell, cluster or other defined location.

Suggested task data:

- `inspection_id`.
- Related alert IDs/report IDs/event IDs.
- Target geometry, farm ID and H3 cells where applicable.
- District/jurisdiction.
- Crop and relevant context.
- Reason for inspection.
- Priority and rationale.
- Assigned officer/team.
- Created/assigned/due/started/completed timestamps.
- Task status and status history.
- Suggested checks/checklist.
- Field observation/verification record.
- Attachments and GPS evidence where consented/appropriate.

## 9.5 Inspection priority queue and lightweight scheduling

Use an explainable priority queue. The system recommends an order; authorised officers retain the final decision and can override it with a recorded reason.

Factors may include:

- Risk urgency/operational priority.
- Evidence quality and source reliability.
- Alert validity and time sensitivity.
- Crop and growth-stage relevance.
- Potential geographical exposure (farms/agricultural area/cells affected).
- Official warning applicability.
- Time since report/alert.
- Nearby inspections that can reasonably be grouped.
- Officer capacity/workload and geographical jurisdiction.

Do not treat these factors as a validated numerical formula until tested. Use transparent rules and show why an item is prioritised.

### MVP scheduling

- Manual assignment by authorised officer.
- Simple priority ordering and due dates.
- Workload visibility.
- Assignment, acceptance and completion statuses.
- Basic grouping of nearby tasks for operational convenience.

### Later scheduling enhancements

- Route optimisation.
- Travel-time-aware scheduling.
- Automated workload balancing.
- Offline mobile field workflows.

Do not build complex route optimisation before the basic workflow is reliable.

## 9.6 Field inspection form

Mobile-first form fields:

- Actual inspection GPS/location, with permission and accuracy indication.
- Inspection date/time.
- Target farm/area/H3 cell and related alert/report.
- Observed crop and growth stage (including unknown).
- Crop condition and structured symptoms.
- Pest/disease suspicion (not an automatic diagnosis).
- Water condition / visible inundation where relevant.
- Photos and notes.
- Immediate action/advice or referral, if within officer remit.
- Follow-up recommendation.
- Inspector identity and submission timestamp.

Use clear consent and data minimisation for location/photos. Do not require unnecessary personal data.

## 9.7 Verification outcomes (agreed)

The assigned field officer submits an outcome, such as:

- **Concern observed:** The condition that prompted inspection was observed.
- **Concern not observed:** It was not observed at the inspection time.
- **Inconclusive:** Insufficient evidence to determine.
- **Different issue observed:** A different issue was found.
- **Follow-up required:** Additional inspection/expert assessment is needed.

Officer-submitted/verified field observation does not automatically equal laboratory- or specialist-confirmed diagnosis. Preserve this distinction.

The user's agreed default is that the assigned agricultural officer records the verification. Supervisory approval is not required by default. The system should retain an audit trail and may support optional supervisory review for selected high-impact cases later.

## 9.8 Inspection lifecycle

Suggested task statuses:

- New / pending review.
- Approved for inspection.
- Assigned.
- Accepted (optional, if workflow needs it).
- In progress.
- Submitted for completion.
- Completed — outcome recorded.
- Follow-up required.
- Cancelled / rejected with reason.

Task status is independent of alert status. A completed inspection does not automatically resolve every related alert.

## 9.9 Feedback and learning

Verified field observations should be stored as historical evidence and linked to the triggering alert/rule where possible. Over time they can support:

- Rule evaluation and calibration studies.
- Understanding false alarms and missed events.
- Local agricultural pattern analysis.
- Model training only after permissions, quality checks and expert review.

Do not automatically rewrite rule thresholds based on a small number of field reports. Use governed review and validation.

---

# 10. Situation Monitor

## 10.1 Purpose

The Situation Monitor is the officer's main geographical awareness screen. It is not the same thing as the alert centre.

- **LouNgak Watch** manages individual alert records, categories, validity and status.
- **Situation Monitor** shows the evolving geographical situation and lets officers explore layers, affected areas and related alerts.

## 10.2 Recommended content

- Manipur map and selected jurisdiction.
- H3 grid with land-cover/agricultural filters.
- Active alert footprints and spatial clusters.
- Agricultural cells/areas requiring attention.
- Registered farm boundaries only when relevant and permission allows.
- Alert category filters: weather, pest, disease, crop health, water/flood and environmental.
- Crop and district filters.
- Data availability/completeness and latest update.
- Selected cell/area detail panel with supporting evidence.
- Inspection task markers/status when the officer opens the relevant layer.
- Historical timeline for selected area/cell when data are available.

Do not show every farm, every status and every alert at once. Use progressive disclosure and layer controls to avoid clutter.

## 10.3 Combined situation summary

Provide a derived area summary such as:

- Current active weather warnings.
- Crop-related risk signals.
- Satellite observations.
- Water/environmental observations.
- Farmer reports pending review.
- Inspections pending/in progress/completed.
- Data gaps and limitations.

This is a summary over separate records, not a universal risk score.

---

# 11. Agricultural Situation Reports

## 11.1 Purpose

Generate a concise, shareable evidence-backed report for a selected district, cluster, H3 cell, farm or user-drawn area.

## 11.2 Report structure

1. Report metadata: scope, generated time and reporting period.
2. Geography: boundary/area, district association and H3 cells where relevant.
3. Crop context: known crops/varieties/growth stage and source.
4. Weather: relevant observations/forecasts and source timestamps.
5. Vegetation/crop health: NDVI/other indicators, acquisition dates, valid coverage and limitations.
6. Water/environmental observations where available.
7. Active alerts by category, priority, evidence status and validity.
8. Farmer reports/field observations, only where permissions allow and with correct verification labels.
9. Inspection assignments and outcomes relevant to the report.
10. Suggested next steps, clearly distinguished from official instructions.
11. Data provenance, missing inputs, confidence/evidence quality and limitations.

Use existing HTML/JSON reporting capabilities if they are suitable, but redesign/report schema may change. PDF can be added if valuable and reliable.

Never invent crop area, affected farmer count, verified infestation, loss estimates or impact statistics.

---

# 12. AI Assistant

## 12.1 Role

The AI Assistant is a natural-language interface to LouNgak's structured data and functions, not a free-floating chatbot.

Potential supported intents:

- Crop knowledge lookup from Crop Atlas.
- Weather questions for a location/period.
- Explanation of an alert and its evidence.
- Query about active alerts/priority areas.
- Explanation of satellite/vegetation/water observations.
- Situation summary for a selected geography.
- Report generation request, subject to permissions.
- Help with submitting a farmer report.

## 12.2 Architecture direction

Use a hybrid approach:

- Deterministic intent/routing and validated backend tools for data retrieval and risk calculations.
- Retrieval from curated Crop Atlas/advisory content for agricultural knowledge.
- LLM for explanation, summarisation and multilingual response, grounded in retrieved results.
- Permission checks before any private farm/report/inspection information is returned.

The AI should not fabricate missing observations or claim to perform an action unless the backend confirms it.

## 12.3 Languages and accessibility

Current prototype README describes English and Manipuri question handling, including Latin-script Manipuri and Meitei Mayek transliteration, with reviewed templates for some risk answers. It also states that the routing lexicon is a draft and weather answers are English-only.

New design should retain and improve this capability only after verifying implementation quality:

- English.
- Manipuri in Latin script.
- Meitei Mayek where reliable transliteration/input/output is available.
- Plain-language explanations for community users.
- Local-language alert summaries after fluent-speaker review.

Voice input/output is a future enhancement, not an MVP claim.

---

# 13. Existing project baseline and technology

This section records what the supplied `README.md` says about the existing LouNgak AI repository. Claude must verify actual implementation before making changes or claiming status.

## 13.1 Existing product features described in README

- Crop and pest risk dashboard for seven demonstration zones over Manipur farmland: Kakching, Bishnupur, Imphal West, Imphal East, Thoubal, Jiribam (near Sonapur) and Churachandpur.
- Priority list, district drill-down and a “Why is this area at risk?” panel with score breakdown, reasons and provenance.
- Explainable rule-based risk engine combining weather information, Sentinel-2 vegetation change (NDVI) and pest-report input.
- English and Manipuri questions, with Latin Manipuri and Meitei Mayek transliteration.
- Satellite analysis for drawn areas and uploaded GeoTIFFs: crop health/NDVI, water/NDWI, change over time, optical/radar analysis and optional scene description/grounding.
- Sentinel-1 radar can support water analysis when optical imagery is too cloudy.
- Optional Falcon 0.7B vision-language model with a project LoRA adapter. The README says the adapter improves yes/no questions about Sentinel-2 patches only; do not generalise its capability.
- Weather forecasts for a point inside a selected area.
- Auditable imagery answers with method, confidence/context, data sources and downloadable HTML/JSON reports.

## 13.2 Existing technology described in README

| Layer | Existing technologies |
|---|---|
| Web client | React 18, TypeScript, Vite, Tailwind CSS, MapLibre GL, Terra Draw, Zustand |
| Backend | Python, FastAPI, Uvicorn, Pydantic, httpx |
| Risk engine | Rule-based scoring under `satquery/agri/`; rules, weights and zones in data files |
| Language | Rule-based intent routing, Latin Manipuri lexicon, Meitei Mayek transliteration |
| Geospatial/imagery | Rasterio, NumPy, SciPy |
| Optional model | PyTorch, Transformers, PEFT; Falcon 0.7B and project LoRA adapter |
| External data | Open-Meteo; Copernicus Data Space Ecosystem; OSM Nominatim; OpenFreeMap/OSM; Esri World Imagery; Hugging Face model download |

The README says the Python package/settings retain the `satquery` name/prefix because the satellite-query engine is at the core. This is an implementation detail, not a naming requirement for a redesign.

## 13.3 Existing limitations explicitly described in README

These limitations must remain clear unless independently resolved and validated:

1. Prototype, not a validated prediction system. Current risk score is an inspection decision-support signal, not a probability of infestation.
2. Pest reports are synthetic/sample data and labelled as such.
3. Agronomic pest thresholds/risk weights are placeholders until expert review.
4. Seven zones are hand-drawn demonstration rectangles, not administrative boundaries.
5. NDVI measures vegetation vigour, not disease.
6. Weather is model data for one point per zone, not a network of local station observations.
7. Cloud cover can make optical vegetation information unavailable.
8. Manipuri router/lexicon has limitations; weather answers are English-only in README.
9. Imagery heuristics (spectral/radar thresholds, change maps, optical/radar agreement) are labelled as heuristics; confidence is not calibrated.
10. Live imagery retrieval for drawn areas is limited to 400 km²; radar change-over-time is not supported in the README.
11. VLM/LoRA capability is limited as described above.
12. No conversation or voice mode is implemented in the README snapshot; a future design note exists on a branch.

## 13.4 Technology selection policy for the new direction

Do not assume the old stack must be retained. Audit it and decide what should be reused, redesigned or replaced.

Candidate reusable components include MapLibre, FastAPI, Rasterio, NumPy, current Copernicus/Open-Meteo connectors, imagery processing, tests and language-routing logic.

New/expanded technology may be needed for:

- H3 indexing and geospatial aggregation.
- Persistent data storage for users, farms, alerts, reports and inspections.
- Background jobs/scheduled evaluations.
- Role-based authentication and jurisdiction permissions.
- Alert lifecycle and deduplication.
- Field Operations and mobile-first field forms.
- Crop knowledge management and retrieval.

Choose database, job queue, authentication and deployment technology after inspecting the current repository and expected prototype scale. Avoid introducing services that add complexity without a clear need.

---

# 14. Data, provenance, safety and governance

## 14.1 Candidate data sources

Use authoritative, current and appropriately licensed sources. Check actual availability, geographic coverage, terms and update frequency before integration.

| Data | Candidate source | Use |
|---|---|---|
| Weather and forecast | Open-Meteo; IMD official products | Weather context and warnings |
| Satellite optical | Copernicus Sentinel-2 | Vegetation/crop and land observations |
| Satellite radar | Copernicus Sentinel-1 | Water observations and cloud-independent radar context |
| Agricultural advisories | ICAR, KVKs, Manipur agriculture department | Crop calendars, pest/disease and management knowledge |
| Official weather warnings | IMD | Authoritative weather warning integration |
| Official flood information | CWC and other relevant authority | Flood warning/reference and exposure context |
| Disaster alerts | NDMA/SACHET | Relevant public/community warnings |
| Land cover/agricultural masks | Suitable documented/licensed datasets | Identify agricultural and non-agricultural areas |
| Administrative geography | Authoritative/licensed government sources | District/village/jurisdiction association |
| Field reports | LouNgak users/officers with consent | Ground observations and verification |

Never assume a dataset/API is available simply because an organisation publishes information online. Verify format, access, licence and update characteristics.

## 14.2 Provenance requirements

For every important assessment/alert/report, retain:

- Source/provider and dataset/product.
- Source reference/URL or retrieval ID where possible.
- Acquisition/issue time and retrieval time.
- Spatial footprint and resolution.
- Processing method and version.
- Valid-data coverage and missing-data information.
- Rule/model version.
- Human reviewer/field observer where relevant.

## 14.3 Data-quality principle

- Missing is not zero.
- Missing is not normal.
- Stale is not current.
- Cloud-obscured is not healthy.
- An anomaly is not a diagnosis.
- Farmer-reported is not verified.
- Officer-observed is not automatically laboratory-confirmed.
- A forecast is not an observed event.
- An official warning must retain its issuer and validity.

## 14.4 Privacy and security

- Minimise collection of personal information.
- Protect farmer identities, contacts, exact farm boundaries and private reports.
- Use role/jurisdiction/assignment-based access control.
- Do not publicly expose private farmer or inspection information.
- Obtain consent for photographs, precise location and personal submissions as appropriate.
- Secure credentials and secrets; never commit `.env` or service credentials.
- Retain audit logs for sensitive actions, assignments and verification changes.
- Define appropriate retention and deletion policies before production deployment.

## 14.5 Responsible action

- The system recommends; authorised people decide.
- Do not automatically allocate government aid, determine insurance eligibility or certify crop loss.
- Do not issue unsupported pesticide prescriptions.
- Make alerts actionable without causing unnecessary alarm.
- Ensure users can understand evidence, limitations and recommended verification steps.

---

# 15. MVP scope and implementation priorities

The product vision is broader than the immediate prototype. The MVP must demonstrate one coherent end-to-end workflow and avoid a large number of disconnected features.

## 15.1 Recommended MVP workflow

The strongest demonstration is:

1. Open the officer dashboard and Manipur Situation Monitor.
2. Show H3 cells and the agricultural land filter.
3. Show a supported weather or crop-health assessment and explain its source/limitations.
4. Open a separate LouNgak Watch alert.
5. Submit or show a clearly labelled demonstration farmer report.
6. Show the officer review queue and explain why the item is prioritised.
7. Assign an inspection to a field officer.
8. Record a clearly labelled demonstration field-verification outcome.
9. Show the affected-area/situation view updated and generate a simple situation report.
10. Briefly show Crop Atlas (rice/Chak-hao/maize) and explain the long-term value.

This demonstrates system-initiated detection, community-initiated reporting, officer response and human verification.

## 15.2 Immediate MVP capabilities

Prioritise in this order, subject to code audit and available time:

1. Stable, coherent application entry and two role-based dashboard experiences (community/farmer and officer). If full authentication is too much for the prototype, provide a controlled demo role switch or clearly labelled demo accounts without presenting them as production authentication.
2. Situation Monitor map with Manipur coverage and H3 prototype if feasible without destabilising the app. Use one validated analytical resolution; exact H3 resolution is chosen after testing.
3. Agricultural land filter/mask or clearly labelled demonstration land-cover layer. Do not label unsupported areas as farmland.
4. Reuse working satellite/weather capability and show data status honestly.
5. LouNgak Watch with at least weather and crop-health alert flows based on existing supported data. Add curated pest/disease knowledge advisories; do not claim validated disease/pest prediction without reviewed rules.
6. Crop Atlas with detailed, sourced profiles for rice, Chak-hao and maize.
7. Farmer issue-report form with location, category, crop, description and optional image; reports explicitly unverified.
8. Officer review queue, basic explainable priority ordering, hierarchical assignment and task status.
9. Basic mobile-friendly field inspection/verification form. Demo submissions may be simulated but must be labelled.
10. Basic Agricultural Situation Report using real available data and clearly labelled missing inputs/demo records.

## 15.3 Defer unless already implemented and stable

- Individual farm boundary mapping at scale.
- Automatic crop classification.
- Advanced disease/pest prediction models.
- Validated flood forecasting model.
- General disaster-management command centre.
- SMS/WhatsApp/push notification infrastructure.
- Complex route optimisation and automated staff scheduling.
- Voice assistant.
- Multi-state deployment.
- Full government ERP or scheme/insurance integrations.
- Large-scale farmer identity/registry integration.

## 15.4 MVP success criteria

A successful MVP should demonstrate that:

- A user can view relevant geographical agricultural information.
- The platform can present at least one traceable, evidence-backed warning/assessment using a supported data source.
- A farmer can submit a suspected issue at a location without registering an individual farm.
- The report enters an officer review queue and remains labelled unverified.
- An authorised officer can decide whether an inspection is appropriate and assign it.
- A field officer can record an observation and a clear verification outcome.
- The result is linked back to the relevant report/alert and appears in a situation view/report.
- Synthetic/demo data are clearly labelled.
- Missing data and limitations are visible.

A smaller working end-to-end flow is better than many unfinished modules.

---

# 16. Roadmap beyond the MVP

## Phase 2 — More complete operational platform

- Better role-based accounts and jurisdiction configuration.
- Optional farmer farm registration and verified farm boundaries.
- More complete crop-specific weather/pest/disease rules after expert review.
- Field Operations workload/scheduling improvements.
- Mobile-first and offline-tolerant field reporting.
- Alert subscriptions and notification preferences.
- More complete local-language content.
- Better historical H3 cell/farm timelines.
- More complete reports and analytics.

## Phase 3 — Advanced agricultural/environmental intelligence

- Expert-reviewed pest/disease risk models.
- Agricultural land/crop mapping where reliable data and validation exist.
- Historical crop-condition and hazard trend analysis.
- Better waterlogging/flood-exposure screening.
- More authoritative hazard integrations.
- Rule performance evaluation using verified field observations.
- ML models only with appropriate data, evaluation and governance.

## Phase 4 — Wider community GeoAI platform

- Configurable deployment for other Indian states.
- State-specific crops, calendars, languages, hazards and rules.
- Additional local-language/audio interaction.
- Broader environmental monitoring where it has credible public value.
- Validated disaster-resilience capabilities and official integrations.

Manipur is the initial pilot. National expansion is the long-term direction, but do not claim nationwide coverage until configured, tested and deployed.

---

# 17. Metrics and impact evaluation

Start with operational measures that can actually be collected:

- Number of H3 cells/geographical areas with valid data.
- Agricultural land area covered by valid analysis, with source/method disclosed.
- Percentage of assessments with complete versus missing input data.
- Number of alerts by category, status and evidence type.
- Number of farmer reports received and reviewed.
- Number of inspection tasks created, assigned and completed.
- Time from alert/report to officer review, assignment and inspection.
- Number/share of inspected concerns observed, not observed or inconclusive.
- Number of situation reports generated.
- Language coverage and reviewed translations.
- User testing and feedback from farmers/officers.

Longer-term outcomes to evaluate through field research:

- Whether the system helps officers prioritise inspections more effectively.
- Whether it reduces time to identify and investigate concerning areas.
- Whether farmers gain more timely access to useful information.
- Whether warning quality improves as local evidence is collected.

Do not claim improved yields, reduced crop loss, increased income or faster response unless measured in a credible evaluation.

---

# 18. Product and technical decisions register

This table consolidates decisions made in product discussions. Items marked **direction** may still require technical validation; they are not necessarily locked implementation details.

| Topic | Agreed direction | Status / note |
|---|---|---|
| Product identity | Agricultural and Environmental Intelligence Platform | Agreed |
| Core operational purpose | Early warning connected to human action | Agreed |
| Long-term ambition | Broader community GeoAI and relevant disaster preparedness | Agreed; not general disaster command system |
| Initial geography | Manipur | Agreed |
| Long-term geography | Adapt to other Indian states | Vision |
| Initial crops | Rice, dedicated Chak-hao profile, maize | Agreed |
| Crop Atlas | Detailed priority profiles | Agreed |
| Alert determination | Hybrid rules and AI | Agreed; rules determine risk, AI explains/communicates |
| Alert organisation | Separate categories plus combined situation summary | Agreed |
| Alert categories | Weather, pest, disease, crop health, water/flood, environmental/community hazard | Agreed direction |
| Alert delivery | Role-based presentation | Agreed |
| Disaster scope | Agriculture plus relevant rural-community hazards | Agreed |
| Dashboards | Two: Community & Farmer; Agricultural Officer | Agreed |
| Public access | Public Crop Atlas/advisories without account | Agreed direction |
| Farmer nearby alerts | Farmers can view relevant public surrounding-area alerts | Agreed |
| Farmer report tracking | Farmers can see own permitted report progress | Agreed |
| Farmer reporting | Farmer-initiated reports enter officer review; initially unverified | Agreed |
| Farm registration | Optional; H3 monitoring must work without registered farms | Agreed |
| Inspection assignment | Hierarchical | Agreed; exact official titles configurable |
| Field verification | Assigned field officer submits outcome | Agreed; no default supervisory approval |
| Inspection queue | Explainable priority queue and lightweight scheduling | Agreed direction |
| Situation Monitor | Map-first officer overview of H3 cells, active alerts and affected agricultural areas; contextual layers | Agreed direction; detailed UX still open |
| Geographical model | H3 hexagons with administrative boundaries, clusters and optional farm polygons | Preferred direction |
| Grid coverage | Show geographical grid with land-cover classification and an agricultural-only filter/layer | Working preference; test usability |
| Grid analytical resolution | Consistent for comparable analysis; exact value selected after testing | Open technical decision |
| Drawn polygons | Retain as custom analysis capability where useful | Direction |
| Existing architecture | Reusable but freely redesignable | Agreed; not strict preservation |
| Voice | Future | Not MVP |
| SMS/WhatsApp | Future | Not MVP |
| Validated flood prediction | Future, only with credible data/model/validation | Not MVP |

---

# 19. Open questions for technical discovery

Do not block the initial repository audit on all of these. Identify dependencies and propose choices.

1. What H3 resolution gives a useful analytical scale relative to Sentinel pixels and intended farm sizes in Manipur?
2. Which licensed/authoritative agricultural land-cover or crop mask can be used, and what is its update frequency/resolution?
3. What administrative boundary dataset can be used legally and reliably for districts/villages/jurisdictions?
4. How can point/grid weather forecasts be associated with H3 cells without overstating spatial accuracy?
5. Which IMD/CWC/NDMA warning products are programmatically accessible and under what conditions?
6. What database is appropriate for spatial records, alerts, reports, farms and inspections? Evaluate PostGIS if it fits the system.
7. What job scheduler/background processing mechanism is appropriate for periodic data retrieval, rule evaluation, alert expiry and report generation?
8. How should alert deduplication, event grouping and spatial clustering work?
9. What authentication/identity approach supports public access, farmers, field officers, district officers and senior officers?
10. What is the most reliable path for storing images and attachments securely?
11. What is the practical offline strategy for field inspections?
12. What languages and translations can be supported with fluent-speaker review?
13. Which agricultural rules can be supported by regional evidence and expert review now, and which must remain informational only?

Record decisions, trade-offs and rejected alternatives in project documentation as implementation progresses.

---

# 20. References and starting points

## Project materials

- Repository: https://github.com/brajalairen/LouNgak-AI
- Repository README: primary description of the existing prototype and its limitations.
- Product/hackathon planning summary supplied on 30 October 2026: recommended positioning, proposed features, scope, SDGs and presentation strategy.
- Hack for Social Cause portal: MY Bharat portal, VBYLD 2027. Recheck current logged-in portal for deadlines, forms and submission requirements.

## Candidate official/technical references to verify during implementation

- UN Sustainable Development Goals: https://sdgs.un.org/goals
- SDG 2: https://sdgs.un.org/goals/goal2
- SDG 6: https://sdgs.un.org/goals/goal6
- SDG 11: https://sdgs.un.org/goals/goal11
- SDG 13: https://sdgs.un.org/goals/goal13
- SDG 15: https://sdgs.un.org/goals/goal15
- Copernicus Data Space Ecosystem: https://dataspace.copernicus.eu/
- Open-Meteo: https://open-meteo.com/
- IMD: https://mausam.imd.gov.in/
- Central Water Commission: https://cwc.gov.in/
- NDMA/SACHET: https://sachet.ndma.gov.in/
- ICAR: https://icar.org.in/
- H3 geospatial indexing system: https://h3geo.org/

Check each source's current data products, licensing, access and technical terms before building an integration. The presence of a link here does not prove an API or dataset is available for the intended use.

---

# 21. Final product principle

LouNgak AI should be:

- **Evidence-driven:** Every meaningful alert and assessment has traceable sources, timestamps and limitations.
- **Geographically aware:** It understands cells, agricultural areas, farms and administrative boundaries without confusing them.
- **Crop-aware:** It uses regional crop knowledge and only applies crop-specific logic when crop context is sufficiently known.
- **Early-warning oriented:** It seeks to identify concerning conditions early, without overstating certainty.
- **Action-oriented:** It connects alerts and farmer reports to officer review, inspection assignment and field verification.
- **Human-centred:** Farmers receive accessible information; officers receive evidence and operational tools; people remain responsible for consequential decisions.
- **Locally grounded and scalable:** Manipur is the pilot, with a configurable path to other Indian states.

> **Core message:** LouNgak AI helps agricultural communities and authorities move from geospatial observation to early warning, prioritised field verification and informed action.

**End of foundation document.**
