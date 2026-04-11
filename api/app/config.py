"""
PBX Cloud — Configuration (Pydantic Settings)

Reads environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://pbx_user:changeme@127.0.0.1:5432/pbx"

    # Redis
    redis_url: str = "redis://127.0.0.1:6379/0"

    # JWT
    jwt_secret: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # Asterisk AMI
    ami_host: str = "127.0.0.1"
    ami_port: int = 5038
    ami_username: str = "admin"
    ami_password: str = "changeme"

    # Kamailio JSONRPC
    kamailio_jsonrpc_host: str = "127.0.0.1"
    kamailio_jsonrpc_port: int = 9090
    kamailio_jsonrpc_timeout: float = 3.0

    # App
    app_name: str = "PBX Cloud API"
    debug: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
