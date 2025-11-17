import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callsign = searchParams.get('callsign');

    const filePath = path.join(process.cwd(), 'public', 'api', 'v1', 'telemetry.json');
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!callsign) {
      return NextResponse.json({ error: 'Callsign parameter required' }, { status: 400 });
    }

    const telemetryData = data[callsign];

    if (!telemetryData) {
      return NextResponse.json({ error: 'Aircraft not found' }, { status: 404 });
    }

    return NextResponse.json(telemetryData);
  } catch (error) {
    console.error('Error reading telemetry data:', error);
    return NextResponse.json({ error: 'Failed to fetch telemetry data' }, { status: 500 });
  }
}
