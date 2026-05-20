                        {/* Meter Readings - METERS TAB */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Fuel className="text-cyan-400" />
                                    📟 หัวจ่ายแก๊ส (4 หัว)
                                </h2>
                                <div className="flex gap-2">
                                    {hasCarryOver && (
                                        <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                            📋 มีข้อมูลยกยอดจากกะก่อน
                                        </span>
                                    )}
                                    <button
                                        onClick={copyFromPreviousShift}
                                        className="btn btn-info btn-sm flex items-center gap-1 bg-[#1C1C1F] border border-white/10 hover:bg-white/5 text-gray-300 transition-colors"
                                        title="คัดลอกมิเตอร์สิ้นสุดของกะก่อนหน้า"
                                    >
                                        ดึงจากกะก่อน
                                    </button>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {meters.map((m, i) => (
                                    <div key={i} className="bg-[#1C1C1F] border border-white/10 rounded-2xl p-5 relative overflow-hidden group shadow-lg">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-70"></div>
                                        
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="font-bold text-lg text-white">หัวจ่ายที่ {m.nozzle}</h3>
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                                                ACTIVE
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                                    <span>มิเตอร์เริ่มต้น:</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`meter-start-${m.nozzle}`}
                                                        type="number"
                                                        value={m.start || ''}
                                                        onChange={(e) => {
                                                            const newMeters = [...meters];
                                                            newMeters[i].start = parseFloat(e.target.value) || 0;
                                                            setMeters(newMeters);
                                                        }}
                                                        onKeyDown={(e) => handleInputKeyDown(e, `meter-start-${m.nozzle}`)}
                                                        className="w-full bg-[#141417] border border-white/5 rounded-xl px-3 py-2 text-center font-mono text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                                        placeholder="0.00"
                                                    />
                                                    <label className={`cursor-pointer p-2.5 rounded-xl transition-all ${m.startPhoto ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#141417] text-gray-400 border border-white/5 hover:bg-white/5'}`}>
                                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleMeterPhotoUpload(m.nozzle, 'start', file); }} />
                                                        {uploadingPhoto === `${m.nozzle}-start` ? <span className="animate-spin text-xs inline-block">⏳</span> : m.startPhoto ? <CheckCircle size={14} /> : <Camera size={14} />}
                                                    </label>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                                                    <span>มิเตอร์สิ้นสุด:</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        id={`meter-end-${m.nozzle}`}
                                                        type="number"
                                                        value={m.end || ''}
                                                        onChange={(e) => {
                                                            const newMeters = [...meters];
                                                            newMeters[i].end = parseFloat(e.target.value) || 0;
                                                            setMeters(newMeters);
                                                        }}
                                                        onKeyDown={(e) => handleInputKeyDown(e, `meter-end-${m.nozzle}`)}
                                                        className="w-full bg-[#141417] border border-cyan-500/20 rounded-xl px-3 py-2 text-center font-mono text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                                                        placeholder="0.00"
                                                    />
                                                    <label className={`cursor-pointer p-2.5 rounded-xl transition-all ${m.endPhoto ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-[#141417] text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/10'}`}>
                                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleMeterPhotoUpload(m.nozzle, 'end', file); }} />
                                                        {uploadingPhoto === `${m.nozzle}-end` ? <span className="animate-spin text-xs inline-block">⏳</span> : m.endPhoto ? <CheckCircle size={14} /> : <Camera size={14} />}
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="pt-4 mt-2 border-t border-white/5 flex justify-between items-center">
                                                <span className="text-xs font-medium text-gray-400">ขายได้:</span>
                                                <span className="font-mono font-bold text-cyan-400 text-lg">
                                                    {formatNumber(Math.max(0, m.end - m.start))} <span className="text-[10px] text-gray-500">L</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => saveMeters('start')} className="flex-1 py-3 text-sm font-semibold rounded-xl text-gray-300 bg-[#1C1C1F] border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                    <Save size={16} /> บันทึกเริ่ม
                                </button>
                                <button onClick={() => saveMeters('end')} className="flex-1 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
                                    <Save size={16} /> บันทึกสิ้นสุด
                                </button>
                            </div>
                        </div>
