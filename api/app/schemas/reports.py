"""
Report schemas — Pydantic models for analytics/report endpoints.
"""

from pydantic import BaseModel, Field


class AgentSummaryRow(BaseModel):
    """One row in the agent summary report — stats for a single extension."""
    agent: str = Field(description="Extension number (src)")
    display_name: str | None = Field(default=None, description="Extension display name")
    calls: int = Field(default=0, description="Total calls")
    unique_calls: int = Field(default=0, description="Unique destination numbers")
    ring_time: int = Field(default=0, description="Total ring time in seconds (duration - billsec)")
    talk_time: int = Field(default=0, description="Total talk time in seconds (billsec)")
    total_time: int = Field(default=0, description="Total time in seconds (duration)")
    answered: int = Field(default=0, description="Answered calls count")
    no_answer: int = Field(default=0, description="Not answered calls count")
    asr: float = Field(default=0.0, description="Answer-Seizure Ratio (answered/total * 100)")
    acd: float = Field(default=0.0, description="Average Call Duration in seconds (avg billsec where billsec > 0)")


class AgentSummaryResponse(BaseModel):
    """Response for agent summary report."""
    items: list[AgentSummaryRow]
    date_from: str | None = None
    date_to: str | None = None
    total_calls: int = 0
    total_answered: int = 0
    total_talk_time: int = 0
