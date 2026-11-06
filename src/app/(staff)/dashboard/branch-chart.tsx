"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BranchChart({ data }: { data: { name: string; reservations: number; covers: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? "end" : "middle"} height={data.length > 4 ? 50 : 30} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="reservations" name="Reservations" fill="#2f7d4f" radius={[4, 4, 0, 0]} />
          <Bar dataKey="covers" name="Covers" fill="#e8772e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
