import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAcademyDashboardResponse,
  GetAcademyUnitResponse,
  ListAcademyFlashcardsQueryParams,
  ListAcademyFlashcardsResponse,
  ListInstructorReviewItemsResponse,
  ListLessonProgressResponse,
  ReviewAcademyFlashcardBody,
  ReviewAcademyFlashcardParams,
  ReviewAcademyFlashcardResponse,
  SaveLessonProgressBody,
  SaveLessonProgressParams,
  SaveLessonProgressResponse,
  SubmitActivityAnswerBody,
  SubmitActivityAnswerResponse,
  UpdateInstructorReviewItemBody,
  UpdateInstructorReviewItemParams,
  UpdateInstructorReviewItemResponse,
} from "@workspace/api-zod";
import {
  academyActivitiesTable,
  academyAttemptsTable,
  academyFlashcardReviewsTable,
  academyFlashcardsTable,
  academyLessonsTable,
  academyProgressTable,
  academyReviewItemsTable,
  academyUnitsTable,
  db,
} from "@workspace/db";
import {
  getAcademyUser,
  requireAcademyAuth,
  requireInstructor,
  type AcademyUser,
} from "../middlewares/academyAuth";

const router: IRouter = Router();

function parseVocabularyDraft(
  value: unknown,
):
  | {
      arabic: string;
      transliteration: string;
      english: string;
      example: string;
    }
  | null {
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Record<string, unknown>;
  const arabic =
    typeof draft.arabic === "string" ? draft.arabic.trim() : "";
  const transliteration =
    typeof draft.transliteration === "string"
      ? draft.transliteration.trim()
      : "";
  const english =
    typeof draft.english === "string" ? draft.english.trim() : "";
  const example =
    typeof draft.example === "string" ? draft.example.trim() : "";
  if (!arabic || !transliteration || !english || !example) return null;
  return { arabic, transliteration, english, example };
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function compareCompositeAnswer(
  type: string,
  submitted: string,
  expected: string,
): boolean {
  if (type === "matching") {
    try {
      const left = JSON.parse(submitted) as Record<string, string>;
      const right = JSON.parse(expected) as Record<string, string>;
      const leftPairs = Object.entries(left)
        .map(([key, value]) => [normalizeAnswer(key), normalizeAnswer(value)])
        .sort(([a], [b]) => a.localeCompare(b));
      const rightPairs = Object.entries(right)
        .map(([key, value]) => [normalizeAnswer(key), normalizeAnswer(value)])
        .sort(([a], [b]) => a.localeCompare(b));
      return JSON.stringify(leftPairs) === JSON.stringify(rightPairs);
    } catch {
      return false;
    }
  }

  if (type === "wordOrder" || type === "conversationSequence") {
    const expectedSentence = expected
      .split("|")
      .map(normalizeAnswer)
      .join(" ");
    return normalizeAnswer(submitted) === expectedSentence;
  }

  return expected
    .split("||")
    .some((alternative) => normalizeAnswer(alternative) === normalizeAnswer(submitted));
}

function presentAnswer(type: string, answer: string): string {
  if (type === "matching") {
    try {
      return Object.entries(JSON.parse(answer) as Record<string, string>)
        .map(([left, right]) => `${left} → ${right}`)
        .join(" · ");
    } catch {
      return answer;
    }
  }
  if (type === "wordOrder" || type === "conversationSequence") {
    return answer.split("|").join(" ");
  }
  return answer.split("||")[0] ?? answer;
}

function streakFromDates(dates: Date[]): number {
  const uniqueDays = new Set(
    dates.map((date) => date.toISOString().slice(0, 10)),
  );
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  const yesterday = cursor.toISOString().slice(0, 10);
  if (!uniqueDays.has(today) && !uniqueDays.has(yesterday)) return 0;
  if (!uniqueDays.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (uniqueDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function getDueReviewCount(userId: string): Promise<number> {
  const cards = await db
    .select({ id: academyFlashcardsTable.id })
    .from(academyFlashcardsTable);
  const reviews = await db
    .select({
      flashcardId: academyFlashcardReviewsTable.flashcardId,
      nextReviewAt: academyFlashcardReviewsTable.nextReviewAt,
    })
    .from(academyFlashcardReviewsTable)
    .where(eq(academyFlashcardReviewsTable.userId, userId));
  const reviewByCard = new Map(
    reviews.map((review) => [review.flashcardId, review.nextReviewAt]),
  );
  const now = Date.now();
  return cards.filter((card) => {
    const nextReviewAt = reviewByCard.get(card.id);
    return !nextReviewAt || nextReviewAt.getTime() <= now;
  }).length;
}

function presentReviewItem(item: typeof academyReviewItemsTable.$inferSelect) {
  return {
    ...item,
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.use("/academy", requireAcademyAuth);

router.get("/academy/dashboard", async (_req, res): Promise<void> => {
  const user = getAcademyUser(res);
  const lessons = await db
    .select({ id: academyLessonsTable.id })
    .from(academyLessonsTable);
  const progress = await db
    .select({
      lessonId: academyProgressTable.lessonId,
      completed: academyProgressTable.completed,
    })
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, user.userId));
  const completedIds = new Set(
    progress.filter((entry) => entry.completed).map((entry) => entry.lessonId),
  );
  const firstIncomplete = (
    await db
      .select({ id: academyLessonsTable.id })
      .from(academyLessonsTable)
      .where(eq(academyLessonsTable.unitId, "greetings-introductions"))
      .orderBy(asc(academyLessonsTable.sequence))
  ).find((lesson) => !completedIds.has(lesson.id));
  const attempts = await db
    .select({ createdAt: academyAttemptsTable.createdAt })
    .from(academyAttemptsTable)
    .where(eq(academyAttemptsTable.userId, user.userId));
  const progressDates = await db
    .select({ updatedAt: academyProgressTable.updatedAt })
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, user.userId));
  const dashboard = {
    role: user.role,
    displayName: user.displayName,
    progressPercent: lessons.length
      ? Math.round((completedIds.size / lessons.length) * 100)
      : 0,
    completedLessons: completedIds.size,
    totalLessons: lessons.length,
    currentStreakDays: streakFromDates([
      ...attempts.map((attempt) => attempt.createdAt),
      ...progressDates.map((entry) => entry.updatedAt),
    ]),
    nextLessonId: firstIncomplete?.id ?? null,
    dueReviews: await getDueReviewCount(user.userId),
  };
  res.json(GetAcademyDashboardResponse.parse(dashboard));
});

router.get("/academy/unit", async (_req, res): Promise<void> => {
  const user = getAcademyUser(res);
  const [unit] = await db
    .select()
    .from(academyUnitsTable)
    .where(eq(academyUnitsTable.id, "greetings-introductions"))
    .limit(1);
  if (!unit) {
    res.status(404).json({ error: "The beginner unit has not been seeded." });
    return;
  }
  const lessons = await db
    .select()
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.unitId, unit.id))
    .orderBy(asc(academyLessonsTable.sequence));
  const activities = await db
    .select()
    .from(academyActivitiesTable)
    .innerJoin(
      academyLessonsTable,
      eq(academyActivitiesTable.lessonId, academyLessonsTable.id),
    )
    .where(eq(academyLessonsTable.unitId, unit.id));
  const activityByLesson = new Map<
    string,
    (typeof activities)[number]["academy_activities"][]
  >();
  for (const { academy_activities: activity } of activities) {
    const list = activityByLesson.get(activity.lessonId) ?? [];
    list.push(activity);
    activityByLesson.set(activity.lessonId, list);
  }
  const cards = await db
    .select()
    .from(academyFlashcardsTable)
    .where(eq(academyFlashcardsTable.unitId, unit.id));
  const reviews = await db
    .select()
    .from(academyFlashcardReviewsTable)
    .where(eq(academyFlashcardReviewsTable.userId, user.userId));
  const reviewByCard = new Map(reviews.map((review) => [review.flashcardId, review]));
  const now = Date.now();
  const response = {
    ...unit,
    lessons: lessons.map((lesson) => ({
      ...lesson,
      activities: (activityByLesson.get(lesson.id) ?? []).map((activity) => ({
        ...activity,
        audioAvailable: false,
        audioNotice:
          "Audio examples are not configured yet. Text and pronunciation guidance are available; audio playback will appear when a speech provider is approved and configured.",
      })),
    })),
    vocabulary: cards.map((card) => {
      const review = reviewByCard.get(card.id);
      return {
        ...card,
        due: !review || review.nextReviewAt.getTime() <= now,
        reviewCount: review?.reviewCount ?? 0,
        known: review?.known ?? false,
      };
    }),
  };
  res.json(GetAcademyUnitResponse.parse(response));
});

