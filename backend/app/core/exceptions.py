from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """应用异常基类"""

    def __init__(self, detail: str, status_code: int = 400, error_code: str = ""):
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__.lower()


class NotFound(AppError):
    def __init__(self, detail: str = "资源不存在"):
        super().__init__(detail=detail, status_code=404)


class Conflict(AppError):
    def __init__(self, detail: str = "资源冲突"):
        super().__init__(detail=detail, status_code=409)


class Forbidden(AppError):
    def __init__(self, detail: str = "无权限"):
        super().__init__(detail=detail, status_code=403)


class Unauthorized(AppError):
    def __init__(self, detail: str = "未认证"):
        super().__init__(detail=detail, status_code=401)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": exc.error_code},
    )
