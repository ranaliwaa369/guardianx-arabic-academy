import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { academyUserRolesTable, db } from "@workspace/db";

export type AcademyRole = "student" | "instructor" | "admin";

export interface AcademyUser {
  userId: string;
  role: AcademyRole;
  displayName: string | null;
  access: {
    planType: string;
    subscriptionStatus: string;
    accessOverride: string;
    hasAccess: boolean;
    trialStartedAt: Date | null;
    trialExpiresAt: Date | null;
  };
}

type AcademyAccount = typeof academyUserRolesTable.$inferSelect;

export function hasAcademyAccess(account: AcademyAccount): boolean {
  if (account.accessOverride === "grant") return true;
  if (account.accessOverride === "revoke") return false;

  switch (account.planType) {
    case "beta":
      return account.subscriptionStatus === "beta" || account.subscriptionStatus === "active";
    case "free":
      return account.subscriptionStatus === "active";
    case "trial":
      return (
        account.subscriptionStatus === "trialing" &&
        !!account.trialStartedAt &&
        !!account.trialExpiresAt &&
        account.trialStartedAt.getTime() <= Date.now() &&
        account.trialExpiresAt.getTime() > Date.now()
      );
    case "paid":
      return account.subscriptionStatus === "active" || account.subscriptionStatus === "past_due";
    default:
      return false;
  }
}

export const requireAcademyAuth: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const claims = auth.sessionClaims as
    | { email?: unknown; firstName?: unknown }
    | null;
  const email =
    typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  const initialAdminEmail = process.env.INITIAL_INSTRUCTOR_EMAIL
    ?.trim()
    .toLowerCase();
  const isInitialAdmin =
    !!email && !!initialAdminEmail && email === initialAdminEmail;
  const displayName =
    typeof claims?.firstName === "string" ? claims.firstName : null;
  const now = new Date();
  await db
    .insert(academyUserRolesTable)
    .values({
      userId: auth.userId,
      role: isInitialAdmin ? "admin" : "student",
      email: email || null,
      displayName,
      lastSeenAt: now,
      initialAdminGrantApplied: isInitialAdmin,
    })
    .onConflictDoNothing();

  if (isInitialAdmin) {
    await db
      .update(academyUserRolesTable)
      .set({ role: "admin", initialAdminGrantApplied: true })
      .where(
        and(
          eq(academyUserRolesTable.userId, auth.userId),
          eq(academyUserRolesTable.initialAdminGrantApplied, false),
        ),
      );
  }

  await db
    .update(academyUserRolesTable)
    .set({ email: email || null, displayName, lastSeenAt: now })
    .where(eq(academyUserRolesTable.userId, auth.userId));

  const [roleRecord] = await db
    .select()
    .from(academyUserRolesTable)
    .where(eq(academyUserRolesTable.userId, auth.userId))
    .limit(1);

  const role = roleRecord?.role;
  if (role !== "student" && role !== "instructor" && role !== "admin") {
    res.status(403).json({ error: "This account does not have an academy role." });
    return;
  }

  res.locals.academyUser = {
    userId: auth.userId,
    role,
    displayName: roleRecord.displayName,
    access: {
      planType: roleRecord.planType,
      subscriptionStatus: roleRecord.subscriptionStatus,
      accessOverride: roleRecord.accessOverride,
      hasAccess: hasAcademyAccess(roleRecord),
      trialStartedAt: roleRecord.trialStartedAt,
      trialExpiresAt: roleRecord.trialExpiresAt,
    },
  } satisfies AcademyUser;
  next();
};

export const requireInstructor: RequestHandler = (_req, res, next): void => {
  const user = res.locals.academyUser as AcademyUser | undefined;
  if (user?.role !== "instructor" && user?.role !== "admin") {
    res.status(403).json({ error: "Instructor access is required." });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (_req, res, next): void => {
  const user = res.locals.academyUser as AcademyUser | undefined;
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
};

export const requireCourseAccess: RequestHandler = (_req, res, next): void => {
  const user = res.locals.academyUser as AcademyUser | undefined;
  if (!user) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (user.role === "student" && !user.access.hasAccess) {
    res.status(403).json({ error: "Your academy access is not active." });
    return;
  }
  next();
};

export function getAcademyUser(res: {
  locals: Record<string, unknown>;
}): AcademyUser {
  return res.locals.academyUser as AcademyUser;
}
