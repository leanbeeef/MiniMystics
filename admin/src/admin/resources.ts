import { getModelByName } from '@adminjs/prisma';
import { ValidationError, type ActionContext, type ActionRequest, type ActionResponse, type ResourceWithOptions } from 'adminjs';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/index.js';
import { Components } from './component-loader.js';

type Role = 'SUPER_ADMIN' | 'GAME_ADMIN' | 'MODERATOR' | 'SUPPORT';
type ResourceSpec = {
  model: string;
  section: string;
  writeRoles?: Role[];
  options?: ResourceWithOptions['options'];
  audit?: boolean;
};

const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'GAME_ADMIN', 'MODERATOR', 'SUPPORT'];
const SUPER_ADMIN: Role[] = ['SUPER_ADMIN'];
const GAME_ADMINS: Role[] = ['SUPER_ADMIN', 'GAME_ADMIN'];
const MODERATORS: Role[] = ['SUPER_ADMIN', 'MODERATOR'];
const SOCIAL_READERS: Role[] = ['SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];
const OPERATIONS_READERS: Role[] = ['SUPER_ADMIN', 'GAME_ADMIN', 'SUPPORT'];

const roleOf = (context: ActionContext) => context.currentAdmin?.role as Role | undefined;
const allowed = (roles: Role[]) => (context: ActionContext) => {
  const role = roleOf(context);
  return Boolean(role && roles.includes(role));
};

const scrub = (value: unknown): Prisma.InputJsonObject | null => {
  if (!value || typeof value !== 'object') return null;
  const safe = JSON.parse(JSON.stringify(value)) as Record<string, Prisma.InputJsonValue>;
  for (const key of Object.keys(safe)) {
    if (/password|token|secret|cookie/i.test(key)) safe[key] = '[REDACTED]';
  }
  return safe as Prisma.InputJsonObject;
};

const captureOldValue = async (request: ActionRequest, context: ActionContext) => {
  if (request.method === 'post') (context as ActionContext & { auditOldValue?: unknown }).auditOldValue = scrub(context.record?.params);
  return request;
};

const auditAfter = (action: string) => async (response: ActionResponse, request: ActionRequest, context: ActionContext) => {
  const adminId = context.currentAdmin?.id;
  if (request.method !== 'post' || !adminId) return response;
  const record = 'record' in response ? response.record : undefined;
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: String(adminId),
      action,
      resource: context.resource.id(),
      recordId: record?.id ? String(record.id) : context.record?.id().toString(),
      oldValue: scrub((context as ActionContext & { auditOldValue?: unknown }).auditOldValue) ?? undefined,
      newValue: scrub(record?.params) ?? undefined,
      reason: typeof request.payload?.reason === 'string'
        ? request.payload.reason
        : typeof request.payload?.rejectionReason === 'string'
          ? request.payload.rejectionReason
          : undefined,
    },
  });
  return response;
};

const stampModeration = (reasonField: 'reason' | 'rejectionReason') => async (request: ActionRequest, context: ActionContext) => {
  if (request.method !== 'post') return request;
  const status = String(request.payload?.moderationStatus ?? request.payload?.status ?? '');
  const reason = String(request.payload?.[reasonField] ?? '').trim();
  if (['REJECTED', 'REMOVED'].includes(status) && reason.length < 3) {
    throw new ValidationError({ [reasonField]: { message: 'A reason is required for rejected or removed content.' } });
  }
  request.payload = {
    ...request.payload,
    reviewedById: String(context.currentAdmin?.id),
    reviewedAt: new Date().toISOString(),
  };
  return captureOldValue(request, context);
};

const stampHandlerModeration = async (request: ActionRequest, context: ActionContext) => {
  const forcedRename = request.payload?.forcedRename === true || request.payload?.forcedRename === 'true';
  if (request.method === 'post' && forcedRename) {
    request.payload = {
      ...request.payload,
      prohibitedAt: new Date().toISOString(),
      prohibitedById: String(context.currentAdmin?.id),
    };
  }
  return captureOldValue(request, context);
};

const stampProhibitedNameCreator = async (request: ActionRequest, context: ActionContext) => {
  if (request.method === 'post') {
    request.payload = { ...request.payload, createdById: String(context.currentAdmin?.id) };
  }
  return request;
};

