"""Field operations: farmer reports, the officer review queue, inspection tasks and field verification.

Two entry paths reach the same officer workflow: a system alert (LouNgak Watch) or a farmer's report.
Every record keeps its origin, its evidence status and a status history, so a farmer's report is never
shown as verified and an officer's field observation is never shown as a laboratory diagnosis.
"""
