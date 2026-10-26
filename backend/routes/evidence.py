import io
"""Evidence/Document routes for deposit cases."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Header, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import uuid4

from backend.database import get_db
from backend.services.auth import auth_service
from backend.services.access_control import access_control, UserContext
from backend.services.file_storage import get_file_storage, FileValidationError
from backend.services.audit_service import audit_service
from backend.models import DepositEvidence, DepositCase
from backend.models.enums import CaseStatus, AuditAction
from backend.schemas.evidence import (
    DepositEvidenceResponse,
    DepositEvidenceUploadResponse,
    DepositEvidenceListResponse,
    DepositEvidenceDownloadResponse,
    DepositEvidenceReplaceResponse,
)
from backend.schemas.common import PaginationParams, PaginatedResponse
from backend.schemas.institution import CurrentUserResponse
from backend.config import get_settings

router = APIRouter()


def require_evidence_access(user: UserContext, case: DepositCase, permission: str) -> None:
    """Enforce action permission and tenant/assignment access for evidence."""
    if not user.has_permission(permission):
        raise HTTPException(status_code=403, detail="Insufficient permission for this document action")
    if not access_control.can_access_case(
        user, case.institution_id, case.assigned_officer_id, case.status.value
    ):
        raise HTTPException(status_code=403, detail="Cannot access documents for this case")


async def get_current_user(authorization: str = Header(None)):
    try:
        user = await auth_service.get_current_user(authorization)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


async def get_user_context(current_user: CurrentUserResponse = Depends(get_current_user)) -> UserContext:
    context = access_control.get_user_context(current_user.user_id)
    if context:
        return context
    return UserContext(
        user_id=current_user.user_id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles={current_user.role} if current_user.role else set(),
        institution_id=current_user.institution_id,
    )


async def get_file_storage_service():
    return get_file_storage()


@router.post(
    "",
    response_model=DepositEvidenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_evidence(
    case_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
    file_storage = Depends(get_file_storage_service),
):
    """Upload a document as evidence for a deposit case."""
    # Verify case exists and user has access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    
    authority_output_types = {"approval_bureau_noc", "council_sanction_order"}
    is_authority_output = document_type in authority_output_types
    if is_authority_output:
        roles = {role.value for role in user.roles}
        is_fdr_noc = (
            document_type == "approval_bureau_noc"
            and case.deposit_method.value == "fdr_rpgf"
            and "approval_bureau" in roles
            and case.status == CaseStatus.FINAL_DECISION
        )
        is_rtgs_sanction = (
            document_type == "council_sanction_order"
            and case.deposit_method.value == "rtgs"
            and "council" in roles
            and case.status == CaseStatus.FINAL_DECISION
        )
        # The FDR simulation has an explicit final Council sanction following
        # the Approval Bureau NOC.
        is_fdr_council_sanction = (
            document_type == "council_sanction_order"
            and case.deposit_method.value == "fdr_rpgf"
            and "council" in roles
            and case.status == CaseStatus.NOC_ISSUED
        )
        if not user.has_permission("evidence:upload_authority") or not (
            is_fdr_noc or is_rtgs_sanction or is_fdr_council_sanction
        ):
            raise HTTPException(status_code=403, detail="Only the routed authority can record this official output")
    else:
        require_evidence_access(user, case, "evidence:upload")
    
    # Check case status - only allow upload in certain statuses
    allowed_statuses = [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.UNDER_SCRUTINY, CaseStatus.CLARIFICATION_PENDING, CaseStatus.CLEARED, CaseStatus.RELEASE_REQUESTED, CaseStatus.FDR_RPGF_REVIEW, CaseStatus.RTGS_REVIEW, CaseStatus.SD_REFUND_REVIEW, CaseStatus.FINAL_DECISION, CaseStatus.NOC_ISSUED]
    if case.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload evidence when case is in {case.status.value} status"
        )
    
    # Read file content
    file_content = await file.read(get_settings().max_upload_size_mb * 1024 * 1024 + 1)
    
    # Determine MIME type
    mime_type = file.content_type or "application/octet-stream"
    
    try:
        # Save file using storage service
        file_meta = await file_storage.upload_file(
            case_id=case_id,
            file_content=file_content,
            original_filename=file.filename,
            mime_type=mime_type,
            document_type=document_type,
        )
    except FileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Check for existing document of same type to handle versioning
    existing_result = await db.execute(
        select(DepositEvidence)
        .where(DepositEvidence.case_id == case_id)
        .where(DepositEvidence.document_type == document_type)
        .where(DepositEvidence.is_deleted.is_(False))
        .where(DepositEvidence.replaced_by_id.is_(None))
        .order_by(DepositEvidence.version.desc())
    )
    existing = existing_result.scalars().first()
    
    version = existing.version + 1 if existing else 1
    replaced_id = None
    
    if existing:
        # Mark existing as replaced
        replaced_id = existing.id
    
    # Create evidence record with OCR data
    evidence = DepositEvidence(
        id=str(uuid4()),
        case_id=case_id,
        document_type=document_type,
        file_path=file_meta["relative_path"],
        original_filename=file_meta["original_filename"],
        file_size=file_meta["file_size"],
        mime_type=file_meta["mime_type"],
        uploaded_by=user.user_id,
        is_demo=case.is_demo,
        file_hash=file_meta["file_hash"],
        version=version,
        replaced_by_id=replaced_id,
        ocr_text=file_meta.get("ocr_text"),
        ocr_confidence=file_meta.get("ocr_confidence"),
        extracted_data=file_meta.get("extracted_data"),
        validation_flags=file_meta.get("validation_flags"),
    )
    
    # Update replaced_by_id on existing record if applicable
    if existing:
        existing.replaced_by_id = evidence.id
    
    db.add(evidence)
    await db.flush()
    
    # Log audit event
    await audit_service.log_event(
        db=db,
        entity_type="deposit_evidence",
        entity_id=evidence.id,
        action=AuditAction.DOCUMENT_UPLOAD,
        actor_id=user.user_id,
        old_values=None,
        new_values={
            "case_id": case_id,
            "document_type": document_type,
            "file_path": evidence.file_path,
            "original_filename": evidence.original_filename,
            "file_size": evidence.file_size,
            "mime_type": evidence.mime_type,
            "version": evidence.version,
        },
    )
    if is_authority_output:
        await audit_service.log_event(
            db=db, entity_type="deposit_case", entity_id=case.id,
            action=AuditAction.UPDATE, actor_id=user.user_id,
            new_values={"authority_output_recorded": document_type, "evidence_id": evidence.id, "simulation": case.is_demo},
        )
        previous_status = case.status
        case.status = (
            CaseStatus.NOC_ISSUED
            if document_type == "approval_bureau_noc"
            else CaseStatus.SANCTIONED
        )
        case.previous_status = previous_status
        if case.status == CaseStatus.SANCTIONED:
            case.closed_at = datetime.now(timezone.utc)
        from backend.models import CaseEvent
        db.add(CaseEvent(
            id=str(uuid4()),
            case_id=case.id,
            event_type="approval_noc_recorded" if document_type == "approval_bureau_noc" else "council_sanction_recorded",
            actor_id=user.user_id,
            old_status=previous_status,
            new_status=case.status,
            details={"document_type": document_type, "evidence_id": evidence.id, "simulation": case.is_demo},
        ))
        await audit_service.log_event(
            db=db, entity_type="deposit_case", entity_id=case.id,
            action=AuditAction.STATUS_CHANGE, actor_id=user.user_id,
            old_values={"status": previous_status.value},
            new_values={
                "status": case.status.value,
                "reason": "Approval Bureau NOC recorded; routed to Council" if case.status == CaseStatus.NOC_ISSUED else "Council sanction recorded",
            },
        )
    
    await db.commit()
    await db.refresh(evidence)
    
    return DepositEvidenceUploadResponse(
        id=evidence.id,
        case_id=evidence.case_id,
        document_type=evidence.document_type,
        original_filename=evidence.original_filename,
        file_size=evidence.file_size,
        mime_type=evidence.mime_type,
        version=evidence.version,
        file_hash=evidence.file_hash or "",
        uploaded_by=evidence.uploaded_by,
        created_at=evidence.created_at,
        replaced_id=replaced_id,
        ocr_text=evidence.ocr_text,
        ocr_confidence=evidence.ocr_confidence,
        validation_flags=evidence.validation_flags,
        extracted_data=evidence.extracted_data,
    )


@router.get("", response_model=DepositEvidenceListResponse)
async def list_evidence(
    case_id: str,
    params: PaginationParams = Depends(),
    document_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """List all evidence documents for a case with pagination."""
    # Verify case exists and user has access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    
    require_evidence_access(user, case, "evidence:read")
    
    query = select(DepositEvidence).where(
        DepositEvidence.case_id == case_id, DepositEvidence.is_deleted.is_(False)
    )
    
    if document_type:
        query = query.where(DepositEvidence.document_type == document_type)
    
    # Order by document_type, then version desc
    query = query.order_by(DepositEvidence.document_type, DepositEvidence.version.desc())
    
    # Get total count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(params.offset).limit(params.limit)
    result = await db.execute(query)
    evidence_list = result.scalars().all()
    
    return DepositEvidenceListResponse(
        items=[
            DepositEvidenceResponse(
                id=e.id,
                case_id=e.case_id,
                document_type=e.document_type,
                original_filename=e.original_filename,
                file_size=e.file_size,
                mime_type=e.mime_type,
                file_path=e.file_path,
                version=e.version,
                file_hash=e.file_hash,
                uploaded_by=e.uploaded_by,
                replaced_by_id=e.replaced_by_id,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in evidence_list
        ],
        total=total,
        page=params.page,
        page_size=params.page_size,
        total_pages=(total + params.page_size - 1) // params.page_size,
    )


@router.get("/{evidence_id}", response_model=DepositEvidenceResponse)
async def get_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
):
    """Get a specific evidence document by ID."""
    result = await db.execute(select(DepositEvidence).where(DepositEvidence.id == evidence_id))
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    
    # Verify case access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == evidence.case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    require_evidence_access(user, case, "evidence:read")
    if evidence.is_deleted:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    return DepositEvidenceResponse(
        id=evidence.id,
        case_id=evidence.case_id,
        document_type=evidence.document_type,
        original_filename=evidence.original_filename,
        file_size=evidence.file_size,
        mime_type=evidence.mime_type,
        file_path=evidence.file_path,
        version=evidence.version,
        file_hash=evidence.file_hash,
        uploaded_by=evidence.uploaded_by,
        replaced_by_id=evidence.replaced_by_id,
        created_at=evidence.created_at,
        updated_at=evidence.updated_at,
    )


@router.get("/{evidence_id}/download", response_model=DepositEvidenceDownloadResponse)
async def get_download_token(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
    file_storage = Depends(get_file_storage_service),
):
    """Generate a secure download token for an evidence file."""
    result = await db.execute(select(DepositEvidence).where(DepositEvidence.id == evidence_id))
    evidence = result.scalar_one_or_none()
    if not evidence or evidence.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    
    # Verify case access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == evidence.case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    require_evidence_access(user, case, "evidence:read")
    
    # Verify file exists on disk (synthesizing synthetic demo document if needed)
    if not file_storage.file_exists(evidence.file_path):
        if evidence.is_demo or evidence.file_path.startswith("demo/"):
            file_storage.ensure_demo_file(evidence.file_path, evidence.original_filename, evidence.case_id)
            
    if not file_storage.file_exists(evidence.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    
    # Generate download token
    token = file_storage.generate_download_token(evidence.file_path, user.user_id)
    
    # Log audit event
    await audit_service.log_event(
        db=db,
        entity_type="deposit_evidence",
        entity_id=evidence.id,
        action=AuditAction.DOCUMENT_UPLOAD,  # Using DOCUMENT_UPLOAD for download tracking
        actor_id=user.user_id,
        old_values=None,
        new_values={"action": "download_token_generated"},
    )
    await db.commit()
    
    return DepositEvidenceDownloadResponse(
        download_token=token,
        filename=evidence.original_filename,
        expires_in=3600,
    )


@router.post("/{evidence_id}/download")
async def download_evidence(
    evidence_id: str,
    request: Request,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
    file_storage = Depends(get_file_storage_service),
):
    """Download an evidence file using a secure token or active session."""
    download_token = token
    if not download_token:
        try:
            content_type = request.headers.get("content-type", "").lower()
            if "application/json" in content_type:
                body = await request.json()
                if isinstance(body, dict):
                    download_token = body.get("token")
            elif "form" in content_type:
                form = await request.form()
                download_token = form.get("token")
            else:
                try:
                    body = await request.json()
                    if isinstance(body, dict):
                        download_token = body.get("token")
                except Exception:
                    form = await request.form()
                    download_token = form.get("token")
        except Exception:
            pass

    # Get evidence record
    result = await db.execute(select(DepositEvidence).where(DepositEvidence.id == evidence_id))
    evidence = result.scalar_one_or_none()
    if not evidence or evidence.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")

    case_result = await db.execute(select(DepositCase).where(DepositCase.id == evidence.case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    require_evidence_access(user, case, "evidence:read")

    # If token was provided, verify it
    if download_token:
        relative_path = file_storage.verify_download_token(download_token, user.user_id)
        if not relative_path:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired download token")
        if relative_path != evidence.file_path:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token does not match requested evidence")

    # Verify file exists on disk (synthesizing synthetic demo document if needed)
    if not file_storage.file_exists(evidence.file_path):
        if evidence.is_demo or evidence.file_path.startswith("demo/"):
            file_storage.ensure_demo_file(evidence.file_path, evidence.original_filename, evidence.case_id)

    if not file_storage.file_exists(evidence.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    file_path = file_storage.get_file_path(evidence.file_path)

    # Return file response
    from fastapi.responses import FileResponse
    return FileResponse(
        path=str(file_path),
        filename=evidence.original_filename,
        media_type=evidence.mime_type or "application/octet-stream",
    )


@router.post(
    "",
    response_model=DepositEvidenceReplaceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def replace_evidence(
    case_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
    file_storage = Depends(get_file_storage_service),
):
    """Replace an existing evidence document (creates new version)."""
    # Verify case exists and user has access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    
    require_evidence_access(user, case, "evidence:upload")
    
    # Check case status
    allowed_statuses = [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.UNDER_SCRUTINY, CaseStatus.CLARIFICATION_PENDING, CaseStatus.CLEARED, CaseStatus.RELEASE_REQUESTED, CaseStatus.FDR_RPGF_REVIEW, CaseStatus.RTGS_REVIEW, CaseStatus.SD_REFUND_REVIEW]
    if case.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot replace evidence when case is in {case.status.value} status"
        )
    
    # Find current version
    existing_result = await db.execute(
        select(DepositEvidence)
        .where(DepositEvidence.case_id == case_id)
        .where(DepositEvidence.document_type == document_type)
        .where(DepositEvidence.is_deleted.is_(False))
        .where(DepositEvidence.replaced_by_id.is_(None))
        .order_by(DepositEvidence.version.desc())
    )
    existing = existing_result.scalars().first()
    
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existing document of this type to replace")
    
    # Read file content
    file_content = await file.read(get_settings().max_upload_size_mb * 1024 * 1024 + 1)
    mime_type = file.content_type or "application/octet-stream"
    
    try:
        file_meta = file_storage.save_file(
            case_id=case_id,
            document_type=document_type,
            file_content=io.BytesIO(file_content),
            original_filename=file.filename,
            mime_type=mime_type,
            uploaded_by=user.user_id,
        )
    except FileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Create new version
    new_version = existing.version + 1
    new_evidence = DepositEvidence(
        id=str(uuid4()),
        case_id=case_id,
        document_type=document_type,
        file_path=file_meta["relative_path"],
        original_filename=file_meta["original_filename"],
        file_size=file_meta["file_size"],
        mime_type=file_meta["mime_type"],
        uploaded_by=user.user_id,
        file_hash=file_meta["file_hash"],
        is_demo=case.is_demo,
        version=new_version,
        validation_flags=file_meta.get("validation_flags"),
    )
    
    # Mark old version as replaced
    existing.replaced_by_id = new_evidence.id
    
    db.add(new_evidence)
    await db.flush()
    
    # Log audit event
    await audit_service.log_event(
        db=db,
        entity_type="deposit_evidence",
        entity_id=new_evidence.id,
        action=AuditAction.DOCUMENT_REPLACE,
        actor_id=user.user_id,
        old_values={
            "previous_version": existing.version,
            "previous_file_path": existing.file_path,
            "previous_file_hash": existing.file_hash,
        },
        new_values={
            "new_version": new_version,
            "new_file_path": new_evidence.file_path,
            "new_file_hash": new_evidence.file_hash,
        },
    )
    
    await db.commit()
    await db.refresh(new_evidence)
    
    return DepositEvidenceReplaceResponse(
        id=new_evidence.id,
        case_id=new_evidence.case_id,
        document_type=new_evidence.document_type,
        original_filename=new_evidence.original_filename,
        file_size=new_evidence.file_size,
        mime_type=new_evidence.mime_type,
        version=new_evidence.version,
        file_hash=new_evidence.file_hash or "",
        uploaded_by=new_evidence.uploaded_by,
        previous_version_id=existing.id,
        created_at=new_evidence.created_at,
    )


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user: UserContext = Depends(get_user_context),
    file_storage = Depends(get_file_storage_service),
):
    """Soft delete an evidence document (moves to trash)."""
    result = await db.execute(select(DepositEvidence).where(DepositEvidence.id == evidence_id))
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found")
    
    # Verify case access
    case_result = await db.execute(select(DepositCase).where(DepositCase.id == evidence.case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    require_evidence_access(user, case, "evidence:delete_own")
    
    # Only allow delete in draft/submitted states
    if case.status not in [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.RELEASE_REQUESTED, CaseStatus.FDR_RPGF_REVIEW, CaseStatus.RTGS_REVIEW, CaseStatus.SD_REFUND_REVIEW]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete evidence when case is in {case.status.value} status"
        )
    
    # Preserve the original in private storage and hide it from current case views.
    evidence.is_deleted = True
    
    # Log audit event
    await audit_service.log_event(
        db=db,
        entity_type="deposit_evidence",
        entity_id=evidence.id,
        action=AuditAction.DELETE,
        actor_id=user.user_id,
        old_values={
            "file_path": evidence.file_path,
            "file_hash": evidence.file_hash,
        },
        new_values={"deleted": True},
    )
    
    await db.commit()
