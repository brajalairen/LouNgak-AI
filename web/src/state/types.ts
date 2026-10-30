/**
 * Wire types, mirroring satquery/schemas.py and the Pydantic models in satquery/server.py.
 * Field names match the Python side exactly; change them together.
 */

export type Modality = "optical" | "sar";
/** "area_only": a drawn area and no imagery, as for a weather question (optional capability). */
export type InputConfig = "single_optical" | "single_sar" | "pair_cross_modal" | "pair_bitemporal" | "area_only";
export type TaskType =
  | "vqa"
  | "caption"
  | "grounding"
  | "change_analysis"
  | "cross_modal_analysis"
  | "weather_forecast"
  /** Crop health: vegetation vigour from NDVI (red + NIR), never a VLM guess. */
  | "crop_health";
export type Severity = "error" | "warning";
export type StepStatus = "ok" | "failed" | "skipped";
export type ResponseStatus = "ok" | "partial" | "invalid_input" | "error";

export interface ImageSummary {
  index: number;
  name: string;
  modality: Modality;
  width: number;
  height: number;
  bands: string[];
  crs: string | null;
  acquired: string | null;
  decimation: number;
  /** null whenever the image carries no CRS + transform: it cannot be placed on the map. */
  bounds_wgs84: [number, number, number, number] | null;
  corners_wgs84: [number, number][] | null;
  georeference_note: string | null;
}

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  image_index: number | null;
}

export interface Intent {
  task: TaskType;
  target: string | null;
  comparative: boolean;
  matched_rule: string;
}

export interface PlanStep {
  step_id: string;
  tool: string;
  image_indices: number[];
  params: Record<string, unknown>;
  purpose: string;
}

export interface Evidence {
  kind: "bbox" | "mask" | "overlay" | "metric";
  label: string;
  image_index: number | null;
  bbox: [number, number, number, number] | null;
  fraction: number | null;
  value: number | string | null;
  /** A /api/runs/... URL once the server has rewritten it. */
  file: string | null;
  source_step: string;
}

export interface Confidence {
  value: number | null;
  /** How the number was produced. Always shown: these values are uncalibrated. */
  method: string;
  calibrated: boolean;
  note: string | null;
}

export interface StepResult {
  step_id: string;
  tool: string;
  model: string | null;
  status: StepStatus;
  params: Record<string, unknown>;
  outputs: Record<string, unknown>;
  evidence: Evidence[];
  confidence: Confidence | null;
  error: string | null;
  duration_s: number;
}

export interface ExecutionTrace {
  run_id: string;
  created_at: string;
  query: string;
  input_config: InputConfig | null;
  images: ImageSummary[];
  validation: ValidationIssue[];
  intent: Intent | null;
  plan: PlanStep[];
  steps: StepResult[];
  total_duration_s: number;
}

export interface AnalysisResponse {
  status: ResponseStatus;
  task: TaskType | null;
  answer: string;
  evidence: Evidence[];
  confidence: Confidence | null;
  trace: ExecutionTrace;
  report_html: string | null;
  report_json: string | null;
}

export interface OverlayLayer {
  url: string;
  label: string;
  image_index: number;
  corners_wgs84: [number, number][];
  /** The source grid is rotated, so the four-corner placement is an approximation. */
  approximate: boolean;
}

/** Whether a drawn area actually narrowed the analysis. Absent when no area was sent. */
export interface AreaScope {
  applied: boolean;
  reason: string | null;
  width: number | null;
  height: number | null;
  source_width: number | null;
  source_height: number | null;
  /** Pixels outside a drawn circle or polygon were excluded, not merely cropped to its box. */
  masked: boolean;
}

export interface AnalyzeResult {
  response: AnalysisResponse;
  overlay_layers: OverlayLayer[];
  area: AreaScope | null;
  /** The uploads this result ran on, in input order. */
  upload_ids: string[];
  /** Present only for a weather answer: where and when the forecast came from. */
  weather?: WeatherInfo | null;
}

