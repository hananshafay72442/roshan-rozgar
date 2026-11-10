"""Validate private photos and optionally compare faces with Amazon Rekognition."""
import io
import warnings

import boto3
from botocore.config import Config as AWSConfig
from botocore.exceptions import BotoCoreError, ClientError
from flask import abort, current_app, request
from PIL import Image, ImageOps, UnidentifiedImageError

from ..models import WorkerIdentity

MAX_IMAGE_BYTES = 700_000


def read_photo(field):
    upload = request.files.get(field)
    if not upload:
        abort(400, description="Upload your face photo and CNIC front image.")
    data = upload.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        abort(400, description="Each image must be smaller than 700 KB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG"} or image.width * image.height > 20_000_000:
                    raise ValueError()
                if min(image.size) < 160:
                    raise ValueError()
                image.load()
                clean = ImageOps.exif_transpose(image).convert("RGB")
                clean.thumbnail((1600, 1600))
                output = io.BytesIO()
                clean.save(output, "JPEG", quality=85)
                result = output.getvalue()
                if len(result) > MAX_IMAGE_BYTES:
                    raise ValueError()
                return result
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        abort(400, description="Use a clear JPG or PNG image, at least 160 pixels on each side.")


def compare_faces(selfie, cnic):
    region = current_app.config.get("REKOGNITION_REGION")
    if not region:
        return "manual_review", None
    try:
        client = boto3.client("rekognition", region_name=region, config=AWSConfig(
            connect_timeout=3, read_timeout=5, retries={"max_attempts": 0},
        ))
        for photo in (selfie, cnic):
            faces = client.detect_faces(Image={"Bytes": photo}, Attributes=["DEFAULT"]).get("FaceDetails", [])
            if len(faces) != 1 or faces[0].get("Confidence", 0) < 99:
                abort(400, description="Use one clearly visible face in each image. Retake the photos.")
        result = client.compare_faces(SourceImage={"Bytes": selfie}, TargetImage={"Bytes": cnic},
                                      SimilarityThreshold=95, QualityFilter="AUTO")
        matches = result.get("FaceMatches", [])
        if not matches or matches[0].get("Similarity", 0) < 95:
            abort(400, description="The faces did not match. Retake clear photos of yourself and your own CNIC.")
        return "matched", float(matches[0]["Similarity"])
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "InvalidParameterException":
            abort(400, description="No clear face was found. Retake your face photo and CNIC front.")
        abort(503, description="Face matching is temporarily unavailable. Please try again.")
    except BotoCoreError:
        abort(503, description="Face matching is temporarily unavailable. Please try again.")


def identity_evidence():
    if request.form.get("identity_consent") != "true":
        abort(400, description="Consent to the private identity check before submitting.")
    selfie, cnic = read_photo("selfie"), read_photo("cnic_front")
    if selfie == cnic:
        abort(400, description="Use a separate face photo and CNIC front image.")
    check, similarity = compare_faces(selfie, cnic)
    return dict(selfie=selfie, cnic_front=cnic, face_check=check, similarity=similarity)


def identity_data(worker_id):
    from ..extensions import db
    identity = db.session.scalar(db.select(WorkerIdentity).where(WorkerIdentity.worker_id == worker_id))
    return {"face_check": identity.face_check, "submitted_at": identity.submitted_at.isoformat() + "Z"} if identity else None
