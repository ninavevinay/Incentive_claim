from pydantic import BaseModel
from datetime import datetime

class StudentApplicationCreate(BaseModel):
    department: str
    applicant_name: str
    usn: str
    mobile_number: str
    academic_year: str
    academic_year_type: str
    semester: str
    email: str
    incentive_claim_count: int
    course_platform: str
    course_title: str
    nptel_application_number: str
    course_session: str
    course_weeks: int
    course_score: str
    course_category: str
    course_credits: int
    registration_fee_paid: float
    permissible_claim: float
    bank_account_number: str
    bank_ifsc: str
    bank_branch: str
    bank_name: str
    fee_receipt_file: str | None = None
    certificate_file: str | None = None
    bank_passbook_file: str | None = None
    photograph_file: str | None = None
    signature_file: str | None = None
    declaration_accepted: bool

class FacultyApplicationCreate(BaseModel):
    department: str
    applicant_name: str
    mobile_number: str
    academic_year: str
    academic_year_type: str
    email: str
    designation: str
    incentive_claim_count: int
    course_platform: str
    course_title: str
    nptel_application_number: str
    course_session: str
    course_weeks: int
    course_score: str
    course_category: str
    course_credits: int
    registration_fee_paid: float
    permissible_claim: float
    fee_receipt_file: str | None = None
    certificate_file: str | None = None
    photograph_file: str | None = None
    signature_file: str | None = None
    declaration_accepted: bool

class ApplicationOut(BaseModel):
    id: int
    application_type: str
    status: str
    approved_amount: float | None = None
    data: dict
    created_at: datetime

    class Config:
        from_attributes = True

class ApplicationReview(BaseModel):
    action: str
    remark: str | None = None
    approved_amount: float | None = None


class PublicApprovedHighlightOut(BaseModel):
    id: int
    application_type: str
    applicant_name: str
    course_category: str
    percentage: str
    photograph_file: str
    created_at: datetime