/** Provenance of a weather answer. Mirrors satquery.server.WeatherInfo. */
export interface WeatherInfo {
  provider: string;
  model: string | null;
  /** Required with the data (CC BY 4.0): always shown with a forecast. */
  attribution: string;
  attribution_url: string;
  area_source: "drawn area" | "image footprint";
  area_bbox_wgs84: [number, number, number, number];
  /** East-west, north-south, in km. */
  area_extent_km: [number, number];
  /** (longitude, latitude) the forecast is for: the marker on the map. */
  point_wgs84: [number, number];
  /** The provider's model grid point, which can differ slightly from the point asked for. */
  grid_point_wgs84: [number, number] | null;
  elevation_m: number | null;
  timezone: string | null;
  /** Local dates, first and last. */
  period: [string, string] | null;
  retrieved_at: string | null;
  cached: boolean;
}

/** Which specialist a question is for. Mirrors satquery.server.RouteResult. */
export interface RouteResult {
  /** "agri": a crop & pest risk question, answered by the risk engine (/api/agri/query). */
  route: "weather" | "imagery" | "mixed" | "agri";
  rule: string;
  /** For "mixed": what to do instead. */
  message: string | null;
  /** The question's language, read from its words (Latin Manipuri via the reviewed lexicon). */
  language: "english" | "latin_manipuri";
  /** The common intent (e.g. "AREA_RISK_QUERY") the route answers, when one applies. */
  intent: string | null;
}

export interface UploadInfo {
  id: string;
  name: string;
  modality: Modality;
  acquired: string | null;
  summary: ImageSummary;
  preview_url: string;
  /** false for PNG/JPEG and CRS-less TIFFs, which are shown off-map instead. */
  mappable: boolean;
  /** How `modality` was decided at upload (e.g. "from band descriptions VV, VH"). Absent for demo
   *  scenarios and retrieved scenes, whose source fixes it. */
  modality_basis?: string | null;
}

export interface Example {
  index: number;
  label: string;
  query: string;
  images: { path: string; modality?: Modality; acquired?: string }[];
}

export interface Health {
  status: "ok";
  vlm_backend: string;
  device: string;
  /** true when a labelled stand-in is answering instead of the real model. */
  model_is_fake: boolean;
  /** Imagery source name when retrieval is configured, else null. Never a credential. */
  imagery_provider: string | null;
  /** Whether imagery can be fetched for a drawn area instead of uploading a GeoTIFF. */
  imagery_available: boolean;
  /** Weather forecast source when enabled, else null. Never a credential. */
  weather_provider: string | null;
  weather_available: boolean;
}

/** Provenance for one retrieved scene. Mirrors satquery.providers.SceneMetadata. */
export interface SceneMetadata {
  provider: string;
  collection: string;
  satellite: string;
  product_level: string;
  acquired: string;
  acquired_datetime: string;
  cloud_cover: number | null;
  bbox_wgs84: [number, number, number, number];
  crs: string;
  resolution_m: number;
  bands: string[];
  width: number;
  height: number;
  scene_id: string | null;
  attribution: string;
  cached: boolean;
  alternatives_considered: number;
  /** How the raster was produced (Process API, one day only, reflectance, grid). */
  processing: string;
  /** "sar" for a Sentinel-1 scene retrieved to pair with an optical one. */
  modality?: Modality;
}

/** One retrieved scene, registered as an upload. Mirrors satquery.server.FetchedScene. */
export interface FetchedScene {
  role: "single" | "before" | "after" | "optical" | "sar";
  upload: UploadInfo;
  metadata: SceneMetadata;
}

/** A period searched for one scene of a comparison. Never an acquisition date. */
export interface ComparisonWindow {
  start: string;
  end: string;
  label: string;
}

/** How the two dates of a comparison were chosen. Mirrors satquery.server.TemporalInfo. */
export interface TemporalInfo {
  basis: string;
  explanation: string;
  before_window: ComparisonWindow;
  after_window: ComparisonWindow;
  days_apart: number;
}

/** How the SAR scene was matched to the optical one. Mirrors satquery.server.CrossModalInfo. */
export interface CrossModalInfo {
  days_apart: number;
  max_days_apart: number;
  explanation: string;
}

/** How much of the selected area an optical scene shows, and whether it was usable for a water or
 *  crop-health question. Mirrors satquery.server.OpticalQualityInfo. Never the tile's catalogue cloud cover. */
