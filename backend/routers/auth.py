from fastapi import APIRouter
from ..services.tidal_service import tidal_service
from ..schemas import AuthStatus, LoginStart

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status", response_model=AuthStatus)
def auth_status():
    return AuthStatus(
        logged_in=tidal_service.is_logged_in(),
        username=tidal_service.get_username(),
    )


@router.post("/login/start", response_model=LoginStart)
def login_start():
    data = tidal_service.start_login()
    return LoginStart(**data)


@router.get("/login/poll")
def login_poll():
    success = tidal_service.poll_login()
    return {"success": success}
