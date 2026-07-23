import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { submitContactMessage } from "@/lib/contact.functions";

export function ContactForm() {
  const submit = useServerFn(submitContactMessage);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState<string>("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    setErr("");
    const fd = new FormData(e.currentTarget);
    try {
      await submit({
        data: {
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          subject: String(fd.get("subject") ?? ""),
          message: String(fd.get("message") ?? ""),
          source_path: pathname,
        },
      });
      setState("sent");
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="max-w-lg mx-auto bg-white/10 backdrop-blur border border-white/20 rounded p-6 text-center">
        <div className="text-lg font-serif mb-2">Message sent ✓</div>
        <div className="text-sm opacity-80">Thank you — we'll get back to you shortly.</div>
        <button onClick={() => setState("idle")} className="mt-4 text-xs underline">Send another</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg mx-auto text-left space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required name="name" placeholder="Your name" maxLength={200}
          className="bg-white/10 border border-white/30 placeholder:text-white/60 text-white rounded px-3 py-2 text-sm" />
        <input required type="email" name="email" placeholder="Email" maxLength={320}
          className="bg-white/10 border border-white/30 placeholder:text-white/60 text-white rounded px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="phone" placeholder="Phone (optional)" maxLength={50}
          className="bg-white/10 border border-white/30 placeholder:text-white/60 text-white rounded px-3 py-2 text-sm" />
        <input name="subject" placeholder="Subject (optional)" maxLength={200}
          className="bg-white/10 border border-white/30 placeholder:text-white/60 text-white rounded px-3 py-2 text-sm" />
      </div>
      <textarea required name="message" placeholder="Tell us about your project…" rows={5} maxLength={5000}
        className="w-full bg-white/10 border border-white/30 placeholder:text-white/60 text-white rounded px-3 py-2 text-sm" />
      {state === "error" && <div className="text-xs text-red-300">{err}</div>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full bg-white text-black rounded py-2 text-sm font-medium disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