export interface OpticalQualityInfo {
  /** What the check was for. Only water has a radar fallback; radar cannot measure NDVI. */
  purpose: "water" | "vegetation";
  /** The optical scene that was assessed. */
  scene: SceneMetadata;
  pixels: number;
  clear_pixels: number;
  /** Cloud, cloud shadow or no data, as a share of the selected area. */
  affected_fraction: number;
  class_fractions: Record<string, number>;
  /** The configured limit: an operating heuristic, not a scientific constant. */
  max_affected_fraction: number;
  min_clear_pixels: number;
  usable: boolean;
  /** Why the optical scene was not used. */
  reason: string | null;
  method: string;
  /** The affected pixels were left out of the optical analysis. */
  masked: boolean;
  /** Crop health: every date judged for the area, in the order tried; the last one is the scene used. */
  scenes_checked: SceneCheck[];
}

/** One Sentinel-2 date judged for a crop-health question by the area's own scene classification. */
export interface SceneCheck {
  acquired: string;
  /** Cloud, cloud shadow or no data, as a share of the selected area. */
  affected_fraction: number;
}

export interface FetchImageryResult {
  /** "temporal" when the question needs two dates; "cross_modal" when it asks for optical and SAR
   *  together; "sar" when it asks for radar alone; "sar_fallback" when a water question's optical
   *  scene was too obscured and Sentinel-1 answers instead. */
  mode: "single" | "temporal" | "cross_modal" | "sar" | "sar_fallback";
  /** The most recent scene (the optical one of a sensor pair), kept for single-date clients. */
  upload: UploadInfo;
  metadata: SceneMetadata;
  /** Every scene retrieved: oldest first, or optical then SAR. */
  images: FetchedScene[];
  temporal: TemporalInfo | null;
  cross_modal?: CrossModalInfo | null;
  /** Present whenever a water question's optical scene was assessed. */
  optical_quality?: OpticalQualityInfo | null;
  cached: boolean;
}

/** Structured retrieval failure. `code` distinguishes the cause; never contains credentials. */
export interface RetrievalProblem {
  code: string;
  message: string;
  detail?: string;
}

/* ------------------------------------------------------------------ crop & pest risk
 * Mirrors satquery/agri/models.py and satquery/agri/routes.py. Every figure here is computed by the
 * risk engine on the server; the dashboard only presents it. */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "INSUFFICIENT_DATA";
/** SNAPSHOT: from the frozen, known-good assessment file; never shown as live. */
export type DataState = "LIVE" | "CACHED" | "SNAPSHOT" | "SAMPLE" | "UNAVAILABLE";
export type ThresholdStatus = "PLACEHOLDER" | "VERIFIED";
export type FactorStatus = "ok" | "partial" | "unavailable";
export type FactorId = "weather_pest" | "ndvi_anomaly" | "report_pressure";

export interface AgriProvenance {
  source: string;
  state: DataState;
  retrieved_at: string | null;
  covers: string | null;
  licence: string | null;
  note: string | null;
}

export interface PestReport {
  id: string;
  area_id: string | null;
  latitude: number;
  longitude: number;
  observed_on: string;
  crop: string;
  pest: string;
  severity: "low" | "moderate" | "high";
  source: "SAMPLE";
  synthetic: boolean;
  verified: boolean;
  label: string;
}

export interface DayCheck {
  date: string;
  period: "past" | "forecast";
  /** null: not enough hourly data that day to judge. */
  favourable: boolean | null;
  values: Record<string, number | null>;
  unmet: string[];
}

export interface PestEvaluation {
  pest_id: string;
  name: string;
  crop: string;
  status: FactorStatus;
  index: number | null;
  favourable_past: number;
  known_past: number;
  past_days: number;
  favourable_forecast: number;
  known_forecast: number;
  forecast_days: number;
  longest_run: number;
  full_score_days: number;
  conditions: string[];
  thresholds: ThresholdStatus;
  sources: Record<string, string | null>[];
  explanation: string;
  days: DayCheck[];
}

export interface NdviWindow {
  label: string;
  start: string;
  end: string;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  pixels: number;
  observed_fraction: number;
  usable: boolean;
  reason: string | null;
  state: DataState;
  retrieved_at: string | null;
}

