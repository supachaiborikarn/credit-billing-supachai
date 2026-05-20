                        {/* Gauge Readings (3 Tanks) - METERS TAB */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Gauge className="text-yellow-400" />
                                    📊 ถังเก็บแก๊ส (3 ถัง)
                                </h2>
                                <button
                                    onClick={copyGaugeFromPreviousDay}
                                    className="btn btn-info btn-sm flex items-center gap-1 bg-[#1C1C1F] border border-white/10 hover:bg-white/5 text-gray-300 transition-colors"
                                    title="คัดลอกเกจสิ้นสุดจากวันก่อน"
                                >
                                    ดึงเกจวันก่อน
                                </button>
                            </div>
                            <div className="grid md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(tankNum => {
                                    const reading = gaugeReadings.find(g => g.tankNumber === tankNum);
                                    // Calculate supplies per tank (divide total by 3)
                                    const totalSupplyLiters = gasSupplies.reduce((sum, s) => sum + Number(s.liters), 0);
                                    const supplyPerTank = totalSupplyLiters / 3;

                                    // Formula: reading × 98 = liters (not percentage)
                                    const startLiters = reading?.startPercentage !== null ? (reading?.startPercentage || 0) * GAS_TANK_CAPACITY_LITERS : null;
                                    const endLiters = reading?.endPercentage !== null ? (reading?.endPercentage || 0) * GAS_TANK_CAPACITY_LITERS : null;

                                    const usedLiters = startLiters !== null && endLiters !== null
                                        ? (startLiters + supplyPerTank) - endLiters
                                        : null;
                                    return (
                                        <div key={tankNum} className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-6 shadow-lg relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                            
                                            <h3 className="font-bold text-lg text-yellow-400 mb-5 relative z-10 flex items-center justify-between">
                                                ถังที่ {tankNum}
                                                <div className="h-2 flex-1 mx-3 bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${(reading?.endPercentage ?? 100) < 20 ? 'bg-red-500' : 'bg-yellow-400'}`} 
                                                        style={{ width: `${reading?.endPercentage || 0}%` }}
                                                    ></div>
                                                </div>
                                            </h3>

                                            <div className="space-y-4 relative z-10">
                                                {/* Start Gauge */}
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                                        <span>เกจเริ่มต้น:</span>
                                                        <span className="text-cyan-400 font-mono font-medium">
                                                            {reading?.startPercentage !== null ? `${reading?.startPercentage}%` : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            id={`gauge-start-${tankNum}`}
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="1"
                                                            value={newGaugeValues[`${tankNum}-start`] || ''}
                                                            onChange={(e) => setNewGaugeValues(prev => ({
                                                                ...prev,
                                                                [`${tankNum}-start`]: e.target.value
                                                            }))}
                                                            onKeyDown={(e) => handleInputKeyDown(e, `gauge-start-${tankNum}`)}
                                                            placeholder="0-100%"
                                                            className="w-full bg-[#141417] border border-white/5 rounded-xl px-3 py-2 text-center font-mono text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                                        />
                                                    </div>
                                                </div>

                                                {/* End Gauge */}
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                                        <span>เกจสิ้นสุด:</span>
                                                        <span className={`font-mono font-medium ${reading?.endPercentage !== null && (reading?.endPercentage ?? 100) < 20 ? 'text-red-400' : 'text-green-400'}`}>
                                                            {reading?.endPercentage !== null ? `${reading?.endPercentage}%` : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            id={`gauge-end-${tankNum}`}
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="1"
                                                            value={newGaugeValues[`${tankNum}-end`] || ''}
                                                            onChange={(e) => setNewGaugeValues(prev => ({
                                                                ...prev,
                                                                [`${tankNum}-end`]: e.target.value
                                                            }))}
                                                            onKeyDown={(e) => handleInputKeyDown(e, `gauge-end-${tankNum}`)}
                                                            placeholder="0-100%"
                                                            className="w-full bg-[#141417] border border-yellow-500/20 rounded-xl px-3 py-2 text-center font-mono text-sm text-white focus:outline-none focus:border-yellow-500 transition-colors"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Used liters from this tank */}
                                                {usedLiters !== null && (
                                                    <div className="pt-4 mt-2 border-t border-white/5 flex justify-between items-center">
                                                        <span className="text-xs font-medium text-gray-400">ใช้ไป (คำนวณ):</span>
                                                        <span className="font-mono font-bold text-yellow-400 text-lg">
                                                            {formatNumber(usedLiters)} <span className="text-[10px] text-gray-500">L</span>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Save Gauge Buttons */}
                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => saveAllGaugesByType('start')}
                                    className="flex-1 py-3 text-sm font-semibold rounded-xl text-gray-300 bg-[#1C1C1F] border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    บันทึกเกจเริ่มต้น
                                </button>
                                <button
                                    onClick={() => saveAllGaugesByType('end')}
                                    className="flex-1 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90 transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2"
                                >
                                    <Save size={16} />
                                    บันทึกเกจสิ้นสุด
                                </button>
                            </div>

                            {/* Total comparison with meters */}
                            {(() => {
                                // Formula: reading × 98 = liters (not percentage)
                                const totalStartLiters = gaugeReadings.reduce((s, g) => s + ((g.startPercentage || 0) * GAS_TANK_CAPACITY_LITERS), 0);
                                const totalEndLiters = gaugeReadings.reduce((s, g) => s + ((g.endPercentage || 0) * GAS_TANK_CAPACITY_LITERS), 0);
                                const totalSupplyLiters = gasSupplies.reduce((sum, s) => sum + Number(s.liters), 0);
                                // Formula: (startLiters + supplies) - endLiters
                                const totalGaugeUsed = (totalStartLiters + totalSupplyLiters) - totalEndLiters;
                                // Use allDayMeterTotal for proper comparison (all shifts)
                                const difference = allDayMeterTotal - totalGaugeUsed;

                                if (totalStartLiters > 0 && totalEndLiters > 0) {
                                    return (
                                        <div className="mt-6 bg-[#1C1C1F] border border-white/10 rounded-2xl p-6 shadow-lg">
                                            <h4 className="font-bold text-white mb-4 text-sm flex items-center gap-2">
                                                <TrendingUp size={16} className="text-blue-400" />
                                                เปรียบเทียบ (รวมทั้งวัน)
                                            </h4>
                                            <div className="grid grid-cols-3 gap-6 text-center">
                                                <div>
                                                    <div className="text-gray-500 text-xs mb-1">จากเกจ (ใช้ไป)</div>
                                                    <div className="text-2xl font-bold font-mono text-yellow-400">{formatNumber(totalGaugeUsed)}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 text-xs mb-1">จากมิเตอร์ (ขาย)</div>
                                                    <div className="text-2xl font-bold font-mono text-cyan-400">{formatNumber(allDayMeterTotal)}</div>
                                                </div>
                                                <div className={`rounded-xl p-2 ${Math.abs(difference) < 10 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                    <div className="text-gray-500 text-xs mb-1">ผลต่าง</div>
                                                    <div className={`text-xl font-bold font-mono ${Math.abs(difference) < 10 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {difference > 0 ? '+' : ''}{formatNumber(difference)} L
                                                    </div>
                                                </div>
                                            </div>
                                            {Math.abs(difference) >= 10 && (
                                                <div className="mt-4 text-center text-red-400 text-xs bg-red-500/10 py-2 rounded-lg flex justify-center items-center gap-2">
                                                    <AlertTriangle size={14} /> ผลต่างมากกว่า 10 ลิตร - ตรวจสอบข้อมูล
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
