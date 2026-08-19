import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { HELP_SCOUT_BEACON_ID } from "@/config";

type BeaconQueueItem = {
  method: string;
  options?: string | Record<string, unknown>;
  data?: unknown;
};

type BeaconCommand = {
  (
    method: string,
    options?: string | Record<string, unknown>,
    data?: unknown
  ): void;
  readyQueue: BeaconQueueItem[];
};

declare global {
  interface Window {
    Beacon?: BeaconCommand;
  }
}

const BEACON_SCRIPT_ID = "help-scout-beacon-script";
const BEACON_SCRIPT_URL = "https://beacon-v2.helpscout.net";

function loadBeacon() {
  if (!window.Beacon) {
    const beacon = ((method, options, data) => {
      beacon.readyQueue.push({ method, options, data });
    }) as BeaconCommand;
    beacon.readyQueue = [];
    window.Beacon = beacon;
  }

  if (!document.getElementById(BEACON_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = BEACON_SCRIPT_ID;
    script.type = "text/javascript";
    script.async = true;
    script.src = BEACON_SCRIPT_URL;
    document.head.appendChild(script);
  }
}

export default function HelpScoutBeacon() {
  const location = useLocation();

  useEffect(() => {
    if (!HELP_SCOUT_BEACON_ID) return;

    loadBeacon();
    window.Beacon?.("init", HELP_SCOUT_BEACON_ID);

    return () => {
      window.Beacon?.("logout", { endActiveChat: true });
      window.Beacon?.("destroy");
    };
  }, []);

  useEffect(() => {
    if (!HELP_SCOUT_BEACON_ID) return;

    window.Beacon?.("event", {
      type: "page-viewed",
      url: window.location.href,
      title: document.title,
    });
    window.Beacon?.("suggest");
  }, [location.pathname, location.search]);

  return null;
}
