'use client';

import { ArrowLeft, Bell } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
    title?: string;
    showBackButton?: boolean;
}

export function Header({ title, showBackButton = false }: HeaderProps) {
    const router = useRouter();

    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-neutral-200">
            <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {showBackButton ? (
                        <button
                            onClick={() => router.back()}
                            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-neutral-800" />
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-black text-sm shadow-[2px_2px_0_0_rgba(0,0,0,0.9)]">
                                CB
                            </span>
                            <span className="font-extrabold tracking-tight text-lg text-neutral-900">CreditBill</span>
                        </div>
                    )}
                    {title && showBackButton && (
                        <h1 className="font-bold text-lg text-neutral-800">{title}</h1>
                    )}
                </div>

                <button className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">
                    <Bell className="h-5 w-5 text-neutral-600" />
                </button>
            </div>
        </header>
    );
}
