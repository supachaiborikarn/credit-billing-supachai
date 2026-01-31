'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Eye, EyeOff, Fuel, Sparkles, Loader2 } from 'lucide-react';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    // Form validation states
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Shift selection for Gas Station (กะเช้า/กะบ่าย)
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [pendingRedirect, setPendingRedirect] = useState<{ stationNum: number } | null>(null);

    useEffect(() => {
        setMounted(true);

        // Check if user is already logged in
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setRedirecting(true);

                        // Redirect based on role
                        if (data.user.role === 'STAFF' && data.user.stationId) {
                            const { findStationIndex } = await import('@/constants');
                            const stationNum = findStationIndex(data.user.stationId);

                            if (stationNum > 0) {
                                if (data.user.stationType === 'FULL') {
                                    router.push(`/station/${stationNum}`);
                                } else if (data.user.stationType === 'GAS') {
                                    router.push(`/gas-station/${stationNum}/new/home`);
                                } else {
                                    router.push(`/simple-station/${stationNum}/new/home`);
                                }
                                return;
                            }
                        }
                        // Default: redirect to dashboard
                        router.push('/dashboard');
                    }
                }
            } catch {
                // Not logged in, show login form
            }
        };

        checkSession();
    }, [router]);

    // Validate username
    const validateUsername = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length > 0 && trimmed.length < 2) {
            setUsernameError('ชื่อผู้ใช้ต้องมีอย่างน้อย 2 ตัวอักษร');
            return false;
        }
        setUsernameError('');
        return true;
    };

    // Validate password
    const validatePassword = (value: string) => {
        if (value.length > 0 && value.length < 4) {
            setPasswordError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
            return false;
        }
        setPasswordError('');
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Trim inputs
        const trimmedUsername = username.trim();
        const trimmedPassword = password;

        // Validate before submit
        if (!validateUsername(trimmedUsername) || !validatePassword(trimmedPassword)) {
            return;
        }

        if (trimmedUsername.length < 2 || trimmedPassword.length < 4) {
            setError('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: trimmedUsername, password: trimmedPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                // Show redirecting state
                setRedirecting(true);

                // Get redirect URL from query params or default
                const redirectTo = searchParams.get('redirect');

                // Small delay for UX
                await new Promise(resolve => setTimeout(resolve, 500));

                // Redirect based on role or redirect param
                if (redirectTo && !redirectTo.startsWith('/login')) {
                    router.push(redirectTo);
                } else if (data.user?.role === 'STAFF' && data.user?.stationId) {
                    const stationId = data.user.stationId;
                    const stationType = data.user.stationType;

                    // Import findStationIndex to handle UUID aliases
                    const { findStationIndex } = await import('@/constants');
                    const stationNum = findStationIndex(stationId);

                    // Use stationType to determine the correct path
                    if (stationNum > 0) {
                        if (stationType === 'FULL') {
                            router.push(`/station/${stationNum}`);
                        } else if (stationType === 'GAS') {
                            // Redirect to new gas station UI with synced data
                            router.push(`/gas-station/${stationNum}/new/home`);
                        } else {
                            router.push(`/simple-station/${stationNum}/new/home`);
                        }
                    } else {
                        // Fallback
                        router.push('/dashboard');
                    }
                } else {
                    router.push('/dashboard');
                }
            } else {
                setError(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setLoading(false);
        }
    };

    // Handle shift selection for Gas Station
    const handleShiftSelect = async (shiftNumber: number) => {
        if (!pendingRedirect) return;

        // Store selected shift in localStorage
        localStorage.setItem('selectedShift', String(shiftNumber));
        localStorage.setItem('selectedShiftName', shiftNumber === 1 ? 'กะเช้า' : 'กะบ่าย');

        setRedirecting(true);
        router.push(`/gas-station/${pendingRedirect.stationNum}/new/home`);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a12]">
            {/* Premium Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Main gradient orb - purple/pink */}
                <div
                    className="absolute w-[600px] h-[600px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(236, 72, 153, 0.2) 40%, transparent 70%)',
                        top: '-20%',
                        left: '-15%',
                        filter: 'blur(60px)',
                        animation: 'float 8s ease-in-out infinite',
                    }}
                />
                {/* Secondary orb - cyan/blue */}
                <div
                    className="absolute w-[500px] h-[500px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, rgba(59, 130, 246, 0.2) 40%, transparent 70%)',
                        bottom: '-15%',
                        right: '-10%',
                        filter: 'blur(60px)',
                        animation: 'float 10s ease-in-out infinite reverse',
                    }}
                />
                {/* Accent orb - green */}
                <div
                    className="absolute w-[350px] h-[350px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 60%)',
                        top: '40%',
                        right: '25%',
                        filter: 'blur(50px)',
                        animation: 'pulse 6s ease-in-out infinite',
                    }}
                />
                {/* Small accent orb - orange */}
                <div
                    className="absolute w-[200px] h-[200px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(249, 115, 22, 0.3) 0%, transparent 60%)',
                        bottom: '30%',
                        left: '20%',
                        filter: 'blur(40px)',
                        animation: 'float 7s ease-in-out infinite',
                    }}
                />

                {/* Dot grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
            </div>

            {/* Login Card - Premium Glassmorphism */}
            <div
                className={`relative z-10 w-full max-w-md transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
                    }`}
            >
                {/* Card glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-40 transition-opacity" />

                {/* Main card */}
                <div
                    className="relative backdrop-blur-2xl rounded-3xl border border-white/10 p-8 md:p-10"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.35), inset 0 1px 1px rgba(255,255,255,0.1)',
                    }}
                >
                    {/* Logo */}
                    <div className="text-center mb-10">
                        <div className="relative inline-block">
                            {/* Logo glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-3xl blur-2xl opacity-50" />
                            {/* Logo icon */}
                            <div
                                className="relative w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-400 p-[2px] shadow-2xl transform hover:scale-105 transition-all duration-300"
                            >
                                <div className="w-full h-full rounded-3xl bg-[#0f0f1a] flex items-center justify-center">
                                    <Fuel className="text-transparent bg-gradient-to-br from-purple-400 to-cyan-400 bg-clip-text" size={36} style={{ stroke: 'url(#logoGradient)' }} />
                                    <svg width="0" height="0">
                                        <defs>
                                            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#a855f7" />
                                                <stop offset="100%" stopColor="#22d3ee" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mt-6 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                            Credit Billing
                        </h1>
                        <p className="text-gray-400 mt-2 flex items-center justify-center gap-2">
                            <Sparkles size={14} className="text-purple-400" />
                            Supachai Group
                            <Sparkles size={14} className="text-cyan-400" />
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            ระบบบริหารเงินเชื่อครบวงจร
                        </p>
                    </div>

                    {/* Redirecting Overlay */}
                    {redirecting && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a12]/90 backdrop-blur-sm rounded-3xl">
                            <Loader2 size={48} className="animate-spin text-purple-400 mb-4" />
                            <p className="text-lg text-white font-medium">กำลังพาเข้าสู่ระบบ...</p>
                            <p className="text-sm text-gray-400 mt-1">กรุณารอสักครู่</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-2xl text-sm flex items-center gap-3 animate-shake">
                                <span className="text-xl">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-300 ml-1">
                                ชื่อผู้ใช้
                            </label>
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 blur transition-all duration-300" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        if (usernameError) validateUsername(e.target.value);
                                    }}
                                    onBlur={(e) => validateUsername(e.target.value)}
                                    className={`relative w-full px-5 py-4 min-h-[48px] bg-white/5 backdrop-blur-sm border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 text-base ${usernameError
                                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                                        : 'border-white/10 focus:border-purple-500/50 focus:ring-purple-500/20'
                                        }`}
                                    placeholder="กรอกชื่อผู้ใช้"
                                    required
                                    autoComplete="username"
                                    disabled={loading || redirecting}
                                />
                            </div>
                            {usernameError && (
                                <p className="text-red-400 text-xs ml-1 mt-1">{usernameError}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-300 ml-1">
                                รหัสผ่าน
                            </label>
                            <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-20 group-focus-within:opacity-30 blur transition-all duration-300" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (passwordError) validatePassword(e.target.value);
                                    }}
                                    onBlur={(e) => validatePassword(e.target.value)}
                                    className={`relative w-full px-5 py-4 pr-14 min-h-[48px] bg-white/5 backdrop-blur-sm border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all duration-300 text-base ${passwordError
                                        ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                                        : 'border-white/10 focus:border-purple-500/50 focus:ring-purple-500/20'
                                        }`}
                                    placeholder="กรอกรหัสผ่าน"
                                    required
                                    autoComplete="current-password"
                                    disabled={loading || redirecting}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
                                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="text-red-400 text-xs ml-1 mt-1">{passwordError}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || redirecting}
                            className="relative w-full py-4 min-h-[52px] mt-2 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {/* Button gradient background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500 transition-all duration-300 group-hover:scale-105" />
                            {/* Button glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-500 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                            {/* Button shine effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                            {/* Button content */}
                            <span className="relative flex items-center justify-center gap-3 text-lg">
                                {loading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <LogIn size={22} className="group-hover:translate-x-1 transition-transform" />
                                        เข้าสู่ระบบ
                                    </>
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-10 pt-6 border-t border-white/5 text-center">
                        <p className="text-gray-500 text-sm">
                            © 2024 Supachai Group
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                            Version 3.0.0 • Premium Edition
                        </p>
                    </div>
                </div>
            </div>

            {/* Animation keyframes */}
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-30px) scale(1.05); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.25; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.1); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake { animation: shake 0.6s ease-in-out; }
            `}</style>

            {/* Shift Selection Modal for Gas Station */}
            {showShiftModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div
                        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-md w-full mx-4 border border-purple-500/30 shadow-2xl"
                        style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                <Fuel size={40} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">เลือกกะ</h2>
                            <p className="text-gray-400">กรุณาเลือกกะที่ต้องการเข้าทำงาน</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleShiftSelect(1)}
                                className="p-6 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                <div className="text-4xl mb-2">🌅</div>
                                <div className="text-xl font-bold text-white">กะเช้า</div>
                                <div className="text-sm text-white/80">กะที่ 1</div>
                            </button>

                            <button
                                onClick={() => handleShiftSelect(2)}
                                className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 transition-all duration-300 transform hover:scale-105 shadow-lg"
                            >
                                <div className="text-4xl mb-2">🌙</div>
                                <div className="text-xl font-bold text-white">กะบ่าย</div>
                                <div className="text-sm text-white/80">กะที่ 2</div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Wrap in Suspense for useSearchParams
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
                <Loader2 size={48} className="animate-spin text-purple-400" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
