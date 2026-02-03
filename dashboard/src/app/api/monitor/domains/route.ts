import { NextRequest, NextResponse } from 'next/server';
import { getMonitorCollection } from '@/lib/mongodb';
import { domainsQuerySchema } from '@/lib/validation';

export const revalidate = 60; // Cache for 60 seconds

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = domainsQuerySchema.parse(searchParams);

    const { checks, domains } = await getMonitorCollection();

    // Get the latest check ID
    const latestCheck = await checks.findOne({}, { sort: { checkedAt: -1 } });

    if (!latestCheck) {
      return NextResponse.json({ domains: [], total: 0, page: 1, limit: query.limit });
    }

    // Build filter
    const filter: Record<string, unknown> = {
      checkId: latestCheck._id,
    };

    if (query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.ssl !== 'all') {
      switch (query.ssl) {
        case 'valid':
          filter['ssl.valid'] = true;
          break;
        case 'invalid':
          filter['ssl.enabled'] = true;
          filter['ssl.valid'] = false;
          break;
        case 'none':
          filter.$or = [{ ssl: null }, { 'ssl.enabled': false }];
          break;
      }
    }

    if (query.search) {
      // Escape special regex characters to prevent ReDoS
      const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.domain = { $regex: escapedSearch, $options: 'i' };
    }

    // HTTP code filter
    if (query.httpCode !== 'all') {
      switch (query.httpCode) {
        case '2xx':
          filter.httpCode = { $gte: 200, $lt: 300 };
          break;
        case '3xx':
          filter.httpCode = { $gte: 300, $lt: 400 };
          break;
        case '4xx':
          filter.httpCode = { $gte: 400, $lt: 500 };
          break;
        case '5xx':
          filter.httpCode = { $gte: 500, $lt: 600 };
          break;
        case 'error':
          filter.$or = [{ httpCode: null }, { httpCode: 0 }];
          break;
      }
    }

    // Build sort - for status sort, online comes first (asc means online first)
    let sortField: string;
    let sortOrder: 1 | -1;

    if (query.sort === 'status') {
      // For status: asc = online first (alphabetically 'online' < 'offline' is false, so we need desc)
      sortField = 'status';
      sortOrder = query.order === 'asc' ? -1 : 1; // Invert because 'online' should come first
    } else {
      sortField = query.sort === 'domain' ? 'domain' : query.sort;
      sortOrder = query.order === 'asc' ? 1 : -1;
    }

    // Execute query
    const skip = (query.page - 1) * query.limit;

    const [domainResults, total] = await Promise.all([
      domains
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(query.limit)
        .project({
          _id: 0,
          domain: 1,
          status: 1,
          httpCode: 1,
          responseTime: 1,
          ssl: 1,
          headers: 1,
          error: 1,
          checkedAt: 1,
          finalUrl: 1,
        })
        .toArray(),
      domains.countDocuments(filter),
    ]);

    return NextResponse.json({
      domains: domainResults,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    });
  } catch (error) {
    console.error('Error fetching domains:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}
