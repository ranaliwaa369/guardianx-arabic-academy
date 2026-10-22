import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  hasAcademyAccess,
  requireAdmin,
  requireCourseAccess,
  type AcademyUser,
} from "./academyAuth";

function account(
  overrides: Partial<Parameters<typeof hasAcademyAccess>[0]> = {},
): Parameters<typeof hasAcademyAccess>[0] {
  return {
    userId: "test-user",
    role: "student",
    email: null,
    displayName: null,
    createdAt: new Date(),
    lastSeenAt: new Date(),
    initialAdminGrantApplied: false,
    showTransliteration: true,
    showTashkeel: true,
    planType: "beta",
    subscriptionStatus: "beta",
    trialStartedAt: null,
    trialExpiresAt: null,
    accessOverride: "inherit",
    billingProvider: null,
    externalCustomerId: null,
    externalSubscriptionId: null,
    accessChangedAt: null,
    accessChangedBy: null,
    ...overrides,
  };
}

function user(role: AcademyUser["role"], hasAccess: boolean): AcademyUser {
  return {
    userId: "test-user",
    role,
    displayName: null,
    access: {
      planType: "beta",
      subscriptionStatus: "beta",
      accessOverride: hasAccess ? "inherit" : "revoke",
      hasAccess,
      trialStartedAt: null,
      trialExpiresAt: null,
    },
  };
}

function invoke(
  handler: RequestHandler,
  academyUser: AcademyUser,
) {
  const result: { status?: number; body?: unknown; nextCalled: boolean } = {
    nextCalled: false,
  };
  const response = {
    locals: { academyUser },
    status(status: number) {
      result.status = status;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;

  handler({} as Request, response, (() => {
    result.nextCalled = true;
  }) as NextFunction);
  return result;
}

test("beta learners have access by default", () => {
  assert.equal(hasAcademyAccess(account()), true);
});

test("paid accounts allow active and past-due grace states only", () => {
  assert.equal(
    hasAcademyAccess(
      account({ planType: "paid", subscriptionStatus: "active" }),
    ),
    true,
  );
  assert.equal(
    hasAcademyAccess(
      account({ planType: "paid", subscriptionStatus: "past_due" }),
    ),
    true,
  );
  assert.equal(
    hasAcademyAccess(
      account({ planType: "paid", subscriptionStatus: "canceled" }),
    ),
    false,
  );
});

test("trial access requires a current trial window", () => {
  const now = Date.now();
  assert.equal(
    hasAcademyAccess(
      account({
        planType: "trial",
        subscriptionStatus: "trialing",
        trialStartedAt: new Date(now - 60_000),
        trialExpiresAt: new Date(now + 60_000),
      }),
    ),
    true,
  );
  assert.equal(
    hasAcademyAccess(
      account({
        planType: "trial",
        subscriptionStatus: "trialing",
        trialStartedAt: new Date(now - 120_000),
        trialExpiresAt: new Date(now - 60_000),
      }),
    ),
    false,
  );
});

test("manual access overrides take precedence over plan status", () => {
  assert.equal(
    hasAcademyAccess(
      account({
        planType: "paid",
        subscriptionStatus: "canceled",
        accessOverride: "grant",
      }),
    ),
    true,
  );
  assert.equal(
    hasAcademyAccess(
      account({
        planType: "beta",
        subscriptionStatus: "beta",
        accessOverride: "revoke",
      }),
    ),
    false,
  );
});

test("administrator endpoints reject learners and allow administrators", () => {
  const learner = invoke(requireAdmin, user("student", true));
  assert.equal(learner.status, 403);
  assert.equal(learner.nextCalled, false);

  const administrator = invoke(requireAdmin, user("admin", false));
  assert.equal(administrator.status, undefined);
  assert.equal(administrator.nextCalled, true);
});

test("course guard blocks revoked students but allows active students and staff", () => {
  const blocked = invoke(requireCourseAccess, user("student", false));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.nextCalled, false);

  const active = invoke(requireCourseAccess, user("student", true));
  assert.equal(active.status, undefined);
  assert.equal(active.nextCalled, true);

  const staff = invoke(requireCourseAccess, user("instructor", false));
  assert.equal(staff.status, undefined);
  assert.equal(staff.nextCalled, true);
});