export interface NdviAnomaly {
  current: NdviWindow;
  baseline: NdviWindow[];
  baseline_mean: number | null;
  baseline_range: [number, number] | null;
  baseline_years_used: number;
  relative_change: number | null;
  absolute_change: number | null;
  within_baseline_range: boolean | null;
  resolution_deg: number;
  method: string;
}

export interface WeatherFigures {
  days: number;
  mean_temperature_c: number | null;
  min_temperature_c: number | null;
  max_temperature_c: number | null;
  mean_relative_humidity_pct: number | null;
  hours_rh_at_or_above_90: number;
  precipitation_mm: number | null;
}

/** The engine's per-factor details; which keys are present depends on the factor. */
export interface FactorDetails {
  driver?: string;
  weather_summary?: { past_7_days: WeatherFigures; next_7_days: WeatherFigures };
  point?: { latitude: number; longitude: number };
  anomaly?: NdviAnomaly;
  count?: number;
  weighted?: number;
  by_pest?: Record<string, number>;
  by_severity?: Record<string, number>;
  lookback_days?: number;
  reports?: PestReport[];
}

export interface FactorResult {
  id: FactorId;
  name: string;
  status: FactorStatus;
  score: number | null;
  weight: number;
  availability: number;
  /** This factor's share of the 0-100 score; the points of all factors sum to the score. */
  points: number | null;
  summary: string;
  reasons: string[];
  details: FactorDetails;
  provenance: AgriProvenance[];
  thresholds: ThresholdStatus | null;
  unavailable_reason: string | null;
  sample_data: boolean;
}

export interface RiskConfidence {
  level: "low" | "medium" | "high";
  data_completeness: number;
  method: string;
  calibrated: boolean;
  notes: string[];
}

export interface RiskAssessment {
  area_id: string;
  area_name: string;
  area_kind: string;
  as_of: string;
  score: number | null;
  level: RiskLevel;
  headline: string;
  reasons: string[];
  top_factors: string[];
  factors: FactorResult[];
  pests: PestEvaluation[];
  confidence: RiskConfidence;
  provenance: AgriProvenance[];
  thresholds_status: ThresholdStatus;
  includes_sample_data: boolean;
  disclaimer: string;
  rank: number | null;
  rank_of: number | null;
  district_context: Record<string, string | null> | null;
}

export interface AreaSummary {
  id: string;
  name: string;
  kind: "district" | "custom" | "demo";
  /** True only for an administrative district from a named dataset. */
  official_boundary: boolean;
  boundary_source: string;
  district: string | null;
  state: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  label_point: [number, number];
  bounds: [number, number, number, number];
  rank: number | null;
  rank_of: number | null;
  level: RiskLevel;
  score: number | null;
  headline: string;
  confidence: "low" | "medium" | "high";
  data_completeness: number;
  top_factors: string[];
  factor_points: Record<FactorId, number | null>;
  factor_status: Record<FactorId, FactorStatus>;
  includes_sample_data: boolean;
  thresholds_status: ThresholdStatus;
}

export interface AgriOverview {
  computed_at: string;
  as_of: string | null;
  region: string;
  view_bounds: [number, number, number, number] | null;
  thresholds_status: ThresholdStatus;
  /** Set while thresholds are placeholders. */
  thresholds_note: string | null;
  includes_sample_data: boolean;
  sample_label: string;
  disclaimer: string;
  area_note: string;
  official_boundaries: boolean;
  offline: boolean;
  data_states: DataState[];
  counts: Record<RiskLevel, number>;
  examples: string[];
  areas: AreaSummary[];
  /** "snapshot" when the frozen snapshot is shown instead of live data. */
  mode: "live" | "snapshot";
  snapshot_saved_at: string | null;
  /** Why the snapshot is shown (snapshot mode, or live data incomplete). */
  fallback_reason: string | null;
  pest_thresholds_status: ThresholdStatus;
  risk_weights_status: ThresholdStatus;
  /** Districts as administrative context, in the order of their highest-priority zone. */
  districts: DistrictSummary[];
  district_note: string;
  zone_count: number;
}

/** A district is never scored: its level, score and confidence are those of its highest-priority
 *  monitored zone, and null when it has no monitoring coverage (which is not "no risk"). */
