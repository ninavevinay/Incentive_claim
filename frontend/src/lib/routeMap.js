export function slugifyDepartment(department) {
  return (department || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getDashboardPathForUser(user) {
  if (!user) return "/login";
  if (user.dashboard_path) return user.dashboard_path;

  if (user.role === "student") return "/student";
  if (user.role === "faculty") return "/faculty";
  if (user.role === "institution_coordinator") return "/authority/institution-coordinator";
  if (user.role === "admin") return "/admin";
  if (user.role === "department_coordinator") {
    const departmentSlug = slugifyDepartment(user.department);
    return departmentSlug
      ? `/authority/department-coordinator/${departmentSlug}`
      : "/authority/department-coordinator";
  }
  if (user.role === "department_hod") {
    const departmentSlug = slugifyDepartment(user.department);
    return departmentSlug ? `/authority/department-hod/${departmentSlug}` : "/authority/department-hod";
  }

  return "/login";
}
