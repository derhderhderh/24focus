import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS for Next.js frontend
app.use(cors());
app.use(express.json());

// --- In-memory data stores ---
const pilots = {};           // { callsign: { telemetry, flightPlan, alerts } }
const aircraftList = {};     // Latest aircraft data from 24data

// --- Connect to 24data WebSocket ---
const DATA_WS = 'wss://24data.ptfs.app/wss';
let wsClient = null;

function connectToDataWS() {
  wsClient = new WebSocket(DATA_WS);

  wsClient.on('open', () => {
    console.log('✅ Connected to 24data WebSocket');
  });

  wsClient.on('error', (err) => {
    console.error('❌ 24data WS error:', err);
  });

  wsClient.on('close', () => {
    console.log('⚠️  24data WS disconnected, reconnecting in 5 seconds...');
    setTimeout(connectToDataWS, 5000);
  });

  wsClient.on('message', (msg) => {
    try {
      const { t, d } = JSON.parse(msg);

      // Handle aircraft data updates
      if (t === 'ACFT_DATA' || t === 'EVENT_ACFT_DATA') {
        // Store raw aircraft list
        Object.assign(aircraftList, d);

        // Process each aircraft
        Object.entries(d).forEach(([callsign, data]) => {
          if (!pilots[callsign]) {
            pilots[callsign] = {
              telemetry: {},
              flightPlan: null,
              alerts: [],
              speedViolationTriggered: false
            };
          }

          // Update telemetry
          pilots[callsign].telemetry = {
            callsign: callsign,
            realcallsign: data.realcallsign || callsign,
            altitude: data.altitude || 0,
            speed: data.speed || 0,
            heading: data.heading || 0,
            playerName: data.playerName || 'N/A',
            robloxName: data.playerName || 'N/A',
            aircraftType: data.aircraftType || data.aircraft || 'N/A',
            verticalSpeed: data.verticalSpeed || 0,
            timestamp: Date.now()
          };

          pilots[callsign].alerts = [];
          
          if (data.altitude < 2000 && data.speed > 200) {
            if (!pilots[callsign].speedViolationTriggered) {
              pilots[callsign].alerts.push({
                message: `⚠️ SPEED VIOLATION: ${data.speed} knots below 2,000 ft (200 kt limit)`,
                severity: 'critical',
                type: 'speedViolation',
                dismissible: true
              });
              pilots[callsign].speedViolationTriggered = true;
            }
          } else if (data.altitude >= 2000 || data.speed <= 200) {
            pilots[callsign].speedViolationTriggered = false;
          }
        });

        console.log(`📊 Updated data for ${Object.keys(d).length} aircraft`);
        writeDataFiles();
      }

      // Handle flight plan updates
      if (t === 'FLIGHT_PLAN' || t === 'FLIGHT_PLAN_UPDATE' || t === 'EVENT_FLIGHT_PLAN') {
        Object.entries(d).forEach(([callsign, plan]) => {
          if (!pilots[callsign]) {
            pilots[callsign] = {
              telemetry: {},
              flightPlan: null,
              alerts: [],
              speedViolationTriggered: false
            };
          }

          const realCallsign = plan.realcallsign || plan.callsign || callsign;

          // Store flight plan with standardized field names
          pilots[callsign].flightPlan = {
            callsign: plan.callsign || callsign,
            realcallsign: realCallsign,
            robloxName: plan.robloxName || 'N/A',
            aircraft: plan.aircraft || 'N/A',
            flightrules: plan.flightrules || plan.remarks || 'VFR',
            departing: plan.departing || plan.departure || plan.departureAirport || plan.origin || 'N/A',
            arriving: plan.arriving || plan.destination || plan.arrival || plan.arrivalAirport || 'N/A',
            route: plan.route || plan.airway || plan.waypoints || 'Direct',
            flightlevel: plan.flightlevel || plan.altitude || plan.cruiseAltitude || plan.cruiseLevel || 'N/A',
            cruiseSpeed: plan.cruiseSpeed || plan.speed || plan.tas || 'N/A',
            timestamp: Date.now()
          };

          console.log(`✈️  Flight plan updated for ${callsign} (${realCallsign}), Pilot: ${plan.robloxName}`);
          writeDataFiles();
        });
      }
    } catch (err) {
      console.error('Error processing 24data message:', err);
    }
  });
}

// Start connection to 24data
connectToDataWS();