export interface DistrictSummary {
  name: string;
  listed: boolean;
  rank: number | null;
  coverage: "monitored" | "not_monitored";
  zone_count: number;
  zone_ids: string[];
  level_counts: Record<RiskLevel, number>;
  top_zone_id: string | null;
  level: RiskLevel | null;
  score: number | null;
  confidence: "low" | "medium" | "high" | null;
  best_zone_rank: number | null;
  /** True only when verified district boundaries are loaded. */
  has_boundary: boolean;
  boundary_source: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  bounds: [number, number, number, number] | null;
}

export interface AgriAreaDetail {
  area: AreaSummary;
  assessment: RiskAssessment;
  boundary_note: string;
  thresholds_note: string | null;
  sample_label: string;
}

export interface AgriQueryResult {
  intent: "rank" | "inspect" | "explain" | "unmatched";
  matched_rule: string;
  answer: string;
  area_ids: string[];
  focus_area_id: string | null;
  computed_at: string;
  thresholds_status: ThresholdStatus;
  includes_sample_data: boolean;
  disclaimer: string;
  language: "english" | "latin_manipuri";
  /** The common intent the question was read as; null when it must be rephrased. */
  common_intent: string | null;
}

/* ------------------------------------------------------------------ field operations & LouNgak Watch
 * Mirrors satquery/ops/models.py, satquery/watch/alerts.py, satquery/grid.py and satquery/atlas.
 * Category, priority and evidence status are separate fields on purpose: a forecast can be high
 * priority and still only a forecast. */

export type Role = "farmer" | "field_officer" | "district_officer" | "state_officer";
export type Priority = "low" | "moderate" | "high" | "urgent";
export type ReportCategory = "pest" | "disease" | "crop_damage" | "waterlogging" | "weather_damage" | "other";
export type CropId = "rice" | "chakhao" | "maize" | "other" | "unknown";
export type ReportStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INSPECTION_ASSIGNED"
  | "INSPECTED"
  | "FOLLOW_UP"
  | "DISMISSED";
export type TaskStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type OutcomeResult =
  | "CONCERN_OBSERVED"
  | "CONCERN_NOT_OBSERVED"
  | "INCONCLUSIVE"
  | "DIFFERENT_ISSUE"
  | "FOLLOW_UP_REQUIRED";
export type AlertCategory = "weather" | "pest" | "disease" | "crop_health" | "water_flood" | "environment";
export type EvidenceStatus =
  | "forecast"
  | "rule_triggered"
  | "satellite_observed"
  | "farmer_reported"
  | "field_verified"
  | "official_warning";
export type CropCondition = "normal" | "stressed" | "damaged" | "not_visible";
export type WaterCondition = "none" | "waterlogged" | "flooded" | "dry";

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  /** A configurable job title, not an official designation. */
  title: string;
  /** Jurisdiction; empty means every district (state level). */
  districts: string[];
  is_demo: boolean;
}

export interface OpsPeople {
  users: DemoUser[];
  note: string;
}

export interface StatusChange {
  status: string;
  at: string;
  by: string;
  by_name: string;
  note: string | null;
}

export interface OfficerNote {
  at: string;
  by: string;
  by_name: string;
  text: string;
}

export interface ReportCreate {
  category: ReportCategory;
  crop: CropId;
  growth_stage: string | null;
  description: string;
  latitude: number;
  longitude: number;
  location_source: "map_pin" | "device_gps";
  district: string;
  consent: boolean;
}

export interface FarmerReport {
  id: string;
  category: ReportCategory;
  crop: CropId;
  growth_stage: string | null;
  description: string;
  latitude: number;
  longitude: number;
  location_source: "map_pin" | "device_gps";
  district: string;
  h3_cell: string;
  zone_id: string | null;
  reporter_id: string;
  reporter_name: string;
  submitted_at: string;
  status: ReportStatus;
  evidence_status: "farmer_reported_unverified";
  task_id: string | null;
  public_outcome: string | null;
  history: StatusChange[];
  /** Internal; always empty in a farmer's own view. */
  officer_notes: OfficerNote[];
  is_demo: boolean;
}

