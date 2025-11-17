'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Aircraft {
  callsign: string;
  realcallsign: string;
  playerName: string;
  robloxName: string;
  aircraftType: string;
  aircraft: string;
  altitude: number;
  speed: number;
  heading: number;
}

interface Telemetry {
  callsign: string;
  realcallsign: string;
  altitude: number;
  speed: number;
  heading: number;
  playerName: string;
  robloxName: string;
  aircraftType: string;
  verticalSpeed: number;
  timestamp: number;
}

interface FlightPlan {
  callsign: string;
  realcallsign: string;
  robloxName: string;
  aircraft: string;
  flightrules: string;
  departing: string;
  arriving: string;
  route: string;
  flightlevel: string;
  cruiseSpeed: string;
}

interface AlertData {
  message: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  dismissible: boolean;
}

export default function Dashboard() {
  const [aircraftList, setAircraftList] = useState<Record<string, Aircraft>>({});
  const [selectedCallsign, setSelectedCallsign] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [flightPlan, setFlightPlan] = useState<FlightPlan | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Fetch aircraft list every 3 seconds
  useEffect(() => {
    const fetchAircraftList = async () => {
      try {
        const response = await fetch('/api/v1/aircraft-list');
        const data = await response.json();
        setAircraftList(data);
      } catch (error) {
        console.error('Error fetching aircraft list:', error);
      }
    };

    fetchAircraftList();
    const interval = setInterval(fetchAircraftList, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch telemetry for selected aircraft every 2 seconds
  useEffect(() => {
    if (!selectedCallsign) return;

    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`/api/v1/telemetry?callsign=${selectedCallsign}`);
        const data = await response.json();
        if (data.telemetry) {
          setTelemetry(data.telemetry);
          setAlerts(data.alerts || []);
        }
      } catch (error) {
        console.error('Error fetching telemetry:', error);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, [selectedCallsign]);

  // Fetch flight plan for selected aircraft every 5 seconds
  useEffect(() => {
    if (!selectedCallsign) return;

    const fetchFlightPlan = async () => {
      try {
        const response = await fetch(`/api/v1/flight-plans?callsign=${selectedCallsign}`);
        const data = await response.json();
        setFlightPlan(data.flightPlan || null);
      } catch (error) {
        console.error('Error fetching flight plan:', error);
      }
    };

    fetchFlightPlan();
    const interval = setInterval(fetchFlightPlan, 5000);
    return () => clearInterval(interval);
  }, [selectedCallsign]);

  const handleSelectAircraft = (callsign: string) => {
    setSelectedCallsign(callsign);
    setDismissedAlerts(new Set());
  };

  const dismissAlert = (alertKey: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertKey));
  };

  const activeAlerts = alerts.filter((alert) => {
    const alertKey = `${alert.severity}-${alert.message}`;
    return !dismissedAlerts.has(alertKey);
  });

  const generateATCScripts = () => {
    if (!flightPlan) return null;

    const callsign = flightPlan.realcallsign;
    const dep = flightPlan.departing;
    const dest = flightPlan.arriving;
    const aircraft = flightPlan.aircraft;
    const alt = flightPlan.flightlevel;
    const route = flightPlan.route;
    const isIFR = flightPlan.flightrules.toUpperCase() === 'IFR';

    if (!isIFR) {
      return (
        <div className="space-y-4">
          <ATCScript
            label="Ground - Taxi Clearance Request"
            text={`"${dep} Ground, ${callsign}, ${aircraft} at [location], VFR to ${dest}, request taxi with information [ATIS code]."`}
          />
          <ATCScript
            label="Tower - Takeoff Request"
            text={`"${dep} Tower, ${callsign}, ready for departure runway [RWY], VFR to the [direction], ${alt}."`}
          />
          <ATCScript
            label="Departure - Frequency Change"
            text={`"${dep} Departure, ${callsign}, ${telemetry?.altitude || '[ALT]'} climbing ${alt}, VFR to ${dest}."`}
          />
          <ATCScript
            label="Approach - Arrival Request"
            text={`"${dest} Approach, ${callsign}, ${telemetry?.altitude || '[ALT]'}, with information [ATIS], inbound for landing."`}
          />
          <ATCScript
            label="Tower - Landing Request"
            text={`"${dest} Tower, ${callsign}, [position], runway [RWY] in sight."`}
          />
          <ATCScript
            label="Ground - Taxi to Parking"
            text={`"${dest} Ground, ${callsign}, clear of runway [RWY], taxi to parking."`}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ATCScript
          label="Clearance Delivery - IFR Clearance Request"
          text={`"${dep} Clearance, ${callsign}, IFR to ${dest}, flight level ${alt}, request clearance."`}
        />
        <ATCScript
          label="Clearance Delivery - Read Back"
          text={`"${callsign} is cleared to ${dest} via ${route}, climb and maintain flight level ${alt}, departure frequency [FREQ], squawk [CODE]."`}
        />
        <ATCScript
          label="Ground - Taxi Request"
          text={`"${dep} Ground, ${callsign}, ${aircraft} at [location], IFR to ${dest}, information [ATIS], request taxi."`}
        />
        <ATCScript
          label="Tower - Ready for Departure"
          text={`"${dep} Tower, ${callsign}, holding short runway [RWY], ready for departure."`}
        />
        <ATCScript
          label="Departure - Check In"
          text={`"${dep} Departure, ${callsign}, ${telemetry?.altitude || '[ALT]'} climbing flight level ${alt}."`}
        />
        <ATCScript
          label="Center - En Route Contact"
          text={`"[Center], ${callsign}, level flight level ${alt}, ${route}."`}
        />
        <ATCScript
          label="Approach - Initial Contact"
          text={`"${dest} Approach, ${callsign}, descending to flight level ${alt}, information [ATIS]."`}
        />
        <ATCScript
          label="Approach - Approach Clearance"
          text={`"${callsign}, cleared [approach type] runway [RWY] approach."`}
        />
        <ATCScript
          label="Tower - Handoff from Approach"
          text={`"${dest} Tower, ${callsign}, [approach type] runway [RWY]."`}
        />
        <ATCScript
          label="Ground - Taxi to Parking"
          text={`"${dest} Ground, ${callsign}, clear of runway [RWY], taxi to parking."`}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Alert Banner */}
      {activeAlerts.map((alert, idx) => {
        const alertKey = `${alert.severity}-${alert.message}`;
        return (
          <Alert
            key={idx}
            className="fixed top-6 right-6 max-w-md z-50 border-2"
            variant={alert.severity === 'critical' ? 'destructive' : 'default'}
          >
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{alert.message}</span>
              {alert.dismissible && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissAlert(alertKey)}
                  className="shrink-0"
                >
                  ×
                </Button>
              )}
            </AlertDescription>
          </Alert>
        );
      })}

      <div className="container mx-auto">
        <h1 className="text-4xl font-bold text-cyan-400 mb-8 text-center">
          ATC24 Pilot Focus Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Aircraft Selection Sidebar */}
          <Card className="lg:col-span-1 p-6 bg-slate-800/50 border-slate-700">
            <h2 className="text-xl font-semibold text-cyan-400 mb-4">Aircraft Selection</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {Object.entries(aircraftList).map(([callsign, aircraft]) => (
                <Card
                  key={callsign}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedCallsign === callsign
                      ? 'bg-cyan-500/20 border-cyan-400'
                      : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                  }`}
                  onClick={() => handleSelectAircraft(callsign)}
                >
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-400">Real Callsign:</span>
                      <p className="text-white font-semibold">{aircraft.realcallsign}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">User Callsign:</span>
                      <p className="text-white">{callsign}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Aircraft:</span>
                      <p className="text-white">{aircraft.aircraftType}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Pilot:</span>
                      <p className="text-white">{aircraft.playerName}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Telemetry */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">Live Telemetry</h2>
              {telemetry ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TelemetryItem label="Altitude" value={`${telemetry.altitude} ft`} />
                  <TelemetryItem
                    label="Speed"
                    value={`${telemetry.speed} kts`}
                    warning={telemetry.altitude < 2000 && telemetry.speed > 200}
                  />
                  <TelemetryItem label="Heading" value={`${telemetry.heading}°`} />
                  <TelemetryItem label="V/S" value={`${telemetry.verticalSpeed} ft/min`} />
                  <TelemetryItem label="Real Callsign" value={telemetry.realcallsign} />
                  <TelemetryItem label="User Callsign" value={telemetry.callsign} />
                  <TelemetryItem label="Aircraft" value={telemetry.aircraftType} />
                  <TelemetryItem label="Pilot" value={telemetry.playerName} />
                </div>
              ) : (
                <p className="text-slate-400">Select an aircraft to view telemetry</p>
              )}
            </Card>

            {/* Flight Plan */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">Flight Plan</h2>
              {flightPlan ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FlightPlanField label="Roblox Username" value={flightPlan.robloxName} />
                  <FlightPlanField label="Callsign (In-Game)" value={flightPlan.callsign} />
                  <FlightPlanField label="Real Callsign" value={flightPlan.realcallsign} />
                  <FlightPlanField label="Aircraft" value={flightPlan.aircraft} />
                  <FlightPlanField label="Flight Rules" value={flightPlan.flightrules} />
                  <FlightPlanField label="Departing" value={flightPlan.departing} />
                  <FlightPlanField label="Arriving" value={flightPlan.arriving} />
                  <FlightPlanField label="Flight Level" value={flightPlan.flightlevel} />
                  <FlightPlanField
                    label="Route"
                    value={flightPlan.route}
                    className="md:col-span-2"
                  />
                </div>
              ) : (
                <p className="text-slate-400">No flight plan filed for this aircraft</p>
              )}
            </Card>

            {/* ATC Scripts */}
            <Card className="p-6 bg-slate-800/50 border-slate-700">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">ATC Communications</h2>
              {flightPlan ? (
                generateATCScripts()
              ) : (
                <p className="text-slate-400">Flight plan required to generate ATC scripts</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function TelemetryItem({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${warning ? 'text-red-400' : 'text-cyan-400'}`}>
        {value}
      </p>
    </div>
  );
}

function FlightPlanField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm text-slate-400 block mb-1">{label}</label>
      <div className="bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm">
        {value}
      </div>
    </div>
  );
}

function ATCScript({ label, text }: { label: string; text: string }) {
  const copyToClipboard = () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    navigator.clipboard.writeText(plainText);
  };

  return (
    <Card className="p-4 bg-slate-900/50 border-l-4 border-cyan-400">
      <div className="font-semibold text-cyan-400 text-sm mb-2 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-slate-200 font-mono text-sm mb-3 leading-relaxed">{text}</div>
      <Button size="sm" variant="outline" onClick={copyToClipboard} className="w-full">
        Copy to Clipboard
      </Button>
    </Card>
  );
}
