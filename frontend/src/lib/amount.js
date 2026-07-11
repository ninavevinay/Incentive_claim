const normalizeAmount = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toFixed(2);
};

export const withNotificationAmounts = (apps, notifications) => {
  const list = Array.isArray(apps) ? apps : [];
  const notes = Array.isArray(notifications) ? notifications : [];
  const pattern = /Application ID\s+(\d+)\s+is approved with amount Rs\.\s*(\d+(?:\.\d+)?)/i;
  const amountById = new Map();

  notes.forEach((note) => {
    const msg = String(note?.message || "");
    const match = msg.match(pattern);
    if (!match) return;
    const appId = Number(match[1]);
    const amount = Number(match[2]);
    if (Number.isNaN(appId) || Number.isNaN(amount)) return;
    if (!amountById.has(appId)) {
      amountById.set(appId, amount);
    }
  });

  return list.map((app) => {
    const data = app?.data || {};
    const alreadyPresent =
      app?.approved_amount ??
      data.notification_approved_amount ??
      data.approved_amount ??
      data.approvedAmount ??
      data.approved_amt ??
      data.amount_approved ??
      data.final_approved_amount ??
      data.amount;
    if (alreadyPresent !== undefined && alreadyPresent !== null && alreadyPresent !== "") {
      return app;
    }
    const fallback = amountById.get(Number(app?.id));
    if (fallback === undefined) return app;
    return {
      ...app,
      data: {
        ...data,
        notification_approved_amount: fallback,
        approved_amount: fallback,
      },
    };
  });
};

const pickAmountValue = (record) =>
  record?.notification_approved_amount ??
  record?.notificationApprovedAmount ??
  record?.approved_amount ??
  record?.approvedAmount ??
  record?.approved_amt ??
  record?.amount_approved ??
  record?.final_approved_amount ??
  record?.amount ??
  null;

export const getInstitutionCoordinatorApprovedAmount = (app) => {
  const data = app?.data || {};
  const canonicalAmount = normalizeAmount(app?.approved_amount);
  if (canonicalAmount !== null) return canonicalAmount;
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const institutionApproval = [...reviews].reverse().find((review) => {
    if (review?.action !== "approve") return false;
    if (review?.role !== "institution_coordinator") return false;
    const value = pickAmountValue(review);
    return value !== null && value !== undefined && value !== "";
  });

  if (institutionApproval) {
    const normalizedReview = normalizeAmount(pickAmountValue(institutionApproval));
    if (normalizedReview !== null) return normalizedReview;
  }

  const directAmount = pickAmountValue(data);
  const normalizedDirect = normalizeAmount(directAmount);
  if (normalizedDirect !== null) return normalizedDirect;

  return "-";
};

export const getApprovedAmount = (app) => {
  const data = app?.data || {};
  const canonicalAmount = normalizeAmount(app?.approved_amount);
  if (canonicalAmount !== null) return canonicalAmount;
  const directAmount = pickAmountValue(data);
  const normalizedDirect = normalizeAmount(directAmount);
  if (normalizedDirect !== null) return normalizedDirect;

  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const coordinatorApproval = [...reviews].reverse().find((review) => {
    if (review?.action !== "approve") return false;
    const value = pickAmountValue(review);
    return value !== null && value !== undefined && value !== "";
  });

  if (coordinatorApproval) {
    const reviewAmount = pickAmountValue(coordinatorApproval);
    const normalizedReview = normalizeAmount(reviewAmount);
    if (normalizedReview !== null) return normalizedReview;
  }

  return "-";
};

export const getApprovedAmountByRole = (app, role) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!normalizedRole) return "-";
  if (normalizedRole === "institution_coordinator") {
    return getInstitutionCoordinatorApprovedAmount(app);
  }

  const data = app?.data || {};
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const roleApproval = [...reviews].reverse().find((review) => {
    if (review?.action !== "approve") return false;
    if (String(review?.role || "").trim().toLowerCase() !== normalizedRole) return false;
    const value = pickAmountValue(review);
    return value !== null && value !== undefined && value !== "";
  });

  if (!roleApproval) return "-";
  const normalizedReview = normalizeAmount(pickAmountValue(roleApproval));
  return normalizedReview !== null ? normalizedReview : "-";
};
