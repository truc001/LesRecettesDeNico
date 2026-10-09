"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ArrowLeft, ArrowRight, Sun, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { stepIngredients, stepMinutes } from "@/lib/cooking";

type Props = { title: string; ingredients: string[]; steps: string[]; open: boolean; onOpenChange: (open: boolean) => void };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Countdown for a step that asks to wait. It only runs while the cooking mode stays on this step. */
function StepTimer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const running = left !== null && left > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setLeft((current) => {
      if (current === null || current <= 1) { navigator.vibrate?.([200, 100, 200]); return 0; }
      return current - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return <button type="button" className={`cooking-timer ${left !== null ? "cooking-timer-on" : ""}`} onClick={() => setLeft(left === null ? minutes * 60 : null)}>
    <Timer size={18} aria-hidden="true" />
    <span role="timer">{left === null ? `Lancer ${minutes} min` : left === 0 ? "C’est prêt !" : `${clock(left)} · arrêter`}</span>
  </button>;
}

/** Full-screen, one step at a time, in large type: for cooking with busy hands. */
export function CookingMode({ title, ingredients, steps, open, onOpenChange }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [awake, setAwake] = useState(false);
  const touchStart = useRef<number | null>(null);
  const last = index === steps.length - 1;

  // Keeps the screen on while cooking, where the browser allows it.
  useEffect(() => {
    if (!open || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock.request("screen").then((sentinel) => {
      if (cancelled) return void sentinel.release();
      lock = sentinel;
      setAwake(true);
      sentinel.addEventListener("release", () => setAwake(false));
    }).catch(() => undefined);
    return () => { cancelled = true; void lock?.release(); };
  }, [open]);

  function go(delta: 1 | -1) {
    if (delta === 1 && last) return onOpenChange(false);
    const next = index + delta;
    if (next < 0) return;
    setDirection(delta === 1 ? "next" : "back");
    setIndex(next);
  }
  function touchEnd(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null) return;
    const distance = event.changedTouches[0].clientX - start;
    if (Math.abs(distance) > 60) go(distance < 0 ? 1 : -1);
  }

  const step = steps[index] ?? "";
  const needs = stepIngredients(step, ingredients);
  const minutes = stepMinutes(step);

  return <Dialog open={open} onOpenChange={(next) => { if (next) setIndex(0); onOpenChange(next); }}>
    <DialogContent className="cooking-mode" onKeyDown={(event) => { if (event.key === "ArrowRight") go(1); if (event.key === "ArrowLeft") go(-1); }} onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={touchEnd}>
      <div className="cooking-top">
        <DialogTitle>{title}</DialogTitle>
        {awake && <span className="cooking-awake"><Sun size={14} aria-hidden="true" /> Écran allumé</span>}
      </div>
      <div className="cooking-progress" aria-hidden="true">{steps.map((_, position) => <span key={position} className={position <= index ? "cooking-done" : ""} />)}</div>
      {/* A new key per step replays the slide, from the side the cook is coming from. */}
      <div key={index} className={`cooking-step cooking-${direction}`}>
        <DialogDescription>Étape {index + 1} sur {steps.length}</DialogDescription>
        <p aria-live="polite">{step}</p>
        {needs.length > 0 && <ul>{needs.map((need) => <li key={need}>{need}</li>)}</ul>}
        {minutes !== null && <StepTimer minutes={minutes} />}
      </div>
      <div className="cooking-actions">
        <button type="button" aria-label="Étape précédente" disabled={index === 0} onClick={() => go(-1)}><ArrowLeft size={24} aria-hidden="true" /></button>
        <button type="button" onClick={() => go(1)}>{last ? "Terminé" : "Étape suivante"} <ArrowRight size={22} aria-hidden="true" /></button>
      </div>
    </DialogContent>
  </Dialog>;
}
