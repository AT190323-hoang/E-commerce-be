import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface PaginationParams {
  limit: number;
  offset: number;
}

const MAX_LIMIT = 100;

export const Paginate = createParamDecorator(
  (
    defaultValues: { limit?: number; offset?: number } | undefined,
    ctx: ExecutionContext,
  ): PaginationParams => {
    const request = ctx.switchToHttp().getRequest<{
      query: Record<string, string | string[] | undefined>;
    }>();
    const query = request.query ?? {};

    const defaultLimit = defaultValues?.limit ?? 20;
    const defaultOffset = defaultValues?.offset ?? 0;

    const queryLimit = Number(Array.isArray(query.limit) ? query.limit[0] : query.limit);
    const queryOffsetRaw = Array.isArray(query.offset)
      ? query.offset[0]
      : query.offset;
    const queryPageRaw = Array.isArray(query.page) ? query.page[0] : query.page;

    const limit = Number.isFinite(queryLimit)
      ? Math.min(Math.max(Math.floor(queryLimit), 1), MAX_LIMIT)
      : defaultLimit;

    const parsedOffset = Number(queryOffsetRaw);
    if (Number.isFinite(parsedOffset)) {
      return {
        limit,
        offset: Math.max(0, Math.floor(parsedOffset)),
      };
    }

    const parsedPage = Number(queryPageRaw);
    const page = Number.isFinite(parsedPage)
      ? Math.max(1, Math.floor(parsedPage))
      : 1;

    return {
      limit,
      offset: Math.max(0, defaultOffset + (page - 1) * limit),
    };
  },
);
