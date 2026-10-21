import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { academyUserRolesTable, db } from "@workspace/db";

export type AcademyRole = "student" | "instructor" | "admin";

export interface AcademyUser {
  userId: string;
  role: AcademyRole;
  displayName: string | null;
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
  const initialInstructorEmail = process.env.INITIAL_INSTRUCTOR_EMAIL
    ?.trim()
    .toLowerCase();

  const initialRole: AcademyRole =
    email && initialInstructorEmail && email === initialInstructorEmail
      ? "instructor"
      : "student";
  await db
    .insert(academyUserRolesTable)
    .values({ userId: auth.userId, role: initialRole })
    .onConflictDoNothing();

  const [roleRecord] = await db
    .select({ role: academyUserRolesTable.role })
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
    displayName:
      typeof claims?.firstName === "string" ? claims.firstName : null,
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

export function getAcademyUser(res: {
  locals: Record<string, unknown>;
}): AcademyUser {
  return res.locals.academyUser as AcademyUser;
}
