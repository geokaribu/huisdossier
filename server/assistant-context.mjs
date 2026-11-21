import { calendarToday } from "./management.mjs";
// Only server-selected evidence from one house enters the model context.
const certainty = {
  source: "Volgens bron",
  resident: "Volgens bewoner",
  approximate: "Benadering",
  unknown: "Niet vastgesteld",
};
const chunks = (value) => {
  const text = String(value || "").trim();
  const result = [];
  for (let offset = 0; offset < text.length; offset += 1100)
    result.push(text.slice(offset, offset + 1300));
  return result;
};
export function assistantRecords({
  house,
  dossier,
  files,
  plan,
  appearance,
  model,
  lighting,
  assetId = "",
}) {
  const records = [];
  const assets = dossier.assets.filter(
    (asset) => !assetId || asset.id === assetId,
  );
  const ids = new Set(assets.map((asset) => asset.id));
  const roomIds = new Set(assets.map((asset) => asset.roomId).filter(Boolean));
  const kinds = new Set(assets.map((asset) => asset.kind));
  const add = (id, title, body, location = {}) => {
    if (!body) return;
    records.push({
      id,
      title,
      text: typeof body === "string" ? body : JSON.stringify(body),
      ...location,
    });
  };
  add(
    "house",
    house.name || house.address || "Deze woning",
    {
      address: house.address,
      city: house.city,
      today: calendarToday(),
      scope: assetId ? assets[0]?.name : "De hele woning",
      limits:
        "Alleen bewaarde dossierinformatie. Een 3DBAG-model is een gereconstrueerde buitenzijde van een pand, mogelijk met meerdere woningen. Geen meting of bewijs van interieur.",
    },
    { page: "sources" },
  );
  if (!assetId && model)
    add(
      "registry",
      "Open woningbronnen en gebouwmodel",
      {
        house: model.house,
        source: model.source,
        buildings: model.buildings
          ?.filter((b) => b.target)
          .map((b) => ({ id: b.id, attributes: b.attributes })),
      },
      { page: "sources" },
    );
  for (const asset of assets)
    add(
      `asset:${asset.id}`,
      asset.name,
      { kind: asset.kind, description: asset.description },
      { assetId: asset.id },
    );
  for (const room of plan?.rooms || []) {
    const asset = assets.find((a) => a.roomId === room.id);
    if (assetId && !roomIds.has(room.id)) continue;
    add(
      `room:${room.id}`,
      room.name,
      {
        areaM2: room.area,
        outside: room.outside,
        shared: room.shared,
        source: plan.source,
        modelFloor: room.floor,
        modelFloorColor: room.floorColor,
        modelCeilingHeight: plan.ceilingHeight,
        warning:
          "Plafondhoogte is een modelinstelling, geen geverifieerde meting voor iedere kamer. Maten en indeling alleen met de zekerheid van de bijbehorende bron.",
      },
      { assetId: asset?.id, page: "interior" },
    );
  }
  for (const [prefix, profile] of [
    ["plan", plan],
    ["appearance", appearance],
  ]) {
    for (const item of profile?.information || []) {
      if (
        assetId &&
        !(item.roomIds?.length
          ? item.roomIds.some((id) => roomIds.has(id))
          : item.assetKinds?.some((kind) => kinds.has(kind)))
      )
        continue;
      const asset = assets.find(
        (a) =>
          item.roomIds?.includes(a.roomId) || item.assetKinds?.includes(a.kind),
      );
      add(
        `${prefix}:${item.id}`,
        item.title,
        {
          value: item.value,
          text: item.text,
          certainty: certainty[item.status],
          source: item.source || profile.source || profile.attribution,
          topic: item.topic,
        },
        {
          assetId: asset?.id,
          page: prefix === "plan" ? "interior" : "sources",
        },
      );
    }
    if (!assetId)
      chunks(profile?.description).forEach((text, i) =>
        add(
          `${prefix}:description:${i}`,
          `${profile.label || "Modelprofiel"} · bronnotitie`,
          {
            text,
            source: profile.source || profile.attribution,
            generated: profile.generated,
          },
          { page: "sources" },
        ),
      );
  }
  // Object dimensions and colours are model parameters, never verified inventory.
  const inside = ([x, y], polygon) => {
    let result = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i],
        [xj, yj] = polygon[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        result = !result;
    }
    return result;
  };
  for (const [index, item] of [
    ...(plan?.fixtures || []),
    ...(plan?.decorations || []),
  ].entries()) {
    const room = plan.rooms.find((room) => inside(item.center, room.polygon));
    const asset = assets.find((asset) => asset.roomId === room?.id);
    if (assetId && !asset) continue;
    add(
      `model-object:${index}`,
      `${room?.name || "Binnenmodel"} · ${item.label || item.kind}`,
      {
        kind: item.kind,
        sizeMetres: item.size,
        heightMetres: item.height,
        color: item.color,
        source: plan.source,
        warning:
          "Modelobject: plaatsing, maten en kleur zijn alleen modelparameters. Niet als echte inventaris of geverifieerde maat gebruiken zonder expliciete broninformatie.",
      },
      { assetId: asset?.id, page: "interior" },
    );
  }
  const tasks = dossier.tasks.filter((task) => ids.has(task.assetId));
  for (const task of tasks)
    add(
      `task:${task.id}`,
      task.title,
      {
        description: task.description,
        date: task.date,
        status: task.status,
        state: task.state,
        completedAt: task.completedAt,
        costCents: task.costCents ?? null,
        result: task.result,
        assignee: dossier.people?.find(
          (person) => person.id === task.assigneeId,
        )?.name,
        source: task.source,
        sourceDate: task.sourceDate,
        owner: task.owner,
        recurrence: task.recurrence,
      },
      { assetId: task.assetId, page: "tasks" },
    );
  add(
    "task-summary",
    "Overzicht klussen en onderhoud",
    {
      open: tasks.filter((t) => t.status !== "done").length,
      done: tasks.filter((t) => t.status === "done").length,
      withoutDate: tasks.filter((t) => t.status !== "done" && !t.date).length,
    },
    { assetId: assetId || undefined, page: "tasks" },
  );
  const done = tasks.filter((task) => task.status === "done");
  const years = [
    ...new Set(
      done.map((task) => task.completedAt?.slice(0, 4)).filter(Boolean),
    ),
  ];
  for (const year of ["", ...years]) {
    const group = done.filter(
      (task) => !year || task.completedAt?.startsWith(year),
    );
    const known = group.filter(
      (task) => Number.isSafeInteger(task.costCents) && task.costCents >= 0,
    );
    add(
      `costs:${year || "all"}`,
      `Geregistreerde onderhoudskosten ${year || "alle jaren"}`,
      {
        year: year || "alle jaren",
        knownCents: known.length
          ? known.reduce((sum, task) => sum + task.costCents, 0)
          : null,
        knownCount: known.length,
        unknownCount: group.length - known.length,
        limit:
          "Alleen kosten bij afgeronde klussen. Onbekende bedragen tellen niet als nul. Geen overzicht van alle woonlasten of begroting.",
      },
      { assetId: assetId || undefined, page: "planning" },
    );
  }
  const linkedPeople = new Set(
    (dossier.contactLinks || [])
      .filter((link) => ids.has(link.assetId))
      .map((link) => link.personId),
  );
  for (const [index, link] of (dossier.contactLinks || []).entries()) {
    if (!ids.has(link.assetId)) continue;
    add(
      `contact-link:${index}`,
      `${dossier.people?.find((person) => person.id === link.personId)?.name || "Contact"} · ${assets.find((asset) => asset.id === link.assetId)?.name}`,
      { label: link.label, notes: link.notes },
      { assetId: link.assetId, page: "manage" },
    );
  }
  for (const person of dossier.people || []) {
    if (
      assetId &&
      !linkedPeople.has(person.id) &&
      !tasks.some((task) => task.assigneeId === person.id)
    )
      continue;
    add(
      `person:${person.id}`,
      person.name,
      {
        role: person.role,
        company: person.company,
        specialty: person.specialty,
        notes: person.notes,
      },
      { page: "manage" },
    );
  }
  const selectedFiles = files.filter((file) => ids.has(file.asset_id));
  for (const file of selectedFiles) {
    let metadata = {};
    try {
      metadata =
        typeof file.metadata === "string"
          ? JSON.parse(file.metadata)
          : file.metadata || {};
    } catch {
      /* corrupt metadata is not evidence */
    }
    const location = { assetId: file.asset_id, fileId: file.id, page: "files" };
    add(
      `file:${file.id}`,
      file.name,
      {
        summary: metadata.summary,
        source: metadata.source,
        sourceDate: metadata.sourceDate,
        historical: metadata.historical,
        category: metadata.category,
        textAvailable: Boolean(file.text_content?.trim()),
        limit: file.text_content?.trim()
          ? "Bewaarde documenttekst; geen nieuwe OCR of beeldanalyse."
          : "Alleen bestandsgegevens en eventuele samenvatting; inhoud van scan of foto niet gelezen.",
      },
      location,
    );
    chunks(file.text_content).forEach((text, i) =>
      add(
        `file:${file.id}:${i}`,
        `${file.name} · tekst ${i + 1}`,
        text,
        location,
      ),
    );
  }
  if (!assetId && lighting)
    add(
      "lighting",
      "Lichtmodel · aannames",
      {
        source: lighting.source,
        lamps: lighting.lamps,
        warning: "Simulatie, geen gemeten lichtsterkte.",
      },
      { page: "sources" },
    );
  return {
    records,
    coverage: {
      files: selectedFiles.length,
      readableFiles: selectedFiles.filter((f) => f.text_content?.trim()).length,
      records: records.length,
    },
  };
}
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const stop = new Set(
  "de het een en of in op aan met van voor is zijn was wat hoe waar welke kan ik je mijn ons er die dat dit heeft".split(
    " ",
  ),
);
const words = (value) =>
  [...new Set(normalize(value).match(/[a-z0-9]{3,}/g) || [])].filter(
    (word) => !stop.has(word),
  );
export function retrieveAssistantRecords(records, question, history = []) {
  let query = question;
  if (/kost|betaal|geld|budget|uitgav/i.test(query))
    query += " kosten onderhoudskosten geregistreerde";
  if (/kleur|verf|afwerk/i.test(query)) query += " afwerking kleuren";
  if (/hoog|breed|lang|groot|oppervlak|afmet/i.test(query))
    query += " maten afmetingen plafondhoogte oppervlakte";
  const current = words(query);
  const previous = words(
    history
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content)
      .join(" "),
  );
  const ranked = records
    .map((record, index) => {
      const title = normalize(record.title),
        body = normalize(record.text);
      const scoreWords = (tokens) =>
        tokens.reduce(
          (sum, word) =>
            sum +
            (title.includes(word) ? 5 : 0) +
            (body.includes(word) ? 1 : 0),
          0,
        );
      return {
        record,
        index,
        score:
          record.id === "house"
            ? 10000
            : scoreWords(current) + scoreWords(previous) * 0.25,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [];
  let length = 0;
  for (const { record } of ranked) {
    if (selected.length >= 18) break;
    const size = record.text.length + record.title.length;
    if (length + size > 24000) continue;
    selected.push(record);
    length += size;
  }
  return selected;
}
