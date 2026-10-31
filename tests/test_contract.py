"""The web client's wire types (web/src/state/types.ts) mirror the Python models by hand. This keeps
the two from drifting apart: every interface must list exactly the fields its model sends."""

import re
from pathlib import Path

import pytest

from satquery import agmap, atlas, schemas, server
from satquery.agri import models as agri_models, routes as agri_routes
from satquery.ops import models as ops_models
from satquery.watch import alerts

TYPES_TS = Path(__file__).resolve().parent.parent / "web" / "src" / "state" / "types.ts"

MIRRORED = {
    "ImageSummary": schemas.ImageSummary,
    "ValidationIssue": schemas.ValidationIssue,
    "Intent": schemas.Intent,
    "PlanStep": schemas.PlanStep,
    "Evidence": schemas.Evidence,
    "Confidence": schemas.Confidence,
    "StepResult": schemas.StepResult,
    "ExecutionTrace": schemas.ExecutionTrace,
    "AnalysisResponse": schemas.AnalysisResponse,
    "OverlayLayer": server.OverlayLayer,
    "AreaScope": server.AreaScope,
    "AnalyzeResult": server.AnalyzeResult,
    "UploadInfo": server.UploadInfo,
    "Example": server.Example,
    "FetchImageryResult": server.FetchImageryResult,
    "FetchedScene": server.FetchedScene,
    "ComparisonWindow": server.ComparisonWindow,
    "TemporalInfo": server.TemporalInfo,
    "Health": server.Health,
    "WeatherInfo": server.WeatherInfo,
    "RouteResult": server.RouteResult,
    "OpticalQualityInfo": server.OpticalQualityInfo,
    "SceneCheck": server.SceneCheck,
    # Crop & pest risk dashboard
    "AgriProvenance": agri_models.Provenance,
    "PestReport": agri_models.PestReport,
    "DayCheck": agri_models.DayCheck,
    "PestEvaluation": agri_models.PestEvaluation,
    "NdviWindow": agri_models.NdviWindow,
    "NdviAnomaly": agri_models.NdviAnomaly,
    "FactorResult": agri_models.FactorResult,
    "RiskConfidence": agri_models.RiskConfidence,
    "RiskAssessment": agri_models.RiskAssessment,
    "AreaSummary": agri_routes.AreaSummary,
    "AgriOverview": agri_routes.AgriOverview,
    "AgriAreaDetail": agri_routes.AgriAreaDetail,
    "AgriQueryResult": agri_routes.AgriQueryResult,
    "DistrictSummary": agri_routes.DistrictSummary,
    # Field operations, LouNgak Watch, agricultural map and Crop Atlas
    "DemoUser": ops_models.DemoUser,
    "OpsPeople": ops_models.OpsPeople,
    "StatusChange": ops_models.StatusChange,
    "OfficerNote": ops_models.OfficerNote,
    "ReportCreate": ops_models.ReportCreate,
    "FarmerReport": ops_models.FarmerReport,
    "OutcomeCreate": ops_models.OutcomeCreate,
    "InspectionOutcome": ops_models.InspectionOutcome,
    "TaskCreate": ops_models.TaskCreate,
    "InspectionTask": ops_models.InspectionTask,
    "QueueItem": ops_models.QueueItem,
    "ZoneSituation": ops_models.ZoneSituation,
    "Alert": alerts.Alert,
    "WatchOverview": alerts.WatchOverview,
    "LayerSource": agmap.LayerSource,
    "CropLegendEntry": agmap.CropLegendEntry,
    "DistrictEntry": agmap.DistrictEntry,
    "AgMap": agmap.AgMap,
    "CropShare": agmap.CropShare,
    "LandCoverShare": agmap.LandCoverShare,
    "CellDetail": agmap.CellDetail,
    "AtlasSource": atlas.AtlasSource,
    "LocalName": atlas.LocalName,
    "CropSection": atlas.CropSection,
    "CropMonitoring": atlas.CropMonitoring,
    "CropProfile": atlas.CropProfile,
    "CropAtlas": atlas.CropAtlas,
}


def interface_fields(source: str, name: str) -> set[str]:
    block = re.search(rf"export interface {name} \{{\n(.*?)\n\}}", source, re.S)
    assert block, f"interface {name} not found in types.ts"
    # Top-level members are indented two spaces; nested object types stay on one line.
    return set(re.findall(r"^  (\w+)\??:", block.group(1), re.M))


@pytest.mark.parametrize("name", sorted(MIRRORED))
def test_web_types_match_the_python_models(name):
    source = TYPES_TS.read_text(encoding="utf-8")
    assert interface_fields(source, name) == set(MIRRORED[name].model_fields), f"{name} differs between types.ts and Python"
