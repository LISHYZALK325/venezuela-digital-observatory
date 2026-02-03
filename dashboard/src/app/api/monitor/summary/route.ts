import { NextResponse } from 'next/server';
import { getMonitorCollection } from '@/lib/mongodb';

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const { checks } = await getMonitorCollection();

    // Get the latest check
    const latestCheck = await checks.findOne({}, { sort: { checkedAt: -1 } });

    if (!latestCheck) {
      return NextResponse.json(
        { error: 'No check data available' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      checkedAt: latestCheck.checkedAt,
      checkDuration: latestCheck.checkDuration,
      summary: latestCheck.summary,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary data' },
      { status: 500 }
    );
  }
}