export interface OutcomeCreate {
  result: OutcomeResult;
  observed_crop: CropId;
  growth_stage: string | null;
  crop_condition: CropCondition;
  symptoms: string | null;
  /** A suspicion, not a diagnosis. */
  suspected_issue: string | null;
  water_condition: WaterCondition | null;
  action_taken: string | null;
  follow_up: string | null;
  public_summary: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_accuracy_m: number | null;
}

export interface InspectionOutcome {
  result: OutcomeResult;
  observed_crop: CropId;
  growth_stage: string | null;
  crop_condition: CropCondition;
  symptoms: string | null;
  suspected_issue: string | null;
  water_condition: WaterCondition | null;
  action_taken: string | null;
  follow_up: string | null;
  public_summary: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_accuracy_m: number | null;
  recorded_by: string;
  recorded_by_name: string;
  recorded_at: string;
  evidence_status: "field_observed_officer";
}

export interface TaskCreate {
  report_ids: string[];
  alert_ids: string[];
  reason: string;
  priority: Priority;
  priority_rationale: string[];
  assigned_to: string | null;
  due_on: string | null;
}

export interface InspectionTask {
  id: string;
  report_ids: string[];
  alert_ids: string[];
  latitude: number;
  longitude: number;
  h3_cell: string;
  district: string;
  zone_id: string | null;
  crop: string;
  reason: string;
  priority: Priority;
  priority_rationale: string[];
  created_by: string;
  created_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_on: string | null;
  status: TaskStatus;
  history: StatusChange[];
  outcome: InspectionOutcome | null;
  is_demo: boolean;
}

export interface QueueItem {
  kind: "report" | "alert";
  id: string;
  title: string;
  district: string | null;
  zone_id: string | null;
  priority: Priority;
  evidence_status: string;
  /** Why it sits where it does in the queue, in words. */
  reasons: string[];
  created_at: string;
  latitude: number;
  longitude: number;
  is_demo: boolean;
}

export interface ZoneSituation {
  zone_id: string;
  zone_name: string;
  district: string | null;
  alerts_by_category: Record<string, number>;
  reports_open: number;
  tasks_open: number;
  tasks_completed: number;
  outcomes: Record<string, number>;
}

export interface Alert {
  id: string;
  category: AlertCategory;
  subtype: string;
  title: string;
  summary: string;
  priority: Priority;
  evidence_status: EvidenceStatus;
  /** qualified_watch: published only with its limitations stated (placeholder or unvalidated rule). */
  gate: "published" | "qualified_watch";
  rule_id: string;
  rule_status: "SOURCED" | "PLACEHOLDER" | "UNVALIDATED" | "DEMO";
  zone_id: string;
  zone_name: string;
  district: string | null;
  label_point: [number, number];
  issued_at: string;
  valid_from: string;
  valid_until: string;
  evidence: string[];
  limitations: string[];
  recommended_action: string;
  provenance: AgriProvenance[];
  status: "active" | "acknowledged";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  is_demo: boolean;
}

export interface WatchOverview {
  computed_at: string;
  assessment_mode: "live" | "snapshot";
  categories: Record<AlertCategory, string>;
  counts: Record<AlertCategory, number>;
  alerts: Alert[];
  notes: string[];
}

export interface GridZones {
  resolution: number;
  mean_cell_area_km2: number;
  cell_count: number;
  note: string;
  /** Properties: cell, zone_id, zone_name, district. */
  cells: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
}

export type SectionStatus = "SOURCED" | "TO_VERIFY" | "SOURCE_NEEDED";

export interface AtlasSource {
  id: string;
  title: string;
  publisher: string;
  year: string | null;
  url: string;
}

export interface LocalName {
  name: string;
  language: string;
  status: SectionStatus;
}

export interface CropSection {
  title: string;
  status: SectionStatus;
  sources: string[];
  items: string[];
}

export interface CropMonitoring {
  can: string[];
  cannot: string[];
}

export interface CropProfile {
  id: string;
  name: string;
  scientific_name: string;
  local_names: LocalName[];
  category: string;
  summary: string;
  sections: CropSection[];
  monitoring: CropMonitoring;
  related_alerts: string[];
  last_reviewed: string | null;
}

export interface CropAtlas {
  version: string;
  status: "DRAFT" | "REVIEWED";
  note: string;
  sources: AtlasSource[];
  crops: CropProfile[];
}
