    return (
        <Sidebar>
            <div className="max-w-7xl mx-auto relative p-4 sm:p-6 lg:p-8 font-sans">
                {/* Background orbs */}
                <div className="fixed top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#1C1C1F] to-transparent -z-10"></div>
                <div className="fixed top-20 right-20 w-[400px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)' }} />

                {/* Breadcrumb */}
                <Breadcrumb items={[{ label: 'ปั๊มแก๊ส' }, { label: station.name }]} className="mb-6 opacity-70 hover:opacity-100 transition-opacity" />

                {/* Header Section */}
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/5">
                    {/* Title & Station Info */}
                    <div className="flex items-center gap-5">
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-30" />
                            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shadow-inner border border-white/10">
                                <Fuel className="text-white drop-shadow-md" size={32} />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                                    {station.name}
                                </h1>
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                                    LPG
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-cyan-500" />
                                    <span>Gas Station Dashboard</span>
                                </div>
                                <span className="text-gray-600">•</span>
                                {currentShift !== null && (
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${currentShift === 1
                                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                        : currentShift === 2 ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'bg-white/5 text-gray-300 border border-white/10'
                                        }`}>
                                        {currentShift === 0 ? '📅 กะทั้งวัน' : currentShift === 1 ? '🌅 กะเช้า' : '🌙 กะบ่าย'}
                                    </span>
                                )}
                                <span className="text-gray-600">•</span>
                                <a href={`/gas-station/${id}/new/home`} className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1">📱 UI เก่า</a>
                                <span className="text-gray-600">•</span>
                                <a href={`/gas/${(() => { const s = STATIONS[stationIndex]; return ('aliases' in s && s.aliases) ? (s.aliases as readonly string[])[0] : id; })()}`} className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">✨ V2 (Beta)</a>
                            </div>
                        </div>
                    </div>

                    {/* Controls & Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        {/* Date & Shift Selectors */}
                        <div className="flex bg-[#141417] p-1 rounded-xl border border-white/5">
                            <div className="flex items-center px-3 gap-2 border-r border-white/5">
                                <Calendar size={16} className="text-gray-500" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent text-sm font-medium text-gray-200 focus:outline-none w-[120px]"
                                />
                            </div>
                            <div className="flex items-center px-2">
                                <select
                                    value={currentShift || ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value) : null;
                                        setCurrentShift(val);
                                        if (val !== null) localStorage.setItem('selectedShift', val.toString());
                                        setMeters([{ nozzle: 1, start: 0, end: 0 }, { nozzle: 2, start: 0, end: 0 }, { nozzle: 3, start: 0, end: 0 }, { nozzle: 4, start: 0, end: 0 }]);
                                        setNewGaugeValues({});
                                        setGaugeReadings([]);
                                        setTimeout(() => { fetchDailyData(); fetchGaugeReadings(); fetchShiftData(); }, 100);
                                    }}
                                    className="bg-transparent text-sm font-medium text-gray-200 focus:outline-none px-2 py-1.5 appearance-none cursor-pointer"
                                >
                                    <option value="" className="bg-gray-900">เลือกระยะเวลา</option>
                                    <option value="0" className="bg-gray-900">📅 กะทั้งวัน</option>
                                    <option value="1" className="bg-gray-900">🌅 กะเช้า (กะ 1)</option>
                                    <option value="2" className="bg-gray-900">🌙 กะบ่าย (กะ 2)</option>
                                </select>
                            </div>
                        </div>

                        {/* Status indicators */}
                        {shiftData?.shifts && shiftData.shifts.length > 0 && (
                            <div className="flex gap-1 items-center px-2">
                                {shiftData.shifts.map((s: any) => (
                                    <div key={s.id} className={`w-2.5 h-2.5 rounded-full ${s.status === 'OPEN' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`} title={`กะ ${s.shiftNumber}: ${s.status}`} />
                                ))}
                            </div>
                        )}

                        <div className="w-px h-8 bg-white/10 hidden sm:block mx-1"></div>

                        {/* Action Buttons */}
                        {currentShift && (
                            <div className="flex items-center gap-2">
                                {shiftData?.shifts?.find((s: any) => s.shiftNumber === currentShift && s.status === 'OPEN') ? (
                                    <button onClick={() => setShowCloseShiftModal(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all flex items-center gap-2">
                                        ปิดกะ
                                    </button>
                                ) : (
                                    <button onClick={() => setShowOpenShiftModal(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all flex items-center gap-2">
                                        เปิดกะ
                                    </button>
                                )}
                                
                                {isAdmin && (
                                    <button onClick={() => setShowRevenueSummary(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all flex items-center gap-2" title="ดูสรุปยอดขาย">
                                        <Banknote size={16} /> สรุปยอด
                                    </button>
                                )}

                                {isAdmin && (
                                    <button onClick={saveAllData} disabled={savingAll} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-200 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50">
                                        {savingAll ? <span className="animate-spin">⏳</span> : <Save size={16} />} บันทึกทั้งหมด
                                    </button>
                                )}
                            </div>
                        )}

                        <button onClick={() => setShowDailySummary(true)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1C1C1F] text-gray-300 hover:bg-white/5 border border-white/10 transition-all flex items-center gap-2">
                            <FileText size={16} /> สรุปงาน
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