router.get("/academy/progress", async (_req, res): Promise<void> => {
  const user = getAcademyUser(res);
  const progress = await db
    .select()
    .from(academyProgressTable)
    .where(eq(academyProgressTable.userId, user.userId));
  res.json(
    ListLessonProgressResponse.parse(
      progress.map((entry) => ({ ...entry, updatedAt: toIso(entry.updatedAt) })),
    ),
  );
});

router.put("/academy/progress/:lessonId", async (req, res): Promise<void> => {
  const params = SaveLessonProgressParams.safeParse(req.params);
  const body = SaveLessonProgressBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid lesson progress update." });
    return;
  }
  const user = getAcademyUser(res);
  const [lesson] = await db
    .select({ id: academyLessonsTable.id })
    .from(academyLessonsTable)
    .where(eq(academyLessonsTable.id, params.data.lessonId))
    .limit(1);
  if (!lesson) {
    res.status(404).json({ error: "Lesson not found." });
    return;
  }
  const [saved] = await db
    .insert(academyProgressTable)
    .values({
      userId: user.userId,
      lessonId: params.data.lessonId,
      currentStep: body.data.currentStep,
      completed: body.data.completed,
      latestScore: body.data.latestScore ?? null,
    })
    .onConflictDoUpdate({
      target: [academyProgressTable.userId, academyProgressTable.lessonId],
      set: {
        currentStep: body.data.currentStep,
        completed: body.data.completed,
        latestScore: body.data.latestScore ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  res.json(
    SaveLessonProgressResponse.parse({
      ...saved,
      updatedAt: toIso(saved.updatedAt),
    }),
  );
});

router.post(
  "/academy/activities/answer",
  async (req, res): Promise<void> => {
    const body = SubmitActivityAnswerBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Provide an activity and an answer." });
      return;
    }
    const user = getAcademyUser(res);
    const [activity] = await db
      .select()
      .from(academyActivitiesTable)
      .where(eq(academyActivitiesTable.id, body.data.activityId))
      .limit(1);
    if (!activity) {
      res.status(404).json({ error: "Activity not found." });
      return;
    }

    const correct = compareCompositeAnswer(
      activity.type,
      body.data.answer,
      activity.correctAnswer,
    );
    const previousAttempts = await db
      .select({ id: academyAttemptsTable.id })
      .from(academyAttemptsTable)
      .where(
        and(
          eq(academyAttemptsTable.userId, user.userId),
          eq(academyAttemptsTable.activityId, activity.id),
        ),
      );
    const attemptNumber = previousAttempts.length + 1;
    await db.insert(academyAttemptsTable).values({
      userId: user.userId,
      activityId: activity.id,
      answer: body.data.answer,
      correct,
    });
    await db
      .insert(academyProgressTable)
      .values({
        userId: user.userId,
        lessonId: activity.lessonId,
        currentStep: "practice",
        completed: false,
        latestScore: correct ? 100 : 0,
      })
      .onConflictDoUpdate({
        target: [academyProgressTable.userId, academyProgressTable.lessonId],
        set: { latestScore: correct ? 100 : 0, updatedAt: new Date() },
      });

    res.json(
      SubmitActivityAnswerResponse.parse({
        correct,
        score: correct ? 100 : 0,
        feedback: correct
          ? "Correct. Keep going."
          : "Not quite yet. Review the explanation, then try again.",
        correctAnswer: presentAnswer(activity.type, activity.correctAnswer),
        explanation: activity.explanation,
        attemptNumber,
      }),
    );
  },
);

router.get("/academy/flashcards", async (req, res): Promise<void> => {
  const params = ListAcademyFlashcardsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "Invalid flashcard search." });
    return;
  }
  const user = getAcademyUser(res);
  const query = params.data.q?.trim();
  const cards = await db
    .select()
    .from(academyFlashcardsTable)
    .where(
      query
        ? or(
            ilike(academyFlashcardsTable.arabic, `%${query}%`),
            ilike(academyFlashcardsTable.english, `%${query}%`),
            ilike(academyFlashcardsTable.transliteration, `%${query}%`),
          )
        : undefined,
    );
  const reviews = await db
    .select()
    .from(academyFlashcardReviewsTable)
    .where(eq(academyFlashcardReviewsTable.userId, user.userId));
  const reviewByCard = new Map(reviews.map((review) => [review.flashcardId, review]));
  const now = Date.now();
  res.json(
    ListAcademyFlashcardsResponse.parse(
      cards.map((card) => {
        const review = reviewByCard.get(card.id);
        return {
          ...card,
          due: !review || review.nextReviewAt.getTime() <= now,
          reviewCount: review?.reviewCount ?? 0,
          known: review?.known ?? false,
        };
      }),
    ),
  );
});

