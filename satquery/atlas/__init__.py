"""Crop Atlas: source-backed crop profiles shared by the dashboards, the alerts and the assistant.

Profiles are data (`assets/crops.json`). Every section states whether it is SOURCED, TO_VERIFY or
SOURCE_NEEDED, and the whole set stays DRAFT until an agronomist or KVK has reviewed it. Nothing here
recommends a pesticide or a dose.

  GET /api/atlas/crops        every profile (public)
"""

import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

ASSETS = Path(__file__).resolve().parent / "assets"
SectionStatus = Literal["SOURCED", "TO_VERIFY", "SOURCE_NEEDED"]


class AtlasSource(BaseModel):
    id: str
    title: str
    publisher: str
    year: str | None
    url: str


class LocalName(BaseModel):
    name: str
    language: str
    status: SectionStatus


class CropSection(BaseModel):
    title: str
    status: SectionStatus
    sources: list[str]  # AtlasSource ids
    items: list[str]


class CropMonitoring(BaseModel):
    can: list[str]
    cannot: list[str]


class CropProfile(BaseModel):
    id: str
    name: str
    scientific_name: str
    local_names: list[LocalName]
    category: str
    summary: str
    sections: list[CropSection]
    monitoring: CropMonitoring
    related_alerts: list[str]
    last_reviewed: str | None


class CropAtlas(BaseModel):
    version: str
    status: Literal["DRAFT", "REVIEWED"]
    note: str
    sources: list[AtlasSource]
    crops: list[CropProfile]


def load_atlas(path: Path | None = None) -> CropAtlas:
    atlas = CropAtlas.model_validate(json.loads((path or ASSETS / "crops.json").read_text(encoding="utf-8")))
    known = {s.id for s in atlas.sources}
    for crop in atlas.crops:
        for section in crop.sections:
            unknown = set(section.sources) - known
            if unknown:
                raise ValueError(f"{crop.id} / {section.title}: unknown source id(s) {sorted(unknown)}")
            if section.status == "SOURCED" and not section.sources:
                raise ValueError(f"{crop.id} / {section.title}: SOURCED needs at least one source")
    return atlas


def atlas_router() -> APIRouter:
    router = APIRouter(prefix="/api/atlas", tags=["crop atlas"])
    atlas = load_atlas()

    @router.get("/crops", response_model=CropAtlas)
    def crops():
        return atlas

    return router
