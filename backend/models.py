from pydantic import BaseModel
from typing import Optional


class EventInfo(BaseModel):
    round: int
    name: str
    country: str
    date: str


class SessionInfo(BaseModel):
    session_id: str
    year: int
    round: int
    name: str
    session_type: str
    total_laps: int
    drivers: list[str]


class DriverPosition(BaseModel):
    driver: str
    number: str
    x: float
    y: float
    color: str


class TrackPoint(BaseModel):
    x: float
    y: float


class TelemetryPoint(BaseModel):
    distance: float
    speed: float
    throttle: float
    brake: bool
    gear: int
    drs: int
    x: float
    y: float


class StandingsEntry(BaseModel):
    position: int
    driver: str
    team: str
    color: str
    gap: str
    tyre: Optional[str] = None
    tyre_age: Optional[int] = None
    status: str
