import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, AlertTriangle, Package, ShieldAlert, Terminal, Zap, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// UI Components
const Card = ({ className, children }: any) => (
  <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl shadow-2xl ${className}`}>
    {children}
  </div>
);

const MetricCard = ({ title, value, icon, trend, colorClass }: any) => (
  <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
    <Card className="hover:border-white/20 transition-all duration-300 group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="p-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-400 tracking-wide uppercase">{title}</h3>
          <div className={`p-2 rounded-lg bg-zinc-900 border border-white/5 ${colorClass}`}>
            {icon}
          </div>
        </div>
        <div>
          <div className="text-4xl font-bold tracking-tight text-white mb-2">{value}</div>
          <div className="text-xs font-medium text-emerald-400 flex items-center">
            <Zap className="h-3 w-3 mr-1" /> {trend}
          </div>
        </div>
      </div>
    </Card>
  </motion.div>
);

const generateInitialData = () => {
  return Array.from({ length: 20 }).map((_, i) => ({
    time: `-${20 - i}s`,
    requests: Math.floor(Math.random() * 500) + 1000
  }));
};

const INITIAL_LOGS = [
  { id: 1, type: 'info', msg: '[KAFKA] Connected to topic: checkout.completed' },
  { id: 2, type: 'info', msg: '[DB] Connection pool initialized (HikariCP) - 20 active' },
  { id: 3, type: 'success', msg: '[SYSTEM] StoreSync Orchestrator Online' },
];

export default function Dashboard() {
  const [data, setData] = useState(generateInitialData);
  const [metrics, setMetrics] = useState({
    inventory: 154200,
    checkouts: 124,
    fraudFlags: 3,
    latency: 24
  });
  
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate traffic
      const newRequests = Math.floor(Math.random() * 600) + 1100;
      setData(prev => {
        const next = [...prev.slice(1), { time: 'Now', requests: newRequests }];
        return next;
      });

      // Simulate metric fluctuations
      setMetrics(prev => ({
        inventory: prev.inventory - Math.floor(Math.random() * 5),
        checkouts: prev.checkouts + Math.floor(Math.random() * 3) - 1,
        fraudFlags: Math.random() > 0.95 ? prev.fraudFlags + 1 : prev.fraudFlags,
        latency: Math.floor(Math.random() * 15) + 15
      }));

      // Simulate logs
      if (Math.random() > 0.8) {
        const isFraud = Math.random() > 0.9;
        const newLog = {
          id: Date.now(),
          type: isFraud ? 'error' : 'info',
          msg: isFraud 
            ? `[FRAUD_DETECT] ZSET block triggered for user_${Math.floor(Math.random()*1000)}` 
            : `[INVENTORY] Optimistic lock acquired for SKU_${Math.floor(Math.random()*500)}`
        };
        setLogs(prev => [...prev.slice(-15), newLog]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-50 font-sans selection:bg-emerald-500/30">
      {/* Background glow effects */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 border-b border-white/10 pb-6"
        >
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Package className="h-5 w-5 text-zinc-950" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">StoreSync</h1>
            </div>
            <p className="text-zinc-400">Enterprise Distributed Architecture Command Center</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <div className="flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5 mr-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Systems Operational
            </div>
          </div>
        </motion.header>

        {/* Metrics Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <MetricCard 
            title="Active Inventory" 
            value={metrics.inventory.toLocaleString()} 
            icon={<Package className="h-5 w-5" />} 
            trend="Live replication"
            colorClass="text-zinc-300"
          />
          <MetricCard 
            title="Concurrent Flows" 
            value={metrics.checkouts.toString()} 
            icon={<Activity className="h-5 w-5" />} 
            trend="1.2k req/s avg"
            colorClass="text-emerald-400"
          />
          <MetricCard 
            title="Fraud Blocks" 
            value={metrics.fraudFlags.toString()} 
            icon={<ShieldAlert className="h-5 w-5" />} 
            trend="Sliding window active"
            colorClass="text-rose-400"
          />
          <MetricCard 
            title="P99 Latency" 
            value={`${metrics.latency}ms`} 
            icon={<Zap className="h-5 w-5" />} 
            trend="Optimistic lock hit"
            colorClass="text-amber-400"
          />
        </motion.div>

        {/* Complex Data Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main Chart */}
          <Card className="lg:col-span-2 p-6 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Live Kafka Throughput</h2>
                <p className="text-sm text-zinc-400">Checkout.completed topic streaming (Requests/sec)</p>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                <span>Broker Healthy</span>
              </div>
            </div>
            
            <div className="flex-grow w-full h-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="time" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Terminal / Logs */}
          <Card className="flex flex-col h-[400px]">
            <div className="p-4 border-b border-white/10 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm font-semibold text-zinc-300">
                <Terminal className="h-4 w-4" />
                <span>System Logs</span>
              </div>
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
              </div>
            </div>
            <div 
              ref={scrollRef}
              className="flex-grow p-4 overflow-y-auto overflow-x-hidden font-mono text-xs space-y-3"
            >
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`leading-relaxed ${
                      log.type === 'error' ? 'text-rose-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 
                      'text-zinc-400'
                    }`}
                  >
                    <span className="text-zinc-600 mr-2">[{new Date(log.id).toLocaleTimeString()}]</span>
                    {log.msg}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
