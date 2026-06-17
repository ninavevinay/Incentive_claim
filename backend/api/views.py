from __future__ import annotations

from datetime import datetime

from django.db import transaction
from django.db.models import CharField, Q
from django.db.models.functions import Cast
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Application, Feedback, FormWindow, LoginEvent, Notice, Notification, PasswordResetRequest, User
from .serializers import (
    AdminCreateAuthorityUserSerializer,
    AdminFeedbackOutSerializer,
    AdminFormWindowOutSerializer,
    AdminFormWindowUpdateSerializer,
    AdminUserOutSerializer,
    ApplicationOutSerializer,
    ApplicationReviewSerializer,
    FacultyApplicationCreateSerializer,
    FeedbackCreateSerializer,
    FeedbackOutSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    LoginEventOutSerializer,
    MessageResponseSerializer,
    NoticeCreateSerializer,
    NoticeOutSerializer,
    NotificationOutSerializer,
    OtpRequestResponseSerializer,
    PasswordResetOutSerializer,
    PublicApprovedHighlightOutSerializer,
    RequestOtpSerializer,
    ResetPasswordSerializer,
    StudentApplicationCreateSerializer,
    TokenResponseSerializer,
    UserOutSerializer,
    UserUpdateSerializer,
    VerifyOtpSerializer,
)
from .storage import save_generic_upload
from .workflow import (
    AUTHORITY_ROLES,
    DEFAULT_QUERY_LIMIT,
    MAX_QUERY_LIMIT,
    _backfill_approved_amount_for_apps,
    _collect_filtered_applications,
    _safe_limit,
    _safe_offset,
    apply_application_search,
    apply_authority_scope_to_query,
    collect_application_upload_refs,
    create_faculty_application,
    create_student_application,
    delete_local_uploads,
    delete_user_with_related_data,
    forgot_password_otp,
    login_with_password,
    public_approved_highlights,
    request_registration_otp,
    reset_password_with_otp,
    review_application_submission,
    reviewers_for_stage,
    role_label,
    status_label,
    verify_registration_otp,
)
from .workflow import APPLICATION_UPLOAD_FIELDS
from .workflow import _norm as _normalized


