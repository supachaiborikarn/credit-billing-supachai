import React from "react";
import { Coffee, Droplets, Clock, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";

export default function BigBCoffeeDashboard() {
  return (
    <div className="max-w-[1400px] mx-auto p-6 md:p-12 lg:p-16">
      {/* Editorial Header */}
      <header className="mb-16 border-b border-[#EAEAEA] pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#D97757] mb-3">
            Operations Overview
          </h4>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[#2D2A26] tracking-tight leading-none" style={{ fontFamily: "var(--font-literata)" }}>
            Big B Coffee <br />
            <span className="text-[#8B8884]">& Watcharakiat Oil</span>
          </h1>
        </div>
        <div className="text-sm font-medium text-[#8B8884] flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString('th-TH')}</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* Left Column: Coffee Shop (7 cols) */}
        <div className="lg:col-span-7 space-y-12">
          
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif text-[#2D2A26]" style={{ fontFamily: "var(--font-literata)" }}>
                Cafe Operations
              </h2>
              <span className="px-3 py-1 bg-[#D97757]/10 text-[#D97757] text-xs font-bold tracking-wide uppercase rounded-full">
                Open
              </span>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <KpiCard label="Today's Orders" value="142" trend="+12%" />
              <KpiCard label="Popular Item" value="Iced Latte" />
              <KpiCard label="Current Wait" value="4 min" />
            </div>

            {/* Active Queue */}
            <div className="bg-white border border-[#EAEAEA] rounded-md overflow-hidden">
              <div className="p-5 border-b border-[#EAEAEA] bg-[#FAFAF8]">
                <h3 className="text-sm font-bold text-[#2D2A26] uppercase tracking-wider">Active Queue</h3>
              </div>
              <ul className="divide-y divide-[#EAEAEA]">
                {[
                  { id: "A01", item: "Iced Americano", status: "Ready", time: "1 min ago" },
                  { id: "A02", item: "Hot Latte", status: "Preparing", time: "3 min ago" },
                  { id: "A03", item: "Caramel Macchiato", status: "In Queue", time: "4 min ago" },
                ].map((order) => (
                  <li key={order.id} className="p-5 flex justify-between items-center group hover:bg-[#FAFAF8] transition-colors duration-200">
                    <div className="flex flex-col">
                      <span className="text-lg font-medium text-[#2D2A26]">{order.item}</span>
                      <span className="text-xs text-[#8B8884] font-mono mt-1">Order #{order.id}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {order.status === "Ready" ? (
                        <span className="text-[#D97757] text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {order.status}</span>
                      ) : (
                        <span className="text-[#8B8884] text-sm font-medium">{order.status}</span>
                      )}
                      <span className="text-xs text-[#8B8884]">{order.time}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </div>

        {/* Right Column: Oil Change Pit (5 cols) */}
        <div className="lg:col-span-5 space-y-12">
          
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif text-[#2D2A26]" style={{ fontFamily: "var(--font-literata)" }}>
                Watcharakiat Oil
              </h2>
              <span className="px-3 py-1 bg-[#7B8466]/10 text-[#7B8466] text-xs font-bold tracking-wide uppercase rounded-full">
                Pit In Use
              </span>
            </div>

            {/* Current Bay Status */}
            <div className="bg-[#2D2A26] text-[#FDFCF8] rounded-md p-8 mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Droplets className="w-32 h-32" />
              </div>
              <h3 className="text-sm font-medium text-[#8B8884] mb-2">Current Service</h3>
              <div className="text-3xl font-serif mb-1" style={{ fontFamily: "var(--font-literata)" }}>Honda Civic (กท-4592)</div>
              <div className="text-[#A4A19E] text-sm mb-8">Full Synthetic 5W-30 + Filter Change</div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-[#4A4743] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#D97757] h-full w-[65%]"></div>
                </div>
                <span className="text-xs font-medium font-mono text-[#D97757]">65%</span>
              </div>
            </div>

            {/* Inventory Alerts */}
            <div className="border border-[#EAEAEA] rounded-md bg-white">
              <div className="p-5 border-b border-[#EAEAEA] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#D97757]" />
                <h3 className="text-sm font-bold text-[#2D2A26] uppercase tracking-wider">Inventory Alerts</h3>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center py-3 border-b border-[#EAEAEA] last:border-0">
                  <span className="text-sm text-[#2D2A26]">Mobil 1 5W-30 (4L)</span>
                  <span className="text-sm font-medium text-[#D97757]">Low (2 left)</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-[#EAEAEA] last:border-0">
                  <span className="text-sm text-[#2D2A26]">Toyota Oil Filter #90915</span>
                  <span className="text-sm font-medium text-[#8B8884]">Stock OK (15)</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, trend }: { label: string, value: string, trend?: string }) {
  return (
    <div className="p-5 border border-[#EAEAEA] rounded-md bg-white flex flex-col justify-between">
      <span className="text-xs font-bold text-[#8B8884] uppercase tracking-wider mb-3">{label}</span>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-serif text-[#2D2A26] leading-none" style={{ fontFamily: "var(--font-literata)" }}>{value}</span>
        {trend && <span className="text-xs font-medium text-[#7B8466]">{trend}</span>}
      </div>
    </div>
  );
}
