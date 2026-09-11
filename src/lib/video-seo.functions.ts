// Public (unauthenticated) reader for the published video list, used by the
// /video routes to emit VideoObject structured data during SSR.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPublicVideos } from "@/lib/video-seo.server";
import type { PublicVideo } from "@/lib/video-seo";

const schema = z.object({ pageUrl: z.string().url() });

export const getPublicVideos = createServerFn({ method: "GET" })
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data }): Promise<PublicVideo[]> => loadPublicVideos(data.pageUrl));