// --- REST API Endpoints ---

// GET /api/aircraft-list - Returns all aircraft currently online
app.get('/api/aircraft-list', (req, res) => {
  const processedList = {};
  
  Object.entries(aircraftList).forEach(([callsign, data]) => {
    processedList[callsign] = {
      callsign: callsign,
      realcallsign: data.realcallsign || callsign,
      playerName: data.playerName || 'N/A',
      robloxName: data.playerName || 'N/A',
      aircraftType: data.aircraftType || data.aircraft || 'N/A',
      aircraft: data.aircraftType || data.aircraft || 'N/A',
      altitude: data.altitude || 0,
      speed: data.speed || 0,
      heading: data.heading || 0
    };
  });
  
  res.json(processedList);
});

// GET /api/telemetry?callsign=XXX - Returns telemetry for specific aircraft
app.get('/api/telemetry', (req, res) => {
  const { callsign } = req.query;
  
  if (!callsign) {
    return res.status(400).json({ error: 'Callsign parameter required' });
  }
  
  const pilot = pilots[callsign];
  
  if (!pilot) {
    return res.status(404).json({ error: 'Aircraft not found' });
  }
  
  res.json({
    telemetry: pilot.telemetry,
    alerts: pilot.alerts,
    timestamp: Date.now()
  });
});

// GET /api/flight-plans?callsign=XXX - Returns flight plan for specific aircraft
app.get('/api/flight-plans', (req, res) => {
  const { callsign } = req.query;
  
  if (!callsign) {
    return res.status(400).json({ error: 'Callsign parameter required' });
  }
  
  const pilot = pilots[callsign];
  
  if (!pilot) {
    return res.status(404).json({ error: 'Aircraft not found' });
  }
  
  res.json({
    flightPlan: pilot.flightPlan,
    timestamp: Date.now()
  });
});

// GET /api/all-flight-plans - Returns all flight plans
app.get('/api/all-flight-plans', (req, res) => {
  const allPlans = {};
  
  Object.entries(pilots).forEach(([callsign, pilot]) => {
    if (pilot.flightPlan) {
      allPlans[callsign] = pilot.flightPlan;
    }
  });
  
  res.json(allPlans);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connected: wsClient && wsClient.readyState === WebSocket.OPEN,
    aircraftCount: Object.keys(aircraftList).length,
    timestamp: Date.now()
  });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`🚀 Data server running on http://localhost:${PORT}`);
  console.log(`📡 Connecting to 24data WebSocket...`);
});

// --- Write data to JSON files ---
async function writeDataFiles() {
  try {
    const apiDir = path.join(__dirname, 'public', 'api', 'v1');
    await fs.mkdir(apiDir, { recursive: true });

    // Write telemetry data
    const telemetryData = {};
    Object.entries(pilots).forEach(([callsign, pilot]) => {
      telemetryData[callsign] = {
        telemetry: pilot.telemetry,
        alerts: pilot.alerts,
        timestamp: Date.now()
      };
    });
    await fs.writeFile(
      path.join(apiDir, 'telemetry.json'),
      JSON.stringify(telemetryData, null, 2)
    );

    // Write flight plans data
    const flightPlansData = {};
    Object.entries(pilots).forEach(([callsign, pilot]) => {
      if (pilot.flightPlan) {
        flightPlansData[callsign] = pilot.flightPlan;
      }
    });
    await fs.writeFile(
      path.join(apiDir, 'flight-plans.json'),
      JSON.stringify(flightPlansData, null, 2)
    );

    // Write aircraft list
    const processedList = {};
    Object.entries(aircraftList).forEach(([callsign, data]) => {
      processedList[callsign] = {
        callsign: callsign,
        realcallsign: data.realcallsign || callsign,
        playerName: data.playerName || 'N/A',
        robloxName: data.playerName || 'N/A',
        aircraftType: data.aircraftType || data.aircraft || 'N/A',
        aircraft: data.aircraftType || data.aircraft || 'N/A',
        altitude: data.altitude || 0,
        speed: data.speed || 0,
        heading: data.heading || 0
      };
    });
    await fs.writeFile(
      path.join(apiDir, 'aircraft-list.json'),
      JSON.stringify(processedList, null, 2)
    );

    console.log('📝 Data files updated');
  } catch (err) {
    console.error('Error writing data files:', err);
  }
}

setInterval(writeDataFiles, 2000);
