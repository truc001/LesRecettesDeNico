"use client";

import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_SETTINGS_EVENT,
  disableFirebaseAnalytics,
  enableFirebaseAnalytics,
} from "@/lib/firebase-analytics";

type Choice = "accepted" | "refused" | null;
const CONSENT_DURATION = 180 * 24 * 60 * 60 * 1000;

function readChoice(): Choice {
  try {
    const stored = JSON.parse(localStorage.getItem(ANALYTICS_CONSENT_KEY) ?? "null") as { choice?: Choice; expiresAt?: number } | null;
    if (!stored?.choice || !stored.expiresAt || stored.expiresAt <= Date.now()) {
      localStorage.removeItem(ANALYTICS_CONSENT_KEY);
      return null;
    }
    return stored.choice;
  } catch {
    return null;
  }
}

export function FirebaseAnalytics() {
  const [choice, setChoice] = useState<Choice | "loading">("loading");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setChoice(readChoice()); });
    const openSettings = () => setChoice(null);
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    return () => {
      active = false;
      window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    };
  }, []);

  useEffect(() => {
    if (choice === "accepted") void enableFirebaseAnalytics();
    if (choice === "refused") void disableFirebaseAnalytics();
  }, [choice]);

  function decide(nextChoice: Exclude<Choice, null>) {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({
        choice: nextChoice,
        expiresAt: Date.now() + CONSENT_DURATION,
      }));
    } catch {
      // The choice still applies to the current visit when storage is unavailable.
    }
    setChoice(nextChoice);
  }

  if (choice !== null) return null;

  return <section className="analytics-consent" aria-labelledby="analytics-consent-title">
    <div>
      <h2 id="analytics-consent-title">Mesure d’audience</h2>
      <p>Autorisez-vous Firebase Analytics, un service Google, à mesurer les pages et les recettes consultées ? Ces données servent à améliorer le carnet. Vous pourrez changer d’avis via « Confidentialité ».</p>
    </div>
    <div className="analytics-consent-actions">
      <button type="button" onClick={() => decide("refused")}>Refuser</button>
      <button type="button" className="analytics-accept" onClick={() => decide("accepted")}>Accepter</button>
    </div>
  </section>;
}
