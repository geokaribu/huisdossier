import { z } from "zod";
import { readFloorplan } from "./floorplan.mjs";
import { readAppearance } from "./appearance.mjs";
import { readLighting } from "./lighting.mjs";
import {
  assistantRecords,
  retrieveAssistantRecords,
} from "./assistant-context.mjs";
import {
  readAssistantSettings,
  assistantStatus,
  saveAssistantSettings,
  generateHouseAnswer,
} from "./assistant-provider.mjs";

const querySchema = z
  .object({
    question: z.string().trim().min(1).max(2500),
    assetId: z.string().max(200).default(""),
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().max(6000),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .strict();
export function assistantRoutes(
  app,
  { directory, houses, store, modelFor, env = process.env, fetchImpl = fetch },
) {
  const active = new Set(),
    recent = new Map();
  const safeRoute = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: "Controleer de vraag of AI-instellingen." });
      if (error.status >= 400 && error.status <= 599)
        return res.status(error.status).json({ error: error.message });
      // Do not log provider payloads, API keys or source content.
      res
        .status(500)
        .json({ error: "De huisassistent kon de gegevens niet verwerken." });
    }
  };
  app.get(
    "/api/assistant/status",
    safeRoute(async (_req, res) =>
      res.json(assistantStatus(await readAssistantSettings(directory, env))),
    ),
  );
  app.put(
    "/api/assistant/settings",
    safeRoute(async (req, res) =>
      res.json(await saveAssistantSettings(directory, req.body, env)),
    ),
  );
  app.post(
    "/api/houses/:houseId/assistant",
    safeRoute(async (req, res) => {
      const input = querySchema.parse(req.body);
      const houseId = req.params.houseId;
      if (input.assetId && !store.asset(houseId, input.assetId))
        return res
          .status(400)
          .json({ error: "Deze plek hoort niet bij de gekozen woning." });
      const settings = await readAssistantSettings(directory, env);
      if (!assistantStatus(settings).configured)
        return res
          .status(503)
          .json({
            error: "Verbind eerst een AI-model via AI instellen.",
            code: "ASSISTANT_NOT_CONFIGURED",
          });
      const times = (recent.get(houseId) || []).filter(
        (time) => time > Date.now() - 60000,
      );
      if (active.has(houseId) || times.length >= 12)
        return res
          .status(429)
          .json({
            error: active.has(houseId)
              ? "Er wordt al een vraag voor dit huis beantwoord."
              : "Even pauze: er zijn veel vragen tegelijk gesteld. Probeer over een minuut opnieuw.",
          });
      active.add(houseId);
      recent.set(houseId, [...times, Date.now()]);
      const controller = new AbortController();
      const close = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", close);
      try {
        const optional = await Promise.allSettled([
          readFloorplan(directory, houseId),
          readAppearance(directory, houseId),
          modelFor(houseId),
          readLighting(directory, houseId),
        ]);
        const [plan, appearance, model, lighting] = optional.map((result) =>
          result.status === "fulfilled" ? result.value : null,
        );
        const { records, coverage } = assistantRecords({
          house: houses.find((house) => house.id === houseId),
          dossier: store.dossier(houseId),
          files: store.allFiles(houseId),
          plan,
          appearance,
          model,
          lighting,
          assetId: input.assetId,
        });
        const selected = retrieveAssistantRecords(
          records,
          input.question,
          input.history,
        );
        const answer = await generateHouseAnswer({
          settings,
          ...input,
          records: selected,
          signal: controller.signal,
          fetchImpl,
        });
        if (!controller.signal.aborted)
          res.json({
            ...answer,
            coverage: {
              ...coverage,
              selectedRecords: selected.length,
              unavailable: optional.flatMap((result, index) =>
                result.status === "rejected"
                  ? [
                      [
                        "binnenmodel",
                        "uiterlijkprofiel",
                        "gebouwmodel",
                        "lichtmodel",
                      ][index],
                    ]
                  : [],
              ),
            },
          });
      } finally {
        active.delete(houseId);
        res.off("close", close);
      }
    }),
  );
}
