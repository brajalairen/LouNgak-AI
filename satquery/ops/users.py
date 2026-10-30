"""Demo accounts and who is asking.

The prototype has no sign-in: the web client sends the chosen demo account in the `X-Demo-User`
header. The accounts are labelled as demo everywhere, and the server enforces each role's permissions
and jurisdiction exactly as it would for a signed-in user, so the access rules are real even though the
identity is not. Titles are configurable placeholders, not official designations.
"""

from fastapi import Header, HTTPException

from satquery.ops.models import DemoUser

DEMO_USERS = [
    DemoUser(id="farmer-bishnupur", name="Demo farmer (Bishnupur)", role="farmer", title="Farmer",
             districts=["Bishnupur"]),
    DemoUser(id="farmer-thoubal", name="Demo farmer (Thoubal)", role="farmer", title="Farmer",
             districts=["Thoubal"]),
    DemoUser(id="field-bishnupur", name="Demo field officer (Bishnupur)", role="field_officer",
             title="Agricultural field officer", districts=["Bishnupur"]),
    DemoUser(id="field-valley", name="Demo field officer (Thoubal, Kakching)", role="field_officer",
             title="Agricultural field officer", districts=["Thoubal", "Kakching"]),
    DemoUser(id="district-bishnupur", name="Demo district officer (Bishnupur)", role="district_officer",
             title="District agricultural officer", districts=["Bishnupur"]),
    DemoUser(id="district-thoubal", name="Demo district officer (Thoubal, Kakching)", role="district_officer",
             title="District agricultural officer", districts=["Thoubal", "Kakching"]),
    DemoUser(id="state-officer", name="Demo state-level officer", role="state_officer",
             title="State-level agricultural officer", districts=[]),
]
USERS = {u.id: u for u in DEMO_USERS}
OFFICER_ROLES = ("district_officer", "state_officer")


def covers(user: DemoUser, district: str | None) -> bool:
    """Whether `district` is inside the user's jurisdiction. State level covers every district."""
    return not user.districts or (district is not None and district in user.districts)


def optional_user(x_demo_user: str | None = Header(default=None)) -> DemoUser | None:
    """The demo account making the request, or None for a public visitor."""
    if not x_demo_user:
        return None
    user = USERS.get(x_demo_user)
    if user is None:
        raise HTTPException(status_code=401, detail=f"Unknown demo account '{x_demo_user}'.")
    return user


def require(user: DemoUser | None, *roles: str) -> DemoUser:
    if user is None:
        raise HTTPException(status_code=401, detail="Choose a demo account first.")
    if roles and user.role not in roles:
        raise HTTPException(status_code=403, detail=f"A {user.title.lower()} account cannot do this.")
    return user