router.post(
  "/academy/flashcards/:flashcardId/review",
  async (req, res): Promise<void> => {
    const params = ReviewAcademyFlashcardParams.safeParse(req.params);
    const body = ReviewAcademyFlashcardBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid flashcard review." });
      return;
    }
    const user = getAcademyUser(res);
    const [card] = await db
      .select({ id: academyFlashcardsTable.id })
      .from(academyFlashcardsTable)
      .where(eq(academyFlashcardsTable.id, params.data.flashcardId))
      .limit(1);
    if (!card) {
      res.status(404).json({ error: "Flashcard not found." });
      return;
    }
    const [previous] = await db
      .select()
      .from(academyFlashcardReviewsTable)
      .where(
        and(
          eq(academyFlashcardReviewsTable.userId, user.userId),
          eq(academyFlashcardReviewsTable.flashcardId, card.id),
        ),
      )
      .limit(1);
    const reviewCount = body.data.remembered
      ? (previous?.reviewCount ?? 0) + 1
      : 0;
    const intervals = [1, 3, 7, 14, 30];
    const intervalDays = body.data.remembered
      ? intervals[Math.min(reviewCount - 1, intervals.length - 1)] ?? 30
      : 1;
    const now = new Date();
    const nextReviewAt = new Date(
      now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
    );
    const [saved] = await db
      .insert(academyFlashcardReviewsTable)
      .values({
        userId: user.userId,
        flashcardId: card.id,
        reviewCount,
        known: body.data.remembered,
        lastReviewedAt: now,
        nextReviewAt,
      })
      .onConflictDoUpdate({
        target: [
          academyFlashcardReviewsTable.userId,
          academyFlashcardReviewsTable.flashcardId,
        ],
        set: {
          reviewCount,
          known: body.data.remembered,
          lastReviewedAt: now,
          nextReviewAt,
        },
      })
      .returning();
    res.json(
      ReviewAcademyFlashcardResponse.parse({
        flashcardId: saved.flashcardId,
        reviewCount: saved.reviewCount,
        known: saved.known,
        nextReviewAt: saved.nextReviewAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/academy/review-queue",
  requireInstructor,
  async (_req, res): Promise<void> => {
    const items = await db
      .select()
      .from(academyReviewItemsTable)
      .where(eq(academyReviewItemsTable.status, "pending"))
      .orderBy(asc(academyReviewItemsTable.updatedAt));
    res.json(
      ListInstructorReviewItemsResponse.parse(items.map(presentReviewItem)),
    );
  },
);

router.patch(
  "/academy/review-queue/:reviewItemId",
  requireInstructor,
  async (req, res): Promise<void> => {
    const params = UpdateInstructorReviewItemParams.safeParse(req.params);
    const body = UpdateInstructorReviewItemBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid review queue update." });
      return;
    }
    const [item] = await db
      .select()
      .from(academyReviewItemsTable)
      .where(eq(academyReviewItemsTable.id, params.data.reviewItemId))
      .limit(1);
    if (!item || item.status !== "pending") {
      res.status(404).json({ error: "Pending review item not found." });
      return;
    }

    const update = body.data;
    if (update.action === "edit") {
      const [saved] = await db
        .update(academyReviewItemsTable)
        .set({
          draftContent: update.draftContent,
          tags: update.tags,
          updatedAt: new Date(),
        })
        .where(eq(academyReviewItemsTable.id, item.id))
        .returning();
      res.json(UpdateInstructorReviewItemResponse.parse(presentReviewItem(saved)));
      return;
    }

    if (update.action === "approve") {
      let parsedDraft: unknown;
      try {
        parsedDraft = JSON.parse(update.draftContent);
      } catch {
        res.status(400).json({
          error: "Edit the vocabulary draft as valid JSON before approval.",
        });
        return;
      }
      const draft = parseVocabularyDraft(parsedDraft);
      if (!draft || item.contentType !== "vocabulary") {
        res.status(400).json({
          error: "This demo queue can publish valid vocabulary entries only.",
        });
        return;
      }
      await db
        .insert(academyFlashcardsTable)
        .values({
          id: `approved-${item.id}`,
          unitId: "greetings-introductions",
          ...draft,
        })
        .onConflictDoNothing();
      const [saved] = await db
        .update(academyReviewItemsTable)
        .set({ draftContent: update.draftContent, tags: update.tags, status: "approved", updatedAt: new Date() })
        .where(eq(academyReviewItemsTable.id, item.id))
        .returning();
      res.json(UpdateInstructorReviewItemResponse.parse(presentReviewItem(saved)));
      return;
    }

    if (update.action === "reject") {
      const [saved] = await db
        .update(academyReviewItemsTable)
        .set({ tags: update.tags, status: "rejected", updatedAt: new Date() })
        .where(eq(academyReviewItemsTable.id, item.id))
        .returning();
      res.json(UpdateInstructorReviewItemResponse.parse(presentReviewItem(saved)));
      return;
    }

    if (!update.mergeIntoId || update.mergeIntoId === item.id) {
      res.status(400).json({ error: "Choose a different pending item to merge into." });
      return;
    }
    const [target] = await db
      .select()
      .from(academyReviewItemsTable)
      .where(
        and(
          eq(academyReviewItemsTable.id, update.mergeIntoId),
          eq(academyReviewItemsTable.status, "pending"),
        ),
      )
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Pending merge target not found." });
      return;
    }
    await db
      .update(academyReviewItemsTable)
      .set({
        sourceExcerpt: `${target.sourceExcerpt}\n\nMerged source: ${item.sourceExcerpt}`,
        tags: [...new Set([...target.tags, ...update.tags])],
        updatedAt: new Date(),
      })
      .where(eq(academyReviewItemsTable.id, target.id));
    const [saved] = await db
      .update(academyReviewItemsTable)
      .set({
        status: "merged",
        mergedIntoId: target.id,
        updatedAt: new Date(),
      })
      .where(eq(academyReviewItemsTable.id, item.id))
      .returning();
    res.json(UpdateInstructorReviewItemResponse.parse(presentReviewItem(saved)));
  },
);

export default router;
