import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

interface AppLayoutProps {
    children: ReactNode;
    title?: string;
    showBackButton?: boolean;
}

export function AppLayout({ children, title, showBackButton = false }: AppLayoutProps) {
    return (
        <div className="min-h-screen bg-neutral-100 pb-20">
            <Header title={title} showBackButton={showBackButton} />
            <main className="mx-auto max-w-lg px-4 pt-4">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
