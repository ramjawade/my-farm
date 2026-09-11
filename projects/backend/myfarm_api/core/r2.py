"""Cloudflare R2 storage service for activity attachments."""

from datetime import datetime
from typing import Any

import boto3
from botocore.config import Config

from myfarm_api.core.config import get_settings

# R2 API endpoint template: https://<account_id>.r2.cloudflarestorage.com
R2_ENDPOINT_TEMPLATE = "https://{account_id}.r2.cloudflarestorage.com"


class R2Service:
    """Cloudflare R2 storage service for activity attachments.

    Uses S3-compatible API via boto3. Generates presigned URLs for direct uploads/downloads.
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.s3_client = self._init_s3_client()

    def _init_s3_client(self) -> Any:
        """Initialize S3 client for R2."""
        if not self.settings.r2_configured:
            return None

        endpoint_url = R2_ENDPOINT_TEMPLATE.format(
            account_id=self.settings.r2_account_id
        )

        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

    def generate_upload_url(
        self, activity_id: int, file_name: str, content_type: str = "application/octet-stream"
    ) -> dict[str, Any]:
        """Generate a presigned URL for direct file upload to R2.

        Args:
            activity_id: Activity ID
            file_name: Original file name (for storage key)
            content_type: MIME type

        Returns:
            Dict with:
              - upload_url: Presigned URL for PUT request
              - storage_key: S3 key where file will be stored
              - expires_in: Seconds until URL expires (default 1 hour)
        """
        if not self.s3_client:
            raise ValueError("R2 not configured — set R2_ACCOUNT_ID, etc.")

        # Generate storage key: activities/{activity_id}/{timestamp}_{filename}
        timestamp = datetime.utcnow().isoformat()
        storage_key = f"activities/{activity_id}/{timestamp}_{file_name}"

        # Generate presigned URL (valid for 1 hour)
        upload_url = self.s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.settings.r2_bucket_name,
                "Key": storage_key,
                "ContentType": content_type,
            },
            ExpiresIn=3600,
        )

        return {
            "upload_url": upload_url,
            "storage_key": storage_key,
            "expires_in": 3600,
        }

    def generate_download_url(self, storage_key: str) -> str:
        """Generate a presigned URL for file download from R2.

        Args:
            storage_key: S3 key

        Returns:
            Presigned URL for GET request (valid for 24 hours)
        """
        if not self.s3_client:
            raise ValueError("R2 not configured")

        url: str = self.s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.settings.r2_bucket_name,
                "Key": storage_key,
            },
            ExpiresIn=86400,  # 24 hours
        )
        return url

    def delete_file(self, storage_key: str) -> bool:
        """Delete a file from R2.

        Args:
            storage_key: S3 key

        Returns:
            True if successful
        """
        if not self.s3_client:
            raise ValueError("R2 not configured")

        try:
            self.s3_client.delete_object(
                Bucket=self.settings.r2_bucket_name,
                Key=storage_key,
            )
            return True
        except Exception as e:
            print(f"Failed to delete R2 object {storage_key}: {e}")
            return False


# Singleton instance
_r2_service: R2Service | None = None


def get_r2_service() -> R2Service:
    """Get or create R2 service singleton."""
    global _r2_service
    if _r2_service is None:
        _r2_service = R2Service()
    return _r2_service
