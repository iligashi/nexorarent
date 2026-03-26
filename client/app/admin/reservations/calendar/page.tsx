'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarReservation {
  id: string;
  start: string;
  end: string;
  status: string;
  customer: string;
}

interface CalendarCar {
  car_id: string;
  car_name: string;
  reservations: CalendarReservation[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-blue-400',
  active: 'bg-green-400',
  completed: 'bg-gray-400',
};

export default function ReservationCalendarPage() {
  const [calendar, setCalendar] = useState<CalendarCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('month');

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const { data } = await api.get('/admin/reservations/calendar');
        setCalendar(data.calendar);
      } catch (err) {
        console.error('Failed to fetch calendar:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, []);

  const getDaysInView = () => {
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });
    }
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  };

  const days = getDaysInView();

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const isReservationOnDay = (res: CalendarReservation, day: Date) => {
    const start = new Date(res.start);
    const end = new Date(res.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return start <= dayEnd && end >= dayStart;
  };

  const isStartDay = (res: CalendarReservation, day: Date) => {
    const start = new Date(res.start);
    return start.toDateString() === day.toDateString();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="bg-white rounded-xl p-6 animate-pulse h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/reservations" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">Reservation Calendar</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Week</button>
            <button onClick={() => setView('month')} className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Month</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
            <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', color)} />
            <span className="capitalize text-gray-600">{status}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="sticky left-0 bg-white z-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[180px] border-r border-gray-100">
                Car
              </th>
              {days.map(day => (
                <th key={day.toISOString()} className={cn(
                  'px-1 py-3 text-center text-xs font-medium min-w-[40px]',
                  day.toDateString() === today.toDateString() ? 'bg-[#FF4D30]/5 text-[#FF4D30]' : 'text-gray-500'
                )}>
                  <div>{day.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</div>
                  <div className="font-semibold">{day.getDate()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.filter(c => c.reservations?.some(r => r.id)).map(car => (
              <tr key={car.car_id} className="border-b border-gray-50">
                <td className="sticky left-0 bg-white z-10 px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100 whitespace-nowrap">
                  {car.car_name}
                </td>
                {days.map(day => {
                  const activeRes = car.reservations?.filter(r => r.id && isReservationOnDay(r, day)) || [];
                  return (
                    <td key={day.toISOString()} className={cn('px-0.5 py-2 relative', day.toDateString() === today.toDateString() && 'bg-[#FF4D30]/5')}>
                      {activeRes.map(res => (
                        <div
                          key={res.id}
                          title={`${res.customer} (${res.status})`}
                          className={cn(
                            'h-6 rounded text-[10px] text-white font-medium flex items-center overflow-hidden',
                            statusColors[res.status] || 'bg-gray-300',
                            isStartDay(res, day) ? 'pl-1 rounded-l-md' : 'rounded-l-none'
                          )}
                        >
                          {isStartDay(res, day) && <span className="truncate">{res.customer}</span>}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
            {calendar.filter(c => c.reservations?.some(r => r.id)).length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="px-6 py-12 text-center text-sm text-gray-400">
                  No reservations to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
