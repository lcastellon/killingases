import { describe, expect, it } from "vitest";

import { TABLE_INACTIVITY_MINUTES } from "./table.server";

describe("cierre de mesas inactivas", () => {
  it("usa un límite de diez minutos", () => {
    expect(TABLE_INACTIVITY_MINUTES).toBe(10);
  });
});