const adjustBalance = {
  actionType: 'record' as const,
  icon: 'Money',
  component: Components.AdjustBalance,
  isAccessible: allowed(GAME_ADMINS),
  handler: async (request: ActionRequest, _response: ActionResponse, context: ActionContext) => {
    if (!context.record) throw new ValidationError({ profile: { message: 'Player profile not found.' } });
    if (request.method !== 'post') return { record: context.record.toJSON(context.currentAdmin) };

    const currency = request.payload?.currency === 'PREMIUM' ? 'PREMIUM' : 'COINS';
    const amount = Number(request.payload?.amount);
    const reason = String(request.payload?.reason ?? '').trim();
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
      throw new ValidationError({ amount: { message: 'Enter a non-zero whole number between -1,000,000 and 1,000,000.' } });
    }
    if (reason.length < 8) throw new ValidationError({ reason: { message: 'Provide a reason of at least 8 characters.' } });

    const profileId = context.record.id().toString();
    const adminUserId = String(context.currentAdmin?.id);
    await prisma.$transaction(async (transaction) => {
      const profile = await transaction.playerProfile.findUniqueOrThrow({ where: { id: profileId } });
      const balanceBefore = currency === 'COINS' ? profile.coins : profile.premiumCurrency;
      const balanceAfter = balanceBefore + amount;
      if (balanceAfter < 0) throw new ValidationError({ amount: { message: 'The adjustment cannot make the balance negative.' } });

      await transaction.playerProfile.update({
        where: { id: profileId },
        data: currency === 'COINS' ? { coins: balanceAfter } : { premiumCurrency: balanceAfter },
      });
      const adjustment = await transaction.adminAdjustmentTransaction.create({
        data: { adminUserId, profileId, currency, amount, balanceBefore, balanceAfter, reason },
      });
      await transaction.currencyTransaction.create({
        data: {
          profileId,
          currency,
          kind: 'ADJUSTMENT',
          amount,
          balanceAfter,
          referenceType: 'AdminAdjustmentTransaction',
          referenceId: adjustment.id,
          idempotencyKey: `admin-adjustment:${randomUUID()}`,
        },
      });
      await transaction.adminAuditLog.create({
        data: {
          adminUserId,
          action: 'adjustBalance',
          resource: 'PlayerProfile',
          recordId: profileId,
          oldValue: { currency, balance: balanceBefore },
          newValue: { currency, balance: balanceAfter, amount },
          reason,
        },
      });
    });

    return {
      record: context.record.toJSON(context.currentAdmin),
      redirectUrl: context.h.resourceUrl({ resourceId: context.resource.id() }),
      notice: { message: 'Balance adjusted and audit records created.', type: 'success' as const },
    };
  },
};

const accessActions = (writeRoles: Role[] | undefined, audit = true, readRoles = ALL_ROLES) => {
  const canRead = allowed(readRoles);
  const canWrite = allowed(writeRoles ?? []);
  return {
    list: { isAccessible: canRead },
    show: { isAccessible: canRead },
    search: { isAccessible: canRead },
    new: { isAccessible: canWrite, after: audit ? auditAfter('create') : undefined },
    edit: { isAccessible: canWrite, before: audit ? captureOldValue : undefined, after: audit ? auditAfter('edit') : undefined },
    delete: { isAccessible: canWrite, before: audit ? captureOldValue : undefined, after: audit ? auditAfter('delete') : undefined },
    bulkDelete: { isAccessible: false },
  };
};

const immutableProperties = (names: string[]) => Object.fromEntries(names.map((name) => [name, { isDisabled: true }]));
const imageProperty = () => ({
  custom: { baseUrl: process.env.PUBLIC_GAME_URL ?? '' },
  components: { show: Components.ImagePreview },
});

