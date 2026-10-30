"""LouNgak Watch: category-specific alerts derived from the risk engine's evidence.

Rules decide; nothing here invents a number. Each alert keeps its category, its priority and its
evidence status as separate fields, says which rule produced it and how far that rule is validated,
and passes a publishing gate: an alert from a placeholder or unvalidated rule is published only as a
qualified watch with its limitations stated.
"""
