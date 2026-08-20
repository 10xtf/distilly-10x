import { z } from "zod";

/** Protocol major exchanged at every future transport boundary. */
export const WIRE_VERSION = "3" as const;

/** Runtime schema for the protocol major sentinel. */
export const wireVersionSchema = z.literal(WIRE_VERSION);
