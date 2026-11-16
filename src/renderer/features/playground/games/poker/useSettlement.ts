import { useEffect, useState } from 'react';
import type { Table } from '../../../../../shared/poker/engine';
/** Presentation cursor only. Awards and balances have already been committed on disk. */
export function useSettlement(table: Table | null | undefined, paused: boolean, ready: boolean) {
    const [celebrated, setCelebrated] = useState('');
    const [cursor, setCursor] = useState({ id: '', paid: 0 });
    const awards = table?.settlement?.awards ?? [];
    const paid = cursor.id === table?.id ? cursor.paid : 0;
    const finished = !table?.settlement || paid >= awards.length;
    useEffect(() => {
        if (!table?.done || !table.settlement || finished || paused || !ready)
            return;
        const id = table.id;
        const timer = setTimeout(() => setCursor({ id, paid: paid + 1 }), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400);
        return () => clearTimeout(timer);
    }, [table?.id, table?.done, paid, finished, paused, ready]);
    const winAmount = table?.settlement?.netGains?.[0] ?? 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const celebrating = !!table?.done && finished && winAmount > 0 && celebrated !== table.id && ready && !reducedMotion;
    const complete = finished && (winAmount <= 0 || celebrated === table?.id || reducedMotion);
    useEffect(() => {
        if (!celebrating || paused || !table) return;
        const id = table.id;
        const timer = setTimeout(() => setCelebrated(id), 1600);
        return () => clearTimeout(timer);
    }, [celebrating, paused, table?.id]);
    const credited = table?.seats.map((_, seat) => awards.slice(0, paid).reduce((sum, award) => sum + (award.recipients.find(r => r.seat === seat)?.amount ?? 0), 0)) ?? [];
    return { paid, finished, complete, celebrating, winAmount, credited, active: finished ? undefined : awards[paid], skip: () => { if (table)
            { setCursor({ id: table.id, paid: awards.length }); setCelebrated(table.id); } } };
}
