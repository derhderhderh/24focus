import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callsign = searchParams.get('callsign');

    const filePath = path.join(process.cwd(), 'public', 'api', 'v1', 'flight-plans.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!callsign) {
      return NextResponse.json({ error: 'Callsign parameter required' }, { status: 400 });
    }

    const flightPlan = data[callsign];

    if (!flightPlan) {
      return NextResponse.json({ flightPlan: null, timestamp: Date.now() });
    }

    return NextResponse.json({
      flightPlan: flightPlan,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error reading flight plan data:', error);
    return NextResponse.json({ error: 'Failed to fetch flight plan' }, { status: 500 });
  }
}