def _parse_int_param(raw_value, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _parse_bool_param(raw_value, default: bool | None = None) -> bool:
    if raw_value is None or raw_value == "":
        if default is None:
            raise ValidationError("Boolean query parameter is required")
        return default
    value = str(raw_value).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValidationError("Invalid boolean query parameter")


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise PermissionDenied("Not authorized")


def _require_admin_or_institution_coordinator(user: User) -> None:
    if user.role not in {"admin", "institution_coordinator"}:
        raise PermissionDenied("Not authorized")


def _serialize_many(serializer_class, items):
    return serializer_class(items, many=True).data


@api_view(["GET"])
@permission_classes([AllowAny])
def root_view(request):
    return Response({"message": "Hello World"})


@api_view(["GET"])
@permission_classes([AllowAny])
def health_view(request):
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
def request_otp(request):
    serializer = RequestOtpSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = request_registration_otp(serializer.validated_data, request)
    return Response(OtpRequestResponseSerializer(result).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
    serializer = VerifyOtpSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = verify_registration_otp(serializer.validated_data, request)
    return Response(TokenResponseSerializer({"access_token": token, "token_type": "bearer"}).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    token = login_with_password(serializer.validated_data, request)
    return Response(TokenResponseSerializer({"access_token": token, "token_type": "bearer"}).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_authority(request):
    return Response({"detail": "Authority self-registration is disabled. Contact admin."}, status=status.HTTP_403_FORBIDDEN)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    return Response({"detail": "Direct registration is disabled. Request registration OTP first."}, status=status.HTTP_410_GONE)


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = forgot_password_otp(serializer.validated_data, request)
    return Response(OtpRequestResponseSerializer(result).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    serializer = ResetPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    result = reset_password_with_otp(serializer.validated_data)
    return Response(MessageResponseSerializer(result).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserOutSerializer(request.user).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_me(request):
    serializer = UserUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    updated_fields: list[str] = []
    if "name" in serializer.validated_data:
        user.name = serializer.validated_data["name"]
        updated_fields.append("name")
    if "department" in serializer.validated_data:
        user.department = serializer.validated_data["department"]
        updated_fields.append("department")
    if updated_fields:
        user.save(update_fields=updated_fields)
    return Response(UserOutSerializer(user).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_me(request):
    user = request.user
    user.is_active = False
    user.deleted_at = datetime.utcnow()
    user.save(update_fields=["is_active", "deleted_at"])
    return Response({"message": "Account deactivated"})


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def profile_me_endpoint(request):
    if request.method == "GET":
        return Response(UserOutSerializer(request.user).data)

    if request.method == "PUT":
        serializer = UserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        updated_fields: list[str] = []
        if "name" in serializer.validated_data:
            user.name = serializer.validated_data["name"]
            updated_fields.append("name")
        if "department" in serializer.validated_data:
            user.department = serializer.validated_data["department"]
            updated_fields.append("department")
        if updated_fields:
            user.save(update_fields=updated_fields)
        return Response(UserOutSerializer(user).data)

    user = request.user
    user.is_active = False
    user.deleted_at = datetime.utcnow()
    user.save(update_fields=["is_active", "deleted_at"])
    return Response({"message": "Account deactivated"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def submit_student(request):
    serializer = StudentApplicationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    app = create_student_application(request.user, serializer.validated_data)
    return Response(ApplicationOutSerializer(app).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def submit_faculty(request):
    serializer = FacultyApplicationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    app = create_faculty_application(request.user, serializer.validated_data)
    return Response(ApplicationOutSerializer(app).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_approved_highlights_view(request):
    limit = _parse_int_param(request.query_params.get("limit"), 8, 1, 30)
    highlights = public_approved_highlights(limit)
    return Response(PublicApprovedHighlightOutSerializer(highlights, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_applications(request):
    status_filter = request.query_params.get("status")
    limit = _parse_int_param(request.query_params.get("limit"), DEFAULT_QUERY_LIMIT, 1, MAX_QUERY_LIMIT)
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.filter(owner_id=request.user.id)
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    apps = list(
        queryset.order_by("-created_at")[offset : offset + limit]
    )
    _backfill_approved_amount_for_apps(apps)
    return Response(ApplicationOutSerializer(apps, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def track(request, application_id: int):
    app = Application.objects.filter(id=application_id, owner_id=request.user.id).first()
    if not app:
        raise NotFound("Application not found")
    _backfill_approved_amount_for_apps([app])
    return Response(ApplicationOutSerializer(app).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_applications(request):
    role = request.user.role
    if role not in AUTHORITY_ROLES:
        raise PermissionDenied("Not authorized")
    target_status = {
        "department_coordinator": "pending_department_coordinator",
        "department_hod": "pending_department_hod",
        "institution_coordinator": "pending_institution_coordinator",
    }[role]
    department = request.query_params.get("department")
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), DEFAULT_QUERY_LIMIT, 1, MAX_QUERY_LIMIT)
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.filter(status=target_status)
    queryset = apply_authority_scope_to_query(queryset, role, request.user.department, department)
    queryset = apply_application_search(queryset, q)
    apps = list(queryset.order_by("-created_at")[offset : offset + limit])
    _backfill_approved_amount_for_apps(apps)
    return Response(ApplicationOutSerializer(apps, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_applications(request):
    role = request.user.role
    if role not in AUTHORITY_ROLES:
        raise PermissionDenied("Not authorized")
    department = request.query_params.get("department")
    status_filter = request.query_params.get("status")
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), DEFAULT_QUERY_LIMIT, 1, MAX_QUERY_LIMIT)
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.all()
    queryset = apply_authority_scope_to_query(queryset, role, request.user.department, department)
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    queryset = apply_application_search(queryset, q)
    apps = list(queryset.order_by("-created_at")[offset : offset + limit])
    _backfill_approved_amount_for_apps(apps)
    return Response(ApplicationOutSerializer(apps, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_reviewed_applications(request):
    role = request.user.role
    if role not in AUTHORITY_ROLES:
        raise PermissionDenied("Not authorized")
    action = request.query_params.get("action")
    if action not in {None, "approve", "reject"}:
        raise ValidationError("Invalid action")
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), DEFAULT_QUERY_LIMIT, 1, MAX_QUERY_LIMIT)
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.all()
    if role in {"department_coordinator", "department_hod"}:
        queryset = queryset.filter(data__department__iexact=request.user.department)
    if action == "reject":
        queryset = queryset.filter(status="rejected")
    elif action == "approve":
        if role == "department_coordinator":
            queryset = queryset.filter(status__in=["pending_department_hod", "pending_institution_coordinator", "approved", "rejected"])
        elif role == "department_hod":
            queryset = queryset.filter(status__in=["pending_institution_coordinator", "approved", "rejected"])
        else:
            queryset = queryset.filter(status="approved")
    queryset = apply_application_search(queryset, q)
    ordered_query = queryset.order_by("-created_at")

    def in_user_scope(app: Application) -> bool:
        if role == "institution_coordinator":
            return True
        return _normalized((app.data or {}).get("department")) == _normalized(request.user.department)

    def infer_approved_by_role(app: Application) -> bool:
        if role == "department_coordinator":
            return app.status in {"pending_department_hod", "pending_institution_coordinator", "approved"}
        if role == "department_hod":
            return app.status in {"pending_institution_coordinator", "approved"}
        if role == "institution_coordinator":
            return app.status == "approved"
        return False

    def infer_rejected_by_role(app: Application) -> bool:
        data = app.data or {}
        return app.status == "rejected" and data.get("last_reject_role") == role

    def is_my_review(app: Application) -> bool:
        if not in_user_scope(app):
            return False
        reviews = (app.data or {}).get("reviews") or []
        has_my_review = any(
            (review.get("reviewer_id") is not None and str(review.get("reviewer_id")) == str(request.user.id))
            and (action is None or review.get("action") == action)
            for review in reviews
        )
        if not has_my_review:
            has_my_review = any(
                review.get("reviewer_id") is None
                and review.get("role") == request.user.role
                and (action is None or review.get("action") == action)
                for review in reviews
            )

        if not has_my_review:
            if action == "approve":
                has_my_review = infer_approved_by_role(app)
            elif action == "reject":
                has_my_review = infer_rejected_by_role(app)
        return has_my_review

    filtered = _collect_filtered_applications(
        ordered_query,
        is_my_review,
        limit=_safe_limit(limit),
        offset=_safe_offset(offset),
    )
    _backfill_approved_amount_for_apps(filtered)
    return Response(ApplicationOutSerializer(filtered, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def role_reviewed_applications(request):
    role = request.user.role
    if role not in AUTHORITY_ROLES:
        raise PermissionDenied("Not authorized")
    action = request.query_params.get("action")
    if action not in {None, "approve", "reject"}:
        raise ValidationError("Invalid action")
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), DEFAULT_QUERY_LIMIT, 1, MAX_QUERY_LIMIT)
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.all()
    if role in {"department_coordinator", "department_hod"}:
        queryset = queryset.filter(data__department__iexact=request.user.department)
    if action == "reject":
        queryset = queryset.filter(status="rejected")
    elif action == "approve" and role == "institution_coordinator":
        queryset = queryset.filter(status="approved")
    queryset = apply_application_search(queryset, q)
    ordered_query = queryset.order_by("-created_at")

    def has_role_review(app: Application) -> bool:
        reviews = (app.data or {}).get("reviews") or []
        return any(
            review.get("role") == role and (action is None or review.get("action") == action)
            for review in reviews
        )

    filtered = _collect_filtered_applications(
        ordered_query,
        has_role_review,
        limit=_safe_limit(limit),
        offset=_safe_offset(offset),
    )
    _backfill_approved_amount_for_apps(filtered)
    return Response(ApplicationOutSerializer(filtered, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def review_application(request, application_id: int):
    serializer = ApplicationReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    app = review_application_submission(application_id, request.user, serializer.validated_data)
    return Response(ApplicationOutSerializer(app).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    return Response([])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id: int):
    notification = Notification.objects.filter(id=notification_id, user_id=request.user.id).first()
    if not notification:
        return Response({"ok": False})
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_feedback(request):
    if request.user.role == "admin":
        raise PermissionDenied("Admins cannot submit feedback from this endpoint")
    serializer = FeedbackCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    existing = Feedback.objects.filter(user_id=request.user.id).first()
    if existing:
        raise ValidationError("Feedback can only be submitted once")
    feedback = Feedback.objects.create(
        user=request.user,
        name=request.user.name,
        email=request.user.email,
        role=request.user.role,
        department=request.user.department,
        benefit_status=serializer.validated_data.get("benefit_status", "beneficial"),
        message=serializer.validated_data["message"].strip(),
        rating=serializer.validated_data.get("rating"),
    )
    return Response(FeedbackOutSerializer(feedback).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_feedback(request):
    limit = _parse_int_param(request.query_params.get("limit"), 50, 1, 200)
    feedbacks = list(Feedback.objects.filter(user_id=request.user.id).order_by("-created_at")[:limit])
    return Response(FeedbackOutSerializer(feedbacks, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def feedback_report(request):
    if request.user.role not in {"institution_coordinator", "admin"}:
        raise PermissionDenied("Not authorized")
    limit = _parse_int_param(request.query_params.get("limit"), 500, 1, 2000)
    feedbacks = list(Feedback.objects.order_by("-created_at")[:limit])
    return Response(FeedbackOutSerializer(feedbacks, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_notices(request):
    notices = list(Notice.objects.order_by("-created_at").all())
    return Response(NoticeOutSerializer(notices, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def create_notice(request):
    if request.user.role != "institution_coordinator":
        raise PermissionDenied("Only institution coordinator can upload notices")
    serializer = NoticeCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    clean_title = str(serializer.validated_data["title"]).strip()
    if not clean_title:
        raise ValidationError("Title is required")
    file_path = save_generic_upload(serializer.validated_data["notice_file"])
    notice = Notice.objects.create(title=clean_title, file_path=file_path, created_by=request.user)
    return Response(NoticeOutSerializer(notice).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_users(request):
    _require_admin(request.user)
    q = request.query_params.get("q")
    role = request.query_params.get("role")
    roles = request.query_params.get("roles")
    limit = _parse_int_param(request.query_params.get("limit"), min(200, DEFAULT_QUERY_LIMIT), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = User.objects.all()
    if role:
        queryset = queryset.filter(role=role)
    elif roles and roles.strip():
        role_values = [item.strip() for item in roles.split(",") if item.strip()]
        if role_values:
            queryset = queryset.filter(role__in=role_values)
    if q and q.strip():
        search = q.strip()
        queryset = queryset.annotate(id_text=Cast("id", output_field=CharField())).filter(
            Q(name__icontains=search)
            | Q(email__icontains=search)
            | Q(role__icontains=search)
            | Q(department__icontains=search)
            | Q(id_text__icontains=search)
        )
    users = list(queryset.order_by("-id")[offset : offset + limit])
    return Response(AdminUserOutSerializer(users, many=True).data)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def admin_applications(request):
    _require_admin(request.user)
    if request.method == "DELETE":
        deleted_count, _ = Application.objects.all().delete()
        return Response({"message": "All applications deleted", "deleted": deleted_count})

    q = request.query_params.get("q")
    status_filter = request.query_params.get("status")
    department = request.query_params.get("department")
    application_type = request.query_params.get("application_type")
    limit = _parse_int_param(request.query_params.get("limit"), min(200, DEFAULT_QUERY_LIMIT), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Application.objects.all()
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    if application_type:
        queryset = queryset.filter(application_type=application_type)
    if department and department.strip():
        queryset = queryset.filter(data__department__iexact=department.strip())
    if q and q.strip():
        queryset = apply_application_search(queryset, q)
    apps = list(queryset.order_by("-created_at")[offset : offset + limit])
    return Response(ApplicationOutSerializer(apps, many=True).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def admin_delete_application(request, app_id: int):
    _require_admin(request.user)
    target = Application.objects.filter(id=app_id).first()
    if not target:
        raise NotFound("Application not found")
    target.delete()
    return Response({"message": "Application deleted"})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def admin_delete_all_applications(request):
    _require_admin(request.user)
    deleted, _ = Application.objects.all().delete()
    return Response({"message": "All applications deleted", "deleted": deleted})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_login_events(request):
    _require_admin(request.user)
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), min(200, DEFAULT_QUERY_LIMIT), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = LoginEvent.objects.all()
    if q and q.strip():
        search = q.strip()
        queryset = queryset.annotate(id_text=Cast("user_id", output_field=CharField())).filter(
            Q(email__icontains=search)
            | Q(ip_address__icontains=search)
            | Q(user_agent__icontains=search)
            | Q(id_text__icontains=search)
        )
    events = list(queryset.order_by("-created_at")[offset : offset + limit])
    return Response(LoginEventOutSerializer(events, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_feedback(request):
    _require_admin(request.user)
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), min(500, max(200, MAX_QUERY_LIMIT)), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = Feedback.objects.all()
    if q and q.strip():
        search = q.strip()
        queryset = queryset.annotate(id_text=Cast("user_id", output_field=CharField())).filter(
            Q(name__icontains=search)
            | Q(email__icontains=search)
            | Q(role__icontains=search)
            | Q(department__icontains=search)
            | Q(message__icontains=search)
            | Q(id_text__icontains=search)
        )
    feedbacks = list(queryset.order_by("-created_at")[offset : offset + limit])
    return Response(AdminFeedbackOutSerializer(feedbacks, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_password_resets(request):
    _require_admin(request.user)
    q = request.query_params.get("q")
    limit = _parse_int_param(request.query_params.get("limit"), min(200, DEFAULT_QUERY_LIMIT), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = PasswordResetRequest.objects.all()
    if q and q.strip():
        search = q.strip()
        queryset = queryset.annotate(id_text=Cast("user_id", output_field=CharField())).filter(
            Q(email__icontains=search)
            | Q(request_ip__icontains=search)
            | Q(id_text__icontains=search)
        )
    resets = list(queryset.order_by("-created_at")[offset : offset + limit])
    return Response(PasswordResetOutSerializer(resets, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_form_window(request):
    _require_admin_or_institution_coordinator(request.user)
    window = FormWindow.objects.filter(id=1).first()
    if not window:
        return Response({"start_date": None, "end_date": None})
    return Response(AdminFormWindowOutSerializer(window).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def admin_set_form_window(request):
    _require_admin_or_institution_coordinator(request.user)
    serializer = AdminFormWindowUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    start_date = serializer.validated_data["start_date"]
    end_date = serializer.validated_data["end_date"]
    if end_date < start_date:
        raise ValidationError("End date must be on or after start date")

    with transaction.atomic():
        window, _ = FormWindow.objects.get_or_create(id=1, defaults={})
        window.start_date = start_date
        window.end_date = end_date
        window.updated_at = datetime.utcnow()
        window.save()

        applicant_users = User.objects.filter(role__in=["student", "faculty"]).all()
        start_label = start_date.isoformat()
        end_label = end_date.isoformat()
        for applicant in applicant_users:
            from .notifications import queue_portal_notification

            queue_portal_notification(
                applicant,
                message=f"Form filling window is open from {start_label} to {end_label}",
                email_subject="Form filling window is open",
                email_headline="The portal form filling window is now open.",
                email_details=[
                    f"Start date: {start_label}",
                    f"End date: {end_label}",
                    "Please submit your application within the announced window.",
                ],
            )
    return Response(AdminFormWindowOutSerializer(window).data)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def admin_form_window_endpoint(request):
    _require_admin_or_institution_coordinator(request.user)
    if request.method == "GET":
        window = FormWindow.objects.filter(id=1).first()
        if not window:
            return Response({"start_date": None, "end_date": None})
        return Response(AdminFormWindowOutSerializer(window).data)

    serializer = AdminFormWindowUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    start_date = serializer.validated_data["start_date"]
    end_date = serializer.validated_data["end_date"]
    if end_date < start_date:
        raise ValidationError("End date must be on or after start date")

    with transaction.atomic():
        window, _ = FormWindow.objects.get_or_create(id=1, defaults={})
        window.start_date = start_date
        window.end_date = end_date
        window.updated_at = datetime.utcnow()
        window.save()

        applicant_users = User.objects.filter(role__in=["student", "faculty"]).all()
        start_label = start_date.isoformat()
        end_label = end_date.isoformat()
        from .notifications import queue_portal_notification

        for applicant in applicant_users:
            queue_portal_notification(
                applicant,
                message=f"Form filling window is open from {start_label} to {end_label}",
                email_subject="Form filling window is open",
                email_headline="The portal form filling window is now open.",
                email_details=[
                    f"Start date: {start_label}",
                    f"End date: {end_label}",
                    "Please submit your application within the announced window.",
                ],
            )
    return Response(AdminFormWindowOutSerializer(window).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def admin_create_authority_user(request):
    _require_admin(request.user)
    serializer = AdminCreateAuthorityUserSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data["role"] not in AUTHORITY_ROLES:
        raise ValidationError("Invalid authority role")

    from .security import hash_password, is_allowed_email, normalize_email

    email = normalize_email(serializer.validated_data["email"])
    if not is_allowed_email(email):
        raise ValidationError("Only @sbjit.edu.in email addresses are allowed")
    existing = User.objects.filter(email=email).first()
    if existing:
        raise ValidationError("Email already registered")

    new_user = User.objects.create(
        name=serializer.validated_data["name"],
        email=email,
        password_hash=hash_password(serializer.validated_data["password"]),
        auth_provider="email_password",
        role=serializer.validated_data["role"],
        department=serializer.validated_data["department"],
    )
    return Response(AdminUserOutSerializer(new_user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def coordinator_authority_users(request):
    _require_admin_or_institution_coordinator(request.user)
    q = request.query_params.get("q")
    include_inactive = _parse_bool_param(request.query_params.get("include_inactive"), True)
    limit = _parse_int_param(request.query_params.get("limit"), min(200, DEFAULT_QUERY_LIMIT), 1, max(200, MAX_QUERY_LIMIT))
    offset = _parse_int_param(request.query_params.get("offset"), 0, 0, 10**9)
    queryset = User.objects.filter(role__in=AUTHORITY_ROLES)
    if not include_inactive:
        queryset = queryset.filter(is_active=True)
    if request.user.role == "institution_coordinator":
        queryset = queryset.filter(role__in=["department_coordinator", "department_hod"])
    if q and q.strip():
        search = q.strip()
        queryset = queryset.annotate(id_text=Cast("id", output_field=CharField())).filter(
            Q(name__icontains=search)
            | Q(email__icontains=search)
            | Q(role__icontains=search)
            | Q(department__icontains=search)
            | Q(id_text__icontains=search)
        )
    users = list(queryset.order_by("-id")[offset : offset + limit])
    return Response(AdminUserOutSerializer(users, many=True).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def coordinator_delete_authority_user(request, user_id: int):
    _require_admin_or_institution_coordinator(request.user)
    target = User.objects.filter(id=user_id).first()
    if not target:
        raise NotFound("User not found")
    if target.role not in AUTHORITY_ROLES:
        raise ValidationError("Selected user is not an authority user")
    if target.id == request.user.id:
        raise ValidationError("You cannot deactivate your own account")
    if request.user.role == "institution_coordinator" and target.role == "institution_coordinator":
        raise PermissionDenied("Institution coordinator cannot deactivate another institution coordinator")
    if not target.is_active:
        return Response({"message": "Authority user already deactivated"})

    target.is_active = False
    target.deleted_at = datetime.utcnow()
    target.save(update_fields=["is_active", "deleted_at"])
    return Response({"message": "Authority user deactivated. Record retained in database."})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def coordinator_set_authority_user_status(request, user_id: int):
    _require_admin_or_institution_coordinator(request.user)
    target = User.objects.filter(id=user_id).first()
    if not target:
        raise NotFound("User not found")
    if target.role not in AUTHORITY_ROLES:
        raise ValidationError("Selected user is not an authority user")
    is_active = _parse_bool_param(request.query_params.get("is_active"), None)
    if request.user.role == "institution_coordinator" and target.role == "institution_coordinator":
        raise PermissionDenied("Institution coordinator cannot manage another institution coordinator")
    if target.id == request.user.id and not is_active:
        raise ValidationError("You cannot deactivate your own account")
    if target.is_active == is_active:
        state = "active" if is_active else "deactivated"
        return Response({"message": f"Authority user already {state}", "is_active": target.is_active})

    target.is_active = is_active
    target.deleted_at = None if is_active else datetime.utcnow()
    target.save(update_fields=["is_active", "deleted_at"])
    action = "activated" if is_active else "deactivated"
    return Response({"message": f"Authority user {action}.", "is_active": target.is_active})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def admin_delete_all_non_admin_users(request):
    _require_admin(request.user)
    targets = list(User.objects.exclude(role="admin").all())
    if not targets:
        return Response({"message": "No non-admin users found", "deleted": 0})

    upload_refs: list[str] = []
    with transaction.atomic():
        for target in targets:
            upload_refs.extend(delete_user_with_related_data(target))
    delete_local_uploads(upload_refs)
    return Response({"message": "All non-admin users deleted", "deleted": len(targets)})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def admin_delete_user(request, user_id: int):
    _require_admin(request.user)
    target = User.objects.filter(id=user_id).first()
    if not target:
        raise NotFound("User not found")
    if target.role == "admin" and target.id == request.user.id:
        raise ValidationError("Cannot delete your own admin account")

    with transaction.atomic():
        upload_refs = delete_user_with_related_data(target)
    delete_local_uploads(upload_refs)
    return Response({"message": "User deleted"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_coordinator_feedback_report(request):
    # Retained for compatibility if the frontend ever requests it.
    return Response([])
