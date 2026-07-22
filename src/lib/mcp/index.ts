import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listGalleries from "./tools/list-galleries";
import getGallery from "./tools/get-gallery";
import createGallery from "./tools/create-gallery";
import updateGallery from "./tools/update-gallery";
import deleteGallery from "./tools/delete-gallery";
import addGalleryImage from "./tools/add-gallery-image";
import updateGalleryImage from "./tools/update-gallery-image";
import deleteGalleryImage from "./tools/delete-gallery-image";
import reorderGalleryImages from "./tools/reorder-gallery-images";
import listMenu from "./tools/list-menu";
import upsertMenuItem from "./tools/upsert-menu-item";
import deleteMenuItem from "./tools/delete-menu-item";
import listPages from "./tools/list-pages";
import upsertPage from "./tools/upsert-page";
import getSetting from "./tools/get-setting";
import setSetting from "./tools/set-setting";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "point-studio-cms",
  title: "Point Studio CMS",
  version: "0.1.0",
  instructions:
    "Manage the Point Studio photography site: galleries, gallery images, menu items, pages, and site settings. All tools act as the signed-in admin user; database RLS enforces admin-only writes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listGalleries,
    getGallery,
    createGallery,
    updateGallery,
    deleteGallery,
    addGalleryImage,
    updateGalleryImage,
    deleteGalleryImage,
    reorderGalleryImages,
    listMenu,
    upsertMenuItem,
    deleteMenuItem,
    listPages,
    upsertPage,
    getSetting,
    setSetting,
  ],
});
