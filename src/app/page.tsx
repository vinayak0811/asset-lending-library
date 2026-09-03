"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <Loader2
        className="h-10 w-10 animate-spin text-blue-600"
        aria-label="Loading"
      />
    </main>
  );
}