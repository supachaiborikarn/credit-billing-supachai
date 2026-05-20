                        {/* Gas Price & Stock Summary - HOME TAB */}
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            {/* Gas Price */}
                            <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-6 shadow-lg">
                                <h2 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                                    <DollarSign size={16} className="text-green-400" /> ราคาแก๊ส LPG
                                </h2>
                                <div className="flex items-end gap-3 mb-6">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={gasPrice}
                                        onChange={(e) => setGasPrice(parseFloat(e.target.value))}
                                        className="bg-transparent text-3xl font-bold font-mono text-white w-32 border-b border-white/10 focus:border-cyan-500 focus:outline-none pb-1 transition-colors"
                                    />
                                    <span className="text-gray-500 text-sm pb-2">บาท/ลิตร</span>
                                </div>
                                <button onClick={saveGasPrice} className="w-full py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors flex justify-center items-center gap-2">
                                    <Save size={16} />
                                    บันทึกราคา
                                </button>
                            </div>

                            {/* Current Stock */}
                            <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-6 shadow-lg relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                <h2 className="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2 relative z-10">
                                    <Fuel size={16} className="text-cyan-400" /> สต็อกแก๊สคงเหลือ
                                </h2>

                                {/* Calculated Stock */}
                                <div className="mb-4 relative z-10 flex justify-between items-end">
                                    <div>
                                        <div className="flex items-end gap-1">
                                            <p className={`text-3xl font-bold font-mono tracking-tight ${currentStock < stockAlert ? 'text-red-400' : 'text-cyan-400'}`}>
                                                {formatNumber(currentStock)}
                                            </p>
                                            <span className="text-gray-500 text-[10px] pb-1 uppercase">ลิตร</span>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">จากการคำนวณ (รับ-ขาย)</p>
                                    </div>
                                </div>

                                {/* Gauge-based Estimation */}
                                <div className="bg-[#141417] rounded-xl p-3 mb-4 border border-white/5 relative z-10">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">ประเมินจากเกจ</span>
                                    </div>
                                    {(() => {
                                        const totalPercentage = gaugeReadings.reduce((sum, g) => sum + (g.endPercentage || 0), 0);
                                        const gaugeEstimate = totalPercentage * GAS_TANK_CAPACITY_LITERS;
                                        const difference = gaugeEstimate - currentStock;
                                        return (
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-lg font-bold font-mono text-yellow-400">
                                                        {formatNumber(gaugeEstimate)} <span className="text-[10px] text-gray-500">L</span>
                                                    </p>
                                                </div>
                                                {Math.abs(difference) > 10 && (
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${difference > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {difference > 0 ? '+' : ''}{formatNumber(difference)} L
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button
                                    onClick={() => setShowSupplyForm(true)}
                                    className="w-full py-2.5 rounded-xl text-sm font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors flex justify-center items-center gap-2 relative z-10"
                                >
                                    <Plus size={16} />
                                    รับแก๊สเข้า (KG)
                                </button>
                            </div>

                            {/* Today Summary */}
                            <div className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-6 shadow-lg">
                                <h2 className="text-sm font-semibold text-gray-400 mb-5 flex items-center gap-2">
                                    <FileText size={16} className="text-purple-400" /> สรุปวันนี้
                                </h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-3">
                                        <span className="text-sm text-gray-500">ยอดขาย</span>
                                        <span className="font-mono text-lg font-bold text-cyan-400">{formatNumber(transactionsTotal)} <span className="text-[10px] text-gray-500">L</span></span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/5 pb-3">
                                        <span className="text-sm text-gray-500">รายได้</span>
                                        <span className="font-mono text-lg font-bold text-green-400">{formatCurrency(transactions.reduce((s, t) => s + Number(t.amount), 0))} <span className="text-[10px] text-gray-500">฿</span></span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm text-gray-500">รายการ</span>
                                        <span className="font-mono text-lg font-bold text-white">{transactions.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
