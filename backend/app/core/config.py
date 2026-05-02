from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 应用
    APP_ENV: str = "development"
    APP_PORT: int = 8000

    # PostgreSQL
    PG_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pet_hospital"

    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017/pet_hospital"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "pet-hospital"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
