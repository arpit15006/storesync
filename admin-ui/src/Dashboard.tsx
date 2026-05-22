import React, { useState, useEffect, useRef } from 'react';
import { Activity, AlertTriangle, Package, ShieldAlert, Terminal, Zap, ArrowRight, Server, Database, BrainCircuit, RefreshCw, AlertOctagon, CheckCircle2, BarChart2, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// UI Components
const Card = ({ className, children }: any) => (
  <div className={`rounded-md border border-zinc-800 bg-[#0c0c0e] shadow-sm flex flex-col ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ title, icon, action }: any) => (
  <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/30">
    <div className="flex items-center space-x-2 text-zinc-300">
      {icon}
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
    </div>
    {action && <div>{action}</div>}
  </div>
);

const TopMetric = ({ title, value, unit, trend, isWarning }: any) => (
  <Card className="p-4 flex flex-col justify-between">
    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{title}</div>
    <div className="flex items-baseline space-x-1">
      <span className={`text-2xl font-mono ${isWarning ? 'text-rose-400' : 'text-zinc-100'}`}>{value}</span>
      {unit && <span className="text-sm font-mono text-zinc-500">{unit}</span>}
    </div>
    <div className={`text-xs mt-2 font-mono ${isWarning ? 'text-rose-500' : 'text-zinc-400'}`}>{trend}</div>
  </Card>
);

const generateForecastData = () => {
  return Array.from({ length: 14 }).map((_, i) => ({
    day: `Day ${i+1}`,
    sales: Math.floor(Math.random() * 40) + 50,
    upper: Math.floor(Math.random() * 20) + 90,
    lower: Math.floor(Math.random() * 20) + 30
  }));
};

export default function Dashboard() {
  const [chaosMode, setChaosMode] = useState(false);
  const [metrics, setMetrics] = useState({
    throughput: 1240,
    latency: 24,
    fraud: 12,
    threads: 154,
    locks: 149,
    conflicts: 5,
    retryQueue: 18,
    dlq: 0,
    recoveryRate: 99.2,
    kafkaLag: 0,
    inventoryLag: 1
  });
  
  const [logs, setLogs] = useState([
    { id: 1, msg: '[SYSTEM] StoreSync Orchestrator initialized' },
    { id: 2, msg: '[KAFKA] Consumer joined group: inventory-sync' }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const forecastData = generateForecastData();

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => {
        if (chaosMode) {
          // Chaos Engineering Simulation: Broker Failure
          return {
            throughput: Math.max(0, prev.throughput - Math.floor(Math.random() * 300)),
            latency: prev.latency + Math.floor(Math.random() * 200),
            fraud: prev.fraud,
            threads: prev.threads + Math.floor(Math.random() * 20),
            locks: Math.max(0, prev.locks - Math.floor(Math.random() * 10)),
            conflicts: prev.conflicts + Math.floor(Math.random() * 15),
            retryQueue: prev.retryQueue + Math.floor(Math.random() * 45),
            dlq: prev.dlq + Math.floor(Math.random() * 2),
            recoveryRate: Math.max(45.0, prev.recoveryRate - (Math.random() * 5.0)),
            kafkaLag: prev.kafkaLag + Math.floor(Math.random() * 800),
            inventoryLag: prev.inventoryLag + Math.floor(Math.random() * 1200)
          };
        } else {
          // Normal Operation & Auto-Recovery
          return {
            throughput: Math.floor(Math.random() * 200) + 1100,
            latency: Math.max(18, prev.latency - Math.floor(Math.random() * 50)),
            fraud: Math.random() > 0.8 ? prev.fraud + 1 : prev.fraud,
            threads: Math.floor(Math.random() * 50) + 120,
            locks: Math.floor(Math.random() * 45) + 115,
            conflicts: Math.floor(Math.random() * 5),
            retryQueue: Math.max(0, prev.retryQueue - Math.floor(Math.random() * 15)),
            dlq: prev.dlq,
            recoveryRate: Math.min(99.8, prev.recoveryRate + (Math.random() * 2.0)),
            kafkaLag: Math.max(0, prev.kafkaLag - Math.floor(Math.random() * 500)),
            inventoryLag: Math.max(1, prev.inventoryLag - Math.floor(Math.random() * 500))
          };
        }
      });

      if (Math.random() > (chaosMode ? 0.2 : 0.7)) {
        const events = chaosMode ? [
          '[CRITICAL] Kafka Broker Partition Offline',
          '[WARN] CheckoutOrchestrator TimeoutException',
          '[ALERT] Dead Letter Queue insertion failed',
          '[REDIS] Connection pool exhausted'
        ] : [
          '[REDIS] ZSET Sliding window evaluated 1.2k keys',
          '[POSTGRES] OptimisticLockException recovered on SKU-102',
          '[KAFKA] Committed offset 84992 for topic: checkout.completed',
          '[ML_API] Inference served in 12ms (XGBoost v1.0.0)'
        ];
        
        const newLog = { 
          id: Date.now(), 
          msg: events[Math.floor(Math.random()*events.length)] 
        };
        setLogs(prev => [...prev.slice(-15), newLog]);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [chaosMode]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header - Operational Style */}
        <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center">
              <Server className="h-5 w-5 mr-2 text-blue-500" />
              StoreSync Operations Center
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-1">ENV: PRODUCTION | REGION: US-EAST-1 | VERSION: 1.0.4</p>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setChaosMode(!chaosMode)}
              className={`flex items-center px-3 py-1.5 rounded border text-xs font-mono transition-colors ${
                chaosMode 
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Flame className="h-3.5 w-3.5 mr-2" />
              {chaosMode ? 'STOP CHAOS SIMULATION' : 'Simulate Broker Failure'}
            </button>

            <span className={`flex items-center px-2 py-1 rounded border text-xs font-mono ${
              chaosMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full mr-2 animate-pulse ${chaosMode ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
              {chaosMode ? 'SYSTEM DEGRADED' : 'SYSTEM HEALTHY'}
            </span>
          </div>
        </header>

        {/* TOP ROW: High-Level Telemetry */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TopMetric 
            title="API Throughput" 
            value={metrics.throughput} 
            unit="req/s" 
            trend={chaosMode ? '↓ CRITICAL DROP' : '↑ 4.2% vs last hour'} 
            isWarning={chaosMode}
          />
          <TopMetric 
            title="P99 Latency" 
            value={metrics.latency} 
            unit="ms" 
            trend={chaosMode ? 'TIMEOUT RISK' : 'Stable (Target < 50ms)'} 
            isWarning={chaosMode || metrics.latency > 100}
          />
          <TopMetric 
            title="Fraud Blocks" 
            value={metrics.fraud} 
            unit="blocks" 
            trend="Sliding window (5m)" 
          />
          <TopMetric 
            title="Recovery Rate" 
            value={metrics.recoveryRate.toFixed(1)} 
            unit="%" 
            trend={chaosMode ? 'CASCADING FAILURE' : 'Auto-retry success'} 
            isWarning={chaosMode}
          />
        </div>

        {/* ROW 2: Systems Architecture, Benchmarks & Kafka Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Architecture Diagram */}
          <Card className="lg:col-span-1">
            <CardHeader title="Live System Architecture" icon={<Activity className="h-4 w-4" />} />
            <div className="flex-grow p-6 flex flex-col items-center justify-center space-y-3 font-mono text-xs text-zinc-400">
              <div className="w-full flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded">
                <span className="text-blue-400">Checkout Service</span>
                <span className="text-[10px]">Spring Boot</span>
              </div>
              <ArrowRight className={`h-4 w-4 rotate-90 ${chaosMode ? 'text-rose-500' : 'text-zinc-600'}`} />
              <div className={`w-full flex justify-between items-center bg-zinc-900 border p-2 rounded ${chaosMode ? 'border-rose-500/50' : 'border-zinc-800'}`}>
                <span className={chaosMode ? 'text-rose-400' : 'text-orange-400'}>Kafka Broker</span>
                <span className="text-[10px]">{chaosMode ? 'PARTITION OFFLINE' : 'Event Stream'}</span>
              </div>
              <ArrowRight className="h-4 w-4 rotate-90 text-zinc-600" />
              <div className="w-full flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded">
                <span className="text-purple-400">Inventory Service</span>
                <span className="text-[10px]">Postgres Locking</span>
              </div>
              <ArrowRight className="h-4 w-4 rotate-90 text-zinc-600" />
              <div className="w-full flex justify-between items-center bg-zinc-900 border border-zinc-800 p-2 rounded">
                <span className="text-emerald-400">Forecasting API</span>
                <span className="text-[10px]">FastAPI / XGBoost</span>
              </div>
            </div>
          </Card>

          {/* Benchmark Metrics Panel */}
          <Card className="lg:col-span-1">
            <CardHeader title="Benchmark Metrics" icon={<BarChart2 className="h-4 w-4" />} />
            <div className="flex-grow p-4">
              <table className="w-full text-left font-mono text-sm h-full">
                <tbody className="text-zinc-300">
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-3 text-zinc-400">Peak Throughput</td>
                    <td className="py-3 text-right text-emerald-400 font-bold">5.2k req/s</td>
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-3 text-zinc-400">Cache Hit Rate</td>
                    <td className="py-3 text-right font-bold">94.8%</td>
                  </tr>
                  <tr className="border-b border-zinc-800/50">
                    <td className="py-3 text-zinc-400">Kafka Consumer Lag</td>
                    <td className={`py-3 text-right font-bold ${chaosMode ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {metrics.kafkaLag}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 text-zinc-400">Reservation Accuracy</td>
                    <td className="py-3 text-right font-bold">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Concurrency Simulation */}
          <Card className="lg:col-span-1">
            <CardHeader title="Concurrency & Locking" icon={<Database className="h-4 w-4" />} />
            <div className="flex-grow p-4 space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Active Threads</span>
                <span className="text-zinc-200">{metrics.threads}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Reservation Success</span>
                <span className="text-emerald-400">{metrics.locks}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Conflict Resolutions</span>
                <span className="text-amber-400">{metrics.conflicts}</span>
              </div>
              <div className="mt-4 pt-2 text-xs text-zinc-500">
                Using @Version Optimistic Locking + ConcurrentHashMap ReentrantLocks.
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 3: Inventory Table & Retry Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Low Stock Operational Table */}
          <Card className="lg:col-span-2">
            <CardHeader title="Operational Inventory Intelligence" icon={<Package className="h-4 w-4" />} />
            <div className="flex-grow p-4 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="pb-2">SKU ID</th>
                    <th className="pb-2">Store Node</th>
                    <th className="pb-2">Current Stock</th>
                    <th className="pb-2">ML Forecast</th>
                    <th className="pb-2">Action Status</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-3 text-blue-400">SKU-102</td>
                    <td className="py-3">Dallas-HQ</td>
                    <td className="py-3 font-bold text-rose-400">4</td>
                    <td className="py-3 text-amber-400">High Demand (80/day)</td>
                    <td className="py-3"><span className="bg-rose-500/10 text-rose-400 px-2 py-1 rounded border border-rose-500/20">Critical Restock</span></td>
                  </tr>
                  <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-3 text-blue-400">SKU-551</td>
                    <td className="py-3">Chicago-N</td>
                    <td className="py-3 font-bold text-amber-400">12</td>
                    <td className="py-3 text-rose-400">Surge Expected</td>
                    <td className="py-3"><span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">Monitor</span></td>
                  </tr>
                  <tr className="hover:bg-zinc-900/50">
                    <td className="py-3 text-blue-400">SKU-892</td>
                    <td className="py-3">Seattle-W</td>
                    <td className="py-3 font-bold text-emerald-400">450</td>
                    <td className="py-3 text-emerald-400">Stable Flow</td>
                    <td className="py-3"><span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Healthy</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Failure & Retry Panel */}
          <Card className="lg:col-span-1">
            <CardHeader title="Failure & Retry Telemetry" icon={<AlertOctagon className="h-4 w-4" />} />
            <div className="flex-grow p-4 space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Retry Queue</span>
                <span className={chaosMode ? 'text-rose-400 font-bold' : 'text-amber-400'}>{metrics.retryQueue}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <span className="text-zinc-500">Dead Letter Events</span>
                <span className={metrics.dlq > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{metrics.dlq}</span>
              </div>
              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1 flex justify-between">
                  <span>Recovery Success Rate</span>
                  <span className={chaosMode ? 'text-rose-400' : 'text-emerald-400'}>{metrics.recoveryRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 border border-zinc-800 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all duration-300 ${chaosMode ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.recoveryRate}%` }}></div>
                </div>
              </div>
            </div>
          </Card>

        </div>

        {/* ROW 4: Forecasting Chart & Terminal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Demand Forecast Chart */}
          <Card className="lg:col-span-2">
            <CardHeader title="XGBoost Demand Forecast (SKU-102)" icon={<BrainCircuit className="h-4 w-4" />} />
            <div className="flex-grow w-full p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="day" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                  <Line type="monotone" dataKey="upper" stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                  <Line type="monotone" dataKey="lower" stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* System Terminal */}
          <Card className="lg:col-span-1">
            <CardHeader title="Live System Logs" icon={<Terminal className="h-4 w-4" />} />
            <div 
              ref={scrollRef}
              className="flex-grow p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-2 bg-black"
            >
              {logs.map(log => (
                <div key={log.id} className="text-zinc-500 leading-tight">
                  <span className="text-zinc-700 mr-2">{new Date(log.id).toISOString().split('T')[1].slice(0,-1)}</span>
                  <span className={log.msg.includes('CRITICAL') || log.msg.includes('Exception') || log.msg.includes('ALERT') ? 'text-rose-400' : 'text-zinc-300'}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
