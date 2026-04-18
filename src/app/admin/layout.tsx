import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
        redirect('/login?redirect=/admin');
    }

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
            user: { select: { role: true } },
        },
    });

    if (!session || session.expiresAt < new Date()) {
        redirect('/login?redirect=/admin');
    }

    if (session.user.role !== 'ADMIN') {
        redirect('/dashboard');
    }

    return <>{children}</>;
}
