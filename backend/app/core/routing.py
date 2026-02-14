import re


def slugify_department(department: str | None) -> str:
    value = (department or "").strip().lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def dashboard_path_for_user(role: str, department: str | None) -> str:
    if role == "student":
        return "/student"
    if role == "faculty":
        return "/faculty"
    if role == "institution_coordinator":
        return "/authority/institution-coordinator"
    if role == "admin":
        return "/admin"

    department_slug = slugify_department(department)
    if role == "department_coordinator":
        return (
            f"/authority/department-coordinator/{department_slug}"
            if department_slug
            else "/authority/department-coordinator"
        )
    if role == "department_hod":
        return (
            f"/authority/department-hod/{department_slug}"
            if department_slug
            else "/authority/department-hod"
        )
    return "/login"
