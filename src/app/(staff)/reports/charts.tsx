"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: { date: string; reservations: number; covers: number; noShows: number }[] }) {
  return (
    <div className="h-64"><ResponsiveContainer>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="covers" name="Covers" stroke="#e8772e" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="reservations" name="Reservations" stroke="#2f7d4f" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="noShows" name="No-shows" stroke="#ef4444" dot={false} />
      </LineChart>
    </ResponsiveContainer></div>
  );
}

export function PeakChart({ data }: { data: { hour: string; reservations: number; covers: number }[] }) {
  return (
    <div className="h-64"><ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="hour" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
        <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="reservations" name="Reservations" fill="#2f7d4f" radius={[4, 4, 0, 0]} />
        <Bar dataKey="covers" name="Covers" fill="#e8772e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer></div>
  );
}
