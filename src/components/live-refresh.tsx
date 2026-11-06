"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Subscribes to Supabase Realtime changes and refreshes server data (debounced). RLS applies to the stream. */
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-${key}-${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 600);
      });
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [key, router]);
  return null;
}