const specs: ResourceSpec[] = [
  { model: 'User', section: 'Players', options: { actions: accessActions(undefined), properties: { passwordHash: { isVisible: false }, ...immutableProperties(['firebaseUid', 'email', 'username']) }, listProperties: ['id', 'firebaseUid', 'email', 'username', 'createdAt'] } },
  { model: 'PlayerProfile', section: 'Players', writeRoles: MODERATORS, options: { actions: { ...accessActions(MODERATORS), adjustBalance }, editProperties: ['tagline', 'region', 'allegiance', 'avatarPath', 'favoriteMysticId'], properties: { ...immutableProperties(['level', 'xp', 'coins', 'premiumCurrency', 'rankedRating', 'wins', 'losses', 'starterGranted']), avatarPath: imageProperty() } } },
  { model: 'HandlerName', section: 'Players', writeRoles: MODERATORS, options: { actions: { ...accessActions(MODERATORS), edit: { isAccessible: allowed(MODERATORS), before: stampHandlerModeration, after: auditAfter('edit') } }, editProperties: ['forcedRename'], listProperties: ['displayName', 'normalizedName', 'forcedRename', 'prohibitedAt', 'updatedAt'] } },
  { model: 'AuthAccount', section: 'Players', options: { actions: accessActions(undefined), listProperties: ['userId', 'provider', 'providerAccountId', 'emailVerified', 'createdAt'] } },
  { model: 'Session', section: 'Players', options: { actions: accessActions(undefined), properties: { tokenHash: { isVisible: false } }, listProperties: ['userId', 'expiresAt', 'createdAt'] } },
  { model: 'PlayerGameState', section: 'Players', options: { actions: accessActions(undefined, false, OPERATIONS_READERS), properties: { state: { isVisible: { list: false, filter: false, show: true, edit: false } } }, listProperties: ['profileId', 'version', 'updatedAt'] } },
  { model: 'GameActivity', section: 'Players', options: { actions: accessActions(undefined, false, OPERATIONS_READERS), listProperties: ['profileId', 'type', 'createdAt'] } },
  { model: 'ComicProgress', section: 'Players', options: { actions: accessActions(undefined, false, OPERATIONS_READERS), listProperties: ['profileId', 'volumeId', 'pageIndex', 'completed', 'updatedAt'] } },
  { model: 'Friendship', section: 'Social', writeRoles: MODERATORS, options: { actions: accessActions(MODERATORS, true, SOCIAL_READERS), editProperties: ['status'], listProperties: ['requesterId', 'addresseeId', 'status', 'createdAt', 'updatedAt'] } },
  { model: 'AvatarUpload', section: 'Moderation', writeRoles: MODERATORS, options: { actions: { ...accessActions(MODERATORS, true, MODERATORS), edit: { isAccessible: allowed(MODERATORS), before: stampModeration('rejectionReason'), after: auditAfter('edit') } }, editProperties: ['moderationStatus', 'rejectionReason'], listProperties: ['profileId', 'moderationStatus', 'automatedResult', 'automatedScore', 'uploadedAt'], properties: { privateObjectKey: { isVisible: { list: false, filter: false, show: true, edit: false } }, publicObjectKey: { ...imageProperty(), isDisabled: true } } } },
  { model: 'ModerationRecord', section: 'Moderation', writeRoles: MODERATORS, options: { actions: { ...accessActions(MODERATORS, true, MODERATORS), edit: { isAccessible: allowed(MODERATORS), before: stampModeration('reason'), after: auditAfter('edit') } }, editProperties: ['status', 'reason', 'notes'], listProperties: ['type', 'targetId', 'status', 'reason', 'reviewedAt', 'createdAt'] } },
  { model: 'ProhibitedHandlerName', section: 'Moderation', writeRoles: MODERATORS, options: { actions: { ...accessActions(MODERATORS, true, MODERATORS), new: { isAccessible: allowed(MODERATORS), before: stampProhibitedNameCreator, after: auditAfter('create') } }, properties: { createdById: { isVisible: false } }, listProperties: ['normalizedName', 'matchType', 'reason', 'active', 'updatedAt'] } },

  { model: 'CardDefinition', section: 'Game Content', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['id', 'kind', 'name', 'order', 'allegiance', 'rarity', 'active', 'imageFilename'], properties: { imageFilename: imageProperty() } } },
  { model: 'MysticDefinition', section: 'Game Content', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['id', 'power', 'defense', 'baseAttack', 'needsReview'] } },
  { model: 'HandlerDefinition', section: 'Game Content', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['id', 'activationRoll', 'activationDice', 'effectType', 'maxUses', 'target'] } },
  { model: 'CampaignOpponent', section: 'Game Content', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS) } },
  { model: 'BoostDefinition', section: 'Game Content', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS) } },

  { model: 'PackDefinition', section: 'Packs & Economy', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['id', 'name', 'cardCount', 'coinPrice', 'premiumPrice', 'active', 'startsAt', 'endsAt'], properties: { artwork: imageProperty() } } },
  { model: 'PackOpening', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'PackOpeningResult', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'PityCounter', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'InventoryItem', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'ActiveBoost', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'OwnedCard', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'RewardTransaction', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'CurrencyTransaction', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'AdminAdjustmentTransaction', section: 'Packs & Economy', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },

  { model: 'Match', section: 'Battles', options: { actions: accessActions(undefined), listProperties: ['id', 'status', 'mode', 'timing', 'battleSize', 'winnerSide', 'turnDeadline', 'lastActionAt', 'startedAt', 'completedAt'], properties: { state: { isVisible: { list: false, filter: false, show: true, edit: false } } } } },
  { model: 'MatchParticipant', section: 'Battles', options: { actions: accessActions(undefined) } },
  { model: 'MatchCardState', section: 'Battles', options: { actions: accessActions(undefined) } },
  { model: 'MatchHandlerState', section: 'Battles', options: { actions: accessActions(undefined) } },
  { model: 'BattleEvent', section: 'Battles', options: { actions: accessActions(undefined), listProperties: ['matchId', 'sequence', 'turn', 'type', 'createdAt'] } },
  { model: 'CampaignProgress', section: 'Battles', options: { actions: accessActions(undefined) } },

  { model: 'TradeOffer', section: 'Trading & Market', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, OPERATIONS_READERS), listProperties: ['senderProfileId', 'recipientProfileId', 'status', 'createdAt', 'completedAt'] } },
  { model: 'TradeOfferItem', section: 'Trading & Market', options: { actions: accessActions(undefined, false, OPERATIONS_READERS), listProperties: ['tradeId', 'side', 'ownedCardId'] } },
  { model: 'MarketplaceListing', section: 'Trading & Market', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, OPERATIONS_READERS), listProperties: ['sellerId', 'ownedCardId', 'coinPrice', 'status', 'createdAt', 'completedAt'] } },
  { model: 'MarketplaceSale', section: 'Trading & Market', options: { actions: accessActions(undefined, false, OPERATIONS_READERS), listProperties: ['listingId', 'definitionId', 'sellerId', 'buyerId', 'coinPrice', 'completedAt'] } },

  { model: 'RankDefinition', section: 'Ranked & Leaderboards', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['sortOrder', 'name', 'minimumRating', 'maximumRating', 'active', 'artworkPath'], properties: { artworkPath: imageProperty() } } },
  { model: 'RankedRating', section: 'Ranked & Leaderboards', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'RankHistory', section: 'Ranked & Leaderboards', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'MultiplayerStatistic', section: 'Ranked & Leaderboards', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'LeaderboardRecord', section: 'Ranked & Leaderboards', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },

  { model: 'Season', section: 'Seasons & Challenges', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['number', 'name', 'startsAt', 'endsAt', 'active', 'premiumTrackEnabled'], properties: { artworkPath: imageProperty() } } },
  { model: 'SeasonPassTier', section: 'Seasons & Challenges', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), properties: { assetPath: imageProperty() } } },
  { model: 'PlayerSeasonProgress', section: 'Seasons & Challenges', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },
  { model: 'DailyChallengeDefinition', section: 'Seasons & Challenges', writeRoles: GAME_ADMINS, options: { actions: accessActions(GAME_ADMINS, true, GAME_ADMINS), listProperties: ['name', 'category', 'eventType', 'targetValue', 'rewardType', 'rewardAmount', 'difficulty', 'active'] } },
  { model: 'DailyChallengeAssignment', section: 'Seasons & Challenges', options: { actions: accessActions(undefined, true, OPERATIONS_READERS) } },

  { model: 'SavedLoadout', section: 'Player Collections', options: { actions: accessActions(undefined) } },
  { model: 'SavedLoadoutCard', section: 'Player Collections', options: { actions: accessActions(undefined) } },
  { model: 'CustomCollection', section: 'Player Collections', options: { actions: accessActions(undefined) } },
  { model: 'CustomCollectionCard', section: 'Player Collections', options: { actions: accessActions(undefined) } },

  { model: 'AdminUser', section: 'Administration', writeRoles: SUPER_ADMIN, options: { actions: { ...accessActions(SUPER_ADMIN, true, SUPER_ADMIN), new: { isAccessible: false }, delete: { isAccessible: false } }, properties: { passwordHash: { isVisible: false } }, editProperties: ['email', 'role', 'active'], listProperties: ['email', 'role', 'active', 'lastLoginAt', 'createdAt'] } },
  { model: 'AdminAuditLog', section: 'Administration', options: { actions: accessActions(undefined, false, SUPER_ADMIN), listProperties: ['adminUserId', 'action', 'resource', 'recordId', 'reason', 'createdAt'] } },
];

export const resources: ResourceWithOptions[] = specs.map((spec) => ({
  resource: { model: getModelByName(spec.model), client: prisma },
  options: {
    navigation: spec.section,
    ...spec.options,
  },
}));
